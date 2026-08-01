import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { Usuario } from '../database/entities/usuario.entity';
import { Direccion } from '../database/entities/direccion.entity';
import { Orden } from '../database/entities/orden.entity';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { Resena } from '../database/entities/resena.entity';
import { Ticket } from '../database/entities/ticket.entity';
import { Rol } from '../database/entities/rol.entity';
import { Auditoria } from '../database/entities/auditoria.entity';
import { Carrito } from '../database/entities/carrito.entity';
import { Pagina } from '../database/entities/pagina.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    count: jest.fn(),
  };
}

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuariosRepo: ReturnType<typeof crearMockRepo>;
  let direccionesRepo: ReturnType<typeof crearMockRepo>;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let consentimientosRepo: ReturnType<typeof crearMockRepo>;
  let resenasRepo: ReturnType<typeof crearMockRepo>;
  let ticketsRepo: ReturnType<typeof crearMockRepo>;
  let rolesRepo: ReturnType<typeof crearMockRepo>;
  let auditoriaRepo: ReturnType<typeof crearMockRepo>;
  let paginasRepo: ReturnType<typeof crearMockRepo>;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    usuariosRepo = crearMockRepo();
    direccionesRepo = crearMockRepo();
    ordenesRepo = crearMockRepo();
    consentimientosRepo = crearMockRepo();
    resenasRepo = crearMockRepo();
    ticketsRepo = crearMockRepo();
    rolesRepo = crearMockRepo();
    auditoriaRepo = crearMockRepo();
    paginasRepo = crearMockRepo();
    dataSource = { transaction: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: getRepositoryToken(Usuario), useValue: usuariosRepo },
        { provide: getRepositoryToken(Direccion), useValue: direccionesRepo },
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        {
          provide: getRepositoryToken(Consentimiento),
          useValue: consentimientosRepo,
        },
        { provide: getRepositoryToken(Resena), useValue: resenasRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketsRepo },
        { provide: getRepositoryToken(Rol), useValue: rolesRepo },
        { provide: getRepositoryToken(Auditoria), useValue: auditoriaRepo },
        { provide: getRepositoryToken(Pagina), useValue: paginasRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(UsuariosService);
  });

  describe('obtenerPerfil', () => {
    it('nunca expone passwordHash ni refreshTokenHash', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'a@rune.cl',
        passwordHash: 'hash-secreto',
        refreshTokenHash: 'refresh-secreto',
        rol: { nombre: 'cliente' },
      });

      const perfil = await service.obtenerPerfil(1);

      expect(perfil).not.toHaveProperty('passwordHash');
      expect(perfil).not.toHaveProperty('refreshTokenHash');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.obtenerPerfil(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('direcciones', () => {
    it('rechaza editar la dirección de otro usuario (anti-IDOR)', async () => {
      direccionesRepo.findOne.mockResolvedValueOnce({ id: 5, usuarioId: 2 });
      await expect(
        service.actualizarDireccion(1, 5, { comuna: 'Providencia' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('al marcar una dirección como principal, desmarca las demás', async () => {
      direccionesRepo.findOne.mockResolvedValueOnce({
        id: 5,
        usuarioId: 1,
        esPrincipal: false,
      });
      await service.actualizarDireccion(1, 5, { esPrincipal: true });
      expect(direccionesRepo.update).toHaveBeenCalledWith(
        { usuarioId: 1 },
        { esPrincipal: false },
      );
    });
  });

  describe('anonimizarUsuario', () => {
    it('sigue el procedimiento documentado: anonimiza usuario, ordenes cerradas, borra direcciones y carritos', async () => {
      const managerMock = {
        findOne: jest.fn().mockResolvedValue({ id: 7 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        createQueryBuilder: jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 2 }),
        })),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );

      await service.anonimizarUsuario(7);

      expect(managerMock.update).toHaveBeenCalledWith(
        Usuario,
        { id: 7 },
        expect.objectContaining({
          email: 'anon-7@suprimido.local',
          nombre: 'Suprimido',
          apellido: 'Suprimido',
          rut: null,
          telefono: null,
          passwordHash: 'SUPRIMIDO',
          refreshTokenHash: null,
          activo: false,
        }),
      );
      expect(managerMock.delete).toHaveBeenCalledWith(Direccion, {
        usuarioId: 7,
      });
      expect(managerMock.delete).toHaveBeenCalledWith(Carrito, {
        usuarioId: 7,
      });
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      const managerMock = { findOne: jest.fn().mockResolvedValue(null) };
      dataSource.transaction.mockImplementation(async (cb: any) =>
        cb(managerMock),
      );
      await expect(service.anonimizarUsuario(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cambiarRol', () => {
    it('actualiza el rol y registra auditoría', async () => {
      rolesRepo.findOne.mockResolvedValueOnce({ id: 3, nombre: 'soporte' });
      usuariosRepo.findOne
        .mockResolvedValueOnce({ id: 1, rolId: 1 })
        .mockResolvedValueOnce({ id: 1, rol: { nombre: 'soporte' } });

      await service.cambiarRol(1, 'soporte', 99, '1.2.3.4');

      expect(usuariosRepo.update).toHaveBeenCalledWith({ id: 1 }, { rolId: 3 });
      expect(auditoriaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'cambio_rol',
          entidadId: 1,
          usuarioId: 99,
        }),
      );
    });

    it('rechaza un rol que no existe', async () => {
      rolesRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.cambiarRol(1, 'inventado', 99)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('toggleActivo', () => {
    it('desactiva al usuario y revoca su sesión (limpia refreshTokenHash)', async () => {
      usuariosRepo.findOne
        .mockResolvedValueOnce({
          id: 1,
          activo: true,
          refreshTokenHash: 'algo',
        })
        .mockResolvedValueOnce({ id: 1, rol: { nombre: 'cliente' } });

      await service.toggleActivo(1, 99);

      expect(usuariosRepo.update).toHaveBeenCalledWith(
        { id: 1 },
        { activo: false, refreshTokenHash: null },
      );
      expect(auditoriaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'desactivar_usuario' }),
      );
    });
  });

  describe('consentimientosPendientes', () => {
    it('marca como pendiente una política cuya versión subió desde el último consentimiento otorgado', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({ id: 1, email: 'a@rune.cl' });
      paginasRepo.find.mockResolvedValueOnce([
        { id: 10, slug: 'politica-privacidad', version: 3 },
      ]);
      consentimientosRepo.findOne.mockResolvedValueOnce({ version: 2 }); // aceptó la v2, ya va en la v3

      const pendientes = await service.consentimientosPendientes(1);

      expect(pendientes).toEqual([
        {
          finalidad: 'politica_privacidad',
          slug: 'politica-privacidad',
          version: 3,
        },
      ]);
    });

    it('no marca nada pendiente si ya aceptó la versión vigente', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({ id: 1, email: 'a@rune.cl' });
      paginasRepo.find.mockResolvedValueOnce([
        { id: 10, slug: 'politica-privacidad', version: 3 },
      ]);
      consentimientosRepo.findOne.mockResolvedValueOnce({ version: 3 });

      expect(await service.consentimientosPendientes(1)).toEqual([]);
    });

    it('marca pendiente si nunca aceptó esa política', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({ id: 1, email: 'a@rune.cl' });
      paginasRepo.find.mockResolvedValueOnce([
        { id: 10, slug: 'terminos-condiciones', version: 1 },
      ]);
      consentimientosRepo.findOne.mockResolvedValueOnce(null);

      const pendientes = await service.consentimientosPendientes(1);
      expect(pendientes).toHaveLength(1);
    });
  });

  describe('aceptarConsentimiento', () => {
    it('registra el consentimiento con la versión vigente de la página', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({ id: 1, email: 'a@rune.cl' });
      paginasRepo.findOne.mockResolvedValueOnce({
        id: 10,
        slug: 'politica-privacidad',
        version: 3,
      });

      await service.aceptarConsentimiento(1, 'politica-privacidad', {
        ip: '1.2.3.4',
      });

      expect(consentimientosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId: 1,
          email: 'a@rune.cl',
          finalidad: 'politica_privacidad',
          version: 3,
          otorgado: true,
        }),
      );
    });

    it('rechaza slugs que no exigen consentimiento', async () => {
      await expect(
        service.aceptarConsentimiento(1, 'envios', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
