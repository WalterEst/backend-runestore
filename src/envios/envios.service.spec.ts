import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EnviosService } from './envios.service';
import { Envio } from '../database/entities/envio.entity';
import { Orden } from '../database/entities/orden.entity';
import { EmailService } from '../common/email/email.service';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('EnviosService', () => {
  let service: EnviosService;
  let enviosRepo: ReturnType<typeof crearMockRepo>;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let emailService: { enviarDespacho: jest.Mock };

  beforeEach(async () => {
    enviosRepo = crearMockRepo();
    ordenesRepo = crearMockRepo();
    emailService = { enviarDespacho: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EnviosService,
        { provide: getRepositoryToken(Envio), useValue: enviosRepo },
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = moduleRef.get(EnviosService);
  });

  describe('crear', () => {
    it('crea el envío para una orden pagada y la mueve a en_preparacion', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({ id: 1, estado: 'pagada' });
      enviosRepo.findOne.mockResolvedValueOnce(null);

      await service.crear(1, {
        courier: 'Chilexpress',
        numeroSeguimiento: 'CX123',
      });

      expect(enviosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ordenId: 1,
          courier: 'Chilexpress',
          estado: 'preparacion',
        }),
      );
      expect(ordenesRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { estado: 'en_preparacion' },
      );
    });

    it('rechaza si la orden no está pagada ni en preparación', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({
        id: 1,
        estado: 'pendiente_pago',
      });
      await expect(
        service.crear(1, { courier: 'Chilexpress' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si la orden ya tiene un envío', async () => {
      ordenesRepo.findOne.mockResolvedValueOnce({ id: 1, estado: 'pagada' });
      enviosRepo.findOne.mockResolvedValueOnce({ id: 9 });
      await expect(
        service.crear(1, { courier: 'Chilexpress' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('despachar', () => {
    it('marca el envío despachado, la orden enviada y notifica por email', async () => {
      enviosRepo.findOne.mockResolvedValueOnce({
        id: 5,
        ordenId: 1,
        courier: 'Starken',
        numeroSeguimiento: 'ST999',
        estado: 'preparacion',
      });
      ordenesRepo.findOne.mockResolvedValueOnce({
        id: 1,
        numeroOrden: 'ORD-2026-ABCDE',
        emailComprador: 'cliente@rune.cl',
      });

      const resultado = await service.despachar(5);

      expect(resultado.estado).toBe('despachado');
      expect(resultado.despachadoEn).toBeInstanceOf(Date);
      expect(ordenesRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { estado: 'enviada' },
      );
      expect(emailService.enviarDespacho).toHaveBeenCalledWith(
        'cliente@rune.cl',
        'ORD-2026-ABCDE',
        'Starken',
        'ST999',
      );
    });

    it('lanza NotFoundException si el envío no existe', async () => {
      enviosRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.despachar(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('marcarEntregado', () => {
    it('marca el envío entregado y la orden entregada', async () => {
      enviosRepo.findOne.mockResolvedValueOnce({
        id: 5,
        ordenId: 1,
        estado: 'despachado',
      });

      const resultado = await service.marcarEntregado(5);

      expect(resultado.estado).toBe('entregado');
      expect(ordenesRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { estado: 'entregada' },
      );
    });
  });
});
