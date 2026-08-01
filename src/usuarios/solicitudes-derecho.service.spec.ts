import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SolicitudesDerechoService } from './solicitudes-derecho.service';
import { SolicitudDerecho } from '../database/entities/solicitud-derecho.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { UsuariosService } from './usuarios.service';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
}

describe('SolicitudesDerechoService', () => {
  let service: SolicitudesDerechoService;
  let solicitudesRepo: ReturnType<typeof crearMockRepo>;
  let usuariosRepo: ReturnType<typeof crearMockRepo>;
  let auditoriaRepo: ReturnType<typeof crearMockRepo>;
  let usuariosService: { anonimizarUsuario: jest.Mock };

  beforeEach(async () => {
    solicitudesRepo = crearMockRepo();
    usuariosRepo = crearMockRepo();
    auditoriaRepo = crearMockRepo();
    usuariosService = {
      anonimizarUsuario: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SolicitudesDerechoService,
        {
          provide: getRepositoryToken(SolicitudDerecho),
          useValue: solicitudesRepo,
        },
        { provide: getRepositoryToken(Usuario), useValue: usuariosRepo },
        { provide: getRepositoryToken(Auditoria), useValue: auditoriaRepo },
        { provide: UsuariosService, useValue: usuariosService },
      ],
    }).compile();

    service = moduleRef.get(SolicitudesDerechoService);
  });

  describe('crear', () => {
    it('usa el email de la cuenta cuando hay sesión, aunque el DTO traiga otro', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'real@rune.cl',
      });

      await service.crear({ usuarioId: 1 }, { tipo: 'acceso' });

      expect(solicitudesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 1,
          email: 'real@rune.cl',
          tipo: 'acceso',
        }),
      );
    });

    it('exige email para invitados sin sesión', async () => {
      await expect(service.crear({}, { tipo: 'portabilidad' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resolver', () => {
    it('ejecuta la anonimización real cuando se aprueba una supresión', async () => {
      solicitudesRepo.findOne.mockResolvedValueOnce({
        id: 10,
        usuarioId: 5,
        tipo: 'supresion',
        estado: 'recibida',
      });

      await service.resolver(10, { estado: 'completada' }, 99, '1.2.3.4');

      expect(usuariosService.anonimizarUsuario).toHaveBeenCalledWith(5);
      expect(solicitudesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'completada' }),
      );
      expect(auditoriaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'supresion_datos' }),
      );
    });

    it('no anonimiza en otros tipos de solicitud aprobada', async () => {
      solicitudesRepo.findOne.mockResolvedValueOnce({
        id: 11,
        usuarioId: 5,
        tipo: 'acceso',
        estado: 'recibida',
      });

      await service.resolver(
        11,
        { estado: 'completada', respuesta: 'Enviado por email' },
        99,
      );

      expect(usuariosService.anonimizarUsuario).not.toHaveBeenCalled();
    });

    it('exige motivo_rechazo para rechazar (Ley 21.719)', async () => {
      solicitudesRepo.findOne.mockResolvedValueOnce({
        id: 12,
        tipo: 'acceso',
        estado: 'recibida',
      });
      await expect(
        service.resolver(12, { estado: 'rechazada' }, 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza anonimizar una supresión sin usuario asociado (invitado)', async () => {
      solicitudesRepo.findOne.mockResolvedValueOnce({
        id: 13,
        usuarioId: null,
        tipo: 'supresion',
        estado: 'recibida',
      });
      await expect(
        service.resolver(13, { estado: 'completada' }, 99),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la solicitud no existe', async () => {
      solicitudesRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resolver(999, { estado: 'completada' }, 99),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
