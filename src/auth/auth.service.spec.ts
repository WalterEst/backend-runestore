import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { Usuario } from '../database/entities/usuario.entity';
import { Rol } from '../database/entities/rol.entity';
import { TokenUsuario } from '../database/entities/token-usuario.entity';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { Pagina } from '../database/entities/pagina.entity';
import { EmailService } from '../common/email/email.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';

type MockRepo<T = any> = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
};

function crearMockRepo<T = any>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => (Array.isArray(v) ? v : { id: 1, ...v })),
    update: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usuariosRepo: MockRepo;
  let rolesRepo: MockRepo;
  let tokensRepo: MockRepo;
  let consentimientosRepo: MockRepo;
  let paginasRepo: MockRepo;

  const ROL_CLIENTE = { id: 2, nombre: 'cliente' };
  const config = {
    'jwt.secret': 'secret-access-test',
    'jwt.refreshSecret': 'secret-refresh-test',
    'jwt.accessExpires': '15m',
    'jwt.refreshExpires': '7d',
    nodeEnv: 'test',
  };

  beforeEach(async () => {
    usuariosRepo = crearMockRepo();
    rolesRepo = crearMockRepo();
    tokensRepo = crearMockRepo();
    consentimientosRepo = crearMockRepo();
    paginasRepo = crearMockRepo();
    paginasRepo.findOne.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: getRepositoryToken(Usuario), useValue: usuariosRepo },
        { provide: getRepositoryToken(Rol), useValue: rolesRepo },
        { provide: getRepositoryToken(TokenUsuario), useValue: tokensRepo },
        {
          provide: getRepositoryToken(Consentimiento),
          useValue: consentimientosRepo,
        },
        { provide: getRepositoryToken(Pagina), useValue: paginasRepo },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => (config as Record<string, string>)[key],
          },
        },
        {
          provide: TurnstileService,
          useValue: { verificar: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: EmailService,
          useValue: {
            enviarVerificacionEmail: jest.fn().mockResolvedValue(undefined),
            enviarResetPassword: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('registro', () => {
    const dtoBase = {
      email: 'nuevo@rune.cl',
      password: 'clave12345',
      nombre: 'Ana',
      apellido: 'Soto',
      aceptaTerminos: true,
      aceptaMarketing: false,
      turnstileToken: 'token-valido',
    };

    it('crea el usuario, registra consentimientos y token de verificación (caso feliz)', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce(null); // no existe
      rolesRepo.findOne.mockResolvedValueOnce(ROL_CLIENTE);

      const resultado = await service.registro(dtoBase, { ip: '1.2.3.4' });

      expect(resultado.mensaje).toMatch(/Cuenta creada/);
      expect(usuariosRepo.save).toHaveBeenCalled();
      expect(consentimientosRepo.save).toHaveBeenCalled();
      const filasConsentimiento = consentimientosRepo.save.mock.calls[0][0];
      expect(filasConsentimiento).toHaveLength(3);
      expect(
        filasConsentimiento.find((f: any) => f.finalidad === 'marketing')
          .otorgado,
      ).toBe(false);
      expect(tokensRepo.save).toHaveBeenCalled();
    });

    it('rechaza si no acepta términos', async () => {
      await expect(
        service.registro({ ...dtoBase, aceptaTerminos: false }, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el email ya existe', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({
        id: 5,
        email: dtoBase.email,
      });
      await expect(service.registro(dtoBase, {})).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('inicia sesión con credenciales correctas', async () => {
      const passwordHash = await argon2.hash('claveSegura1', {
        type: argon2.argon2id,
      });
      const usuarioGuardado = {
        id: 10,
        email: 'cliente@rune.cl',
        passwordHash,
        nombre: 'Cliente',
        activo: true,
        emailVerificado: true,
        intentosLogin: 0,
        bloqueadoHasta: null,
        rol: { id: 2, nombre: 'cliente' },
      };
      usuariosRepo.findOne.mockResolvedValueOnce(usuarioGuardado);

      const resultado = await service.login(
        { email: 'cliente@rune.cl', password: 'claveSegura1' },
        { ip: '1.1.1.1' },
      );

      expect(resultado.accessToken).toBeDefined();
      expect(resultado.refreshToken).toBeDefined();
      expect(resultado.usuario.rol).toBe('cliente');
      expect(usuariosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ refreshTokenHash: expect.any(String) }),
      );
    });

    it('rechaza con mensaje genérico si el usuario no existe', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.login({ email: 'nadie@rune.cl', password: 'x' }, {}),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('bloquea la cuenta tras 5 intentos fallidos', async () => {
      const passwordHash = await argon2.hash('claveCorrecta1', {
        type: argon2.argon2id,
      });
      const usuarioBase = {
        id: 20,
        email: 'bloqueo@rune.cl',
        passwordHash,
        nombre: 'Bloqueo',
        activo: true,
        emailVerificado: true,
        intentosLogin: 4,
        bloqueadoHasta: null,
        rol: { id: 2, nombre: 'cliente' },
      };
      usuariosRepo.findOne.mockResolvedValueOnce({ ...usuarioBase });

      await expect(
        service.login({ email: usuarioBase.email, password: 'incorrecta' }, {}),
      ).rejects.toThrow(UnauthorizedException);

      const usuarioActualizado = usuariosRepo.save.mock.calls[0][0];
      expect(usuarioActualizado.intentosLogin).toBe(5);
      expect(usuarioActualizado.bloqueadoHasta).toBeInstanceOf(Date);
      expect(usuarioActualizado.bloqueadoHasta.getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('rechaza login aunque la contraseña sea correcta si sigue bloqueado', async () => {
      const passwordHash = await argon2.hash('claveCorrecta1', {
        type: argon2.argon2id,
      });
      usuariosRepo.findOne.mockResolvedValueOnce({
        id: 21,
        email: 'bloqueo2@rune.cl',
        passwordHash,
        activo: true,
        emailVerificado: true,
        intentosLogin: 5,
        bloqueadoHasta: new Date(Date.now() + 10 * 60 * 1000),
        rol: { id: 2, nombre: 'cliente' },
      });

      await expect(
        service.login(
          { email: 'bloqueo2@rune.cl', password: 'claveCorrecta1' },
          {},
        ),
      ).rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('refrescar', () => {
    it('rota el refresh token cuando el hash coincide', async () => {
      const passwordHash = await argon2.hash('claveSegura1', {
        type: argon2.argon2id,
      });
      const usuario = {
        id: 30,
        email: 'refresh@rune.cl',
        passwordHash,
        activo: true,
        emailVerificado: true,
        intentosLogin: 0,
        bloqueadoHasta: null,
        rol: { id: 2, nombre: 'cliente' },
      };
      usuariosRepo.findOne.mockResolvedValueOnce(usuario);
      const { refreshToken } = await service.login(
        { email: usuario.email, password: 'claveSegura1' },
        {},
      );

      const usuarioConHash = {
        ...usuario,
        refreshTokenHash: usuariosRepo.save.mock.calls[0][0].refreshTokenHash,
      };
      usuariosRepo.findOne.mockResolvedValueOnce(usuarioConHash);

      const nuevos = await service.refrescar(refreshToken);
      expect(nuevos.accessToken).toBeDefined();
      expect(nuevos.refreshToken).not.toBe(refreshToken);
    });

    it('invalida todas las sesiones si detecta reuso de un refresh token ya rotado', async () => {
      const passwordHash = await argon2.hash('claveSegura1', {
        type: argon2.argon2id,
      });
      const usuario = {
        id: 31,
        email: 'reuso@rune.cl',
        passwordHash,
        activo: true,
        emailVerificado: true,
        intentosLogin: 0,
        bloqueadoHasta: null,
        rol: { id: 2, nombre: 'cliente' },
      };
      usuariosRepo.findOne.mockResolvedValueOnce(usuario);
      const { refreshToken: tokenViejo } = await service.login(
        { email: usuario.email, password: 'claveSegura1' },
        {},
      );

      // El usuario ya rotó su token (hash en BD distinto al que presenta ahora)
      usuariosRepo.findOne.mockResolvedValueOnce({
        ...usuario,
        refreshTokenHash: 'hash-de-otro-token-ya-rotado',
      });

      await expect(service.refrescar(tokenViejo)).rejects.toThrow(
        UnauthorizedException,
      );
      const usuarioInvalidado = usuariosRepo.save.mock.calls.at(-1)[0];
      expect(usuarioInvalidado.refreshTokenHash).toBeNull();
    });

    it('rechaza si no viene token', async () => {
      await expect(service.refrescar(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('reset de password', () => {
    it('solicitarReset genera token cuando el usuario existe', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce({
        id: 40,
        email: 'a@rune.cl',
        activo: true,
      });
      const resultado = await service.solicitarReset({ email: 'a@rune.cl' });
      expect(tokensRepo.save).toHaveBeenCalled();
      expect(resultado.mensaje).toMatch(/Si el correo existe/);
    });

    it('solicitarReset responde igual aunque el usuario no exista (no filtra información)', async () => {
      usuariosRepo.findOne.mockResolvedValueOnce(null);
      const resultado = await service.solicitarReset({
        email: 'nadie@rune.cl',
      });
      expect(tokensRepo.save).not.toHaveBeenCalled();
      expect(resultado.mensaje).toMatch(/Si el correo existe/);
    });

    it('confirmarReset actualiza password con token válido', async () => {
      tokensRepo.findOne.mockResolvedValueOnce({
        id: 1,
        usuarioId: 40,
        tipo: 'reset_password',
        usadoEn: null,
        expiraEn: new Date(Date.now() + 60 * 60 * 1000),
      });

      const resultado = await service.confirmarReset({
        token: 'token-plano-de-prueba',
        passwordNueva: 'nuevaClave123',
      });

      expect(resultado.mensaje).toMatch(/actualizada/);
      expect(usuariosRepo.update).toHaveBeenCalledWith(
        { id: 40 },
        expect.objectContaining({ refreshTokenHash: null, intentosLogin: 0 }),
      );
    });

    it('confirmarReset rechaza token expirado', async () => {
      tokensRepo.findOne.mockResolvedValueOnce({
        id: 2,
        usuarioId: 41,
        tipo: 'reset_password',
        usadoEn: null,
        expiraEn: new Date(Date.now() - 1000),
      });

      await expect(
        service.confirmarReset({
          token: 'expirado',
          passwordNueva: 'nuevaClave123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cambiarPassword', () => {
    it('actualiza la contraseña cuando la actual es correcta', async () => {
      const passwordHash = await argon2.hash('claveVieja123', {
        type: argon2.argon2id,
      });
      usuariosRepo.findOne.mockResolvedValueOnce({
        id: 50,
        passwordHash,
      });

      const resultado = await service.cambiarPassword(50, {
        passwordActual: 'claveVieja123',
        passwordNueva: 'claveNueva456',
      });

      expect(resultado.mensaje).toMatch(/actualizada/);
      expect(usuariosRepo.save).toHaveBeenCalled();
      const guardado = usuariosRepo.save.mock.calls[0][0];
      expect(guardado.passwordHash).not.toBe(passwordHash);
    });

    it('rechaza si la contraseña actual es incorrecta', async () => {
      const passwordHash = await argon2.hash('claveVieja123', {
        type: argon2.argon2id,
      });
      usuariosRepo.findOne.mockResolvedValueOnce({ id: 51, passwordHash });

      await expect(
        service.cambiarPassword(51, {
          passwordActual: 'claveIncorrecta',
          passwordNueva: 'claveNueva456',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(usuariosRepo.save).not.toHaveBeenCalled();
    });
  });
});
