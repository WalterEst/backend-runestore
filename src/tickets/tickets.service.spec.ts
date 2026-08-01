import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from '../database/entities/ticket.entity';
import { TicketMensaje } from '../database/entities/ticket-mensaje.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketsRepo: ReturnType<typeof crearMockRepo>;
  let mensajesRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    ticketsRepo = crearMockRepo();
    mensajesRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketsRepo },
        { provide: getRepositoryToken(TicketMensaje), useValue: mensajesRepo },
      ],
    }).compile();

    service = moduleRef.get(TicketsService);
  });

  describe('crear', () => {
    it('crea el ticket y su primer mensaje', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce(null); // numero único disponible

      const ticket = await service.crear(1, {
        asunto: 'Mi pedido no llega',
        categoria: 'envio',
        mensaje: 'Hola, mi pedido está atrasado',
      });

      expect(ticketsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 1,
          estado: 'abierto',
          numero: expect.stringMatching(/^TCK-/),
        }),
      );
      expect(mensajesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 1, esInterno: false }),
      );
      expect(ticket).toBeDefined();
    });
  });

  describe('obtenerPropio', () => {
    it('rechaza si el ticket no pertenece al usuario (anti-IDOR)', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce({ id: 5, usuarioId: 999 });
      await expect(service.obtenerPropio(5, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('nunca devuelve mensajes marcados como internos', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce({
        id: 5,
        usuarioId: 1,
        estado: 'abierto',
      });
      mensajesRepo.find.mockResolvedValueOnce([
        { id: 1, mensaje: 'Hola', esInterno: false },
      ]);

      await service.obtenerPropio(5, 1);

      expect(mensajesRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ticketId: 5, esInterno: false } }),
      );
    });

    it('lanza NotFoundException si el ticket no existe', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.obtenerPropio(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('agregarMensajePropio', () => {
    it('rechaza escribir en un ticket cerrado', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce({
        id: 5,
        usuarioId: 1,
        estado: 'cerrado',
      });
      await expect(
        service.agregarMensajePropio(5, 1, { mensaje: 'hola' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('reabre el ticket a "abierto" si estaba "esperando_cliente"', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce({
        id: 5,
        usuarioId: 1,
        estado: 'esperando_cliente',
      });

      await service.agregarMensajePropio(5, 1, { mensaje: 'ya lo revisé' });

      expect(ticketsRepo.update).toHaveBeenCalledWith(
        { id: 5 },
        { estado: 'abierto' },
      );
    });
  });

  describe('agregarMensajeAdmin', () => {
    it('permite marcar el mensaje como nota interna', async () => {
      ticketsRepo.findOne.mockResolvedValueOnce({
        id: 5,
        usuarioId: 1,
        estado: 'abierto',
      });

      await service.agregarMensajeAdmin(5, 42, {
        mensaje: 'nota interna',
        esInterno: true,
      });

      expect(mensajesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioId: 42, esInterno: true }),
      );
    });
  });
});
