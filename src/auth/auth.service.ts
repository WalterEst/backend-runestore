import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { Repository } from 'typeorm';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { Pagina } from '../database/entities/pagina.entity';
import { Rol } from '../database/entities/rol.entity';
import { TokenUsuario } from '../database/entities/token-usuario.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { EmailService } from '../common/email/email.service';
import { TurnstileService } from '../common/turnstile/turnstile.service';
import {
  cifrarTotpSecret,
  descifrarTotpSecret,
} from '../common/util/totp-crypto.util';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { ConfirmarResetDto, SolicitarResetDto } from './dto/reset-password.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { DesactivarTotpDto } from './dto/totp.dto';
import { JwtDosFaPendientePayload, JwtPayload, JwtRefreshPayload } from './types';

const NOMBRE_EMISOR_TOTP = 'RUNE';
const EXPIRACION_DESAFIO_2FA = '5m';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales inválidas';
const MAX_INTENTOS_LOGIN = 5;
const BLOQUEO_MINUTOS = 15;

interface DatosContexto {
  ip?: string;
  userAgent?: string;
}

interface TokensEmitidos {
  accessToken: string;
  refreshToken: string;
}

export type SesionEmitida = TokensEmitidos & {
  usuario: { id: number; nombre: string; rol: string };
};

/** El login puede terminar en una sesión completa, o pedir el segundo paso (2FA) primero */
type ResultadoLogin = SesionEmitida | { requiere2fa: true; tokenTemporal: string };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Rol) private readonly roles: Repository<Rol>,
    @InjectRepository(TokenUsuario)
    private readonly tokensUsuario: Repository<TokenUsuario>,
    @InjectRepository(Consentimiento)
    private readonly consentimientos: Repository<Consentimiento>,
    @InjectRepository(Pagina) private readonly paginas: Repository<Pagina>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly turnstile: TurnstileService,
    private readonly emailService: EmailService,
  ) {}

  async registro(
    dto: RegistroDto,
    ctx: DatosContexto,
  ): Promise<{ mensaje: string }> {
    await this.turnstile.verificar(dto.turnstileToken, ctx.ip);

    if (!dto.aceptaTerminos) {
      throw new BadRequestException(
        'Debe aceptar los términos y condiciones y la política de privacidad',
      );
    }

    const existente = await this.usuarios.findOne({
      where: { email: dto.email },
    });
    if (existente) {
      throw new ConflictException('Ya existe una cuenta con este correo');
    }

    const rolCliente = await this.roles.findOne({
      where: { nombre: 'cliente' },
    });
    if (!rolCliente) {
      throw new BadRequestException(
        'Rol "cliente" no existe en la base de datos',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const usuario = await this.usuarios.save(
      this.usuarios.create({
        rolId: rolCliente.id,
        email: dto.email,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        telefono: dto.telefono ?? null,
        aceptaMarketing: !!dto.aceptaMarketing,
        emailVerificado: false,
        activo: true,
      }),
    );

    await this.registrarConsentimientosRegistro(usuario, dto, ctx);
    await this.emitirTokenVerificacionEmail(usuario);

    return {
      mensaje:
        'Cuenta creada. Revisa tu correo para verificar tu cuenta antes de iniciar sesión.',
    };
  }

  async login(dto: LoginDto, ctx: DatosContexto): Promise<ResultadoLogin> {
    const usuario = await this.usuarios.findOne({
      where: { email: dto.email },
      relations: { rol: true },
    });

    // Mismo mensaje exista o no la cuenta, esté bloqueada o no: no filtrar información (CLAUDE.md)
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    if (
      usuario.bloqueadoHasta &&
      usuario.bloqueadoHasta.getTime() > Date.now()
    ) {
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const passwordValida = await argon2.verify(
      usuario.passwordHash,
      dto.password,
    );
    if (!passwordValida) {
      await this.registrarIntentoFallido(usuario);
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    if (!usuario.emailVerificado) {
      throw new UnauthorizedException(
        'Debes verificar tu correo antes de iniciar sesión',
      );
    }

    usuario.intentosLogin = 0;
    usuario.bloqueadoHasta = null;
    await this.usuarios.save(usuario);

    if (usuario.totpHabilitado) {
      this.logger.log(
        `Contraseña OK, esperando 2FA: usuario_id=${usuario.id} ip=${ctx.ip ?? '-'}`,
      );
      const tokenTemporal = await this.jwtService.signAsync(
        { sub: usuario.id, tipo: '2fa_pendiente' } satisfies JwtDosFaPendientePayload,
        {
          secret: this.config.get<string>('jwt.secret'),
          expiresIn: EXPIRACION_DESAFIO_2FA,
        },
      );
      return { requiere2fa: true, tokenTemporal };
    }

    return this.emitirSesion(usuario, ctx);
  }

  /** Segundo paso del login cuando el usuario tiene 2FA activado (ver login()) */
  async verificarLoginTotp(
    tokenTemporal: string,
    codigo: string,
    ctx: DatosContexto,
  ): Promise<SesionEmitida> {
    let payload: JwtDosFaPendientePayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtDosFaPendientePayload>(
        tokenTemporal,
        { secret: this.config.get<string>('jwt.secret') },
      );
    } catch {
      throw new UnauthorizedException('Sesión de verificación inválida o expirada');
    }
    if (payload.tipo !== '2fa_pendiente') {
      throw new UnauthorizedException('Sesión de verificación inválida');
    }

    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub },
      relations: { rol: true },
    });
    if (!usuario || !usuario.activo || !usuario.totpHabilitado || !usuario.totpSecret) {
      throw new UnauthorizedException('Sesión de verificación inválida');
    }

    const secretoPlano = descifrarTotpSecret(usuario.totpSecret);
    if (!authenticator.check(codigo, secretoPlano)) {
      throw new UnauthorizedException('Código incorrecto');
    }

    return this.emitirSesion(usuario, ctx);
  }

  /** Últimos pasos comunes de un login válido (con o sin 2FA): emitir tokens y guardar sesión */
  private async emitirSesion(
    usuario: Usuario,
    ctx: DatosContexto,
  ): Promise<SesionEmitida> {
    const tokens = await this.emitirTokens(usuario);
    usuario.refreshTokenHash = this.hashToken(tokens.refreshToken);
    await this.usuarios.save(usuario);

    this.logger.log(
      `Login exitoso: usuario_id=${usuario.id} ip=${ctx.ip ?? '-'}`,
    );

    const rolNombre =
      usuario.rol?.nombre ?? (await this.obtenerNombreRol(usuario.rolId));
    return {
      ...tokens,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: rolNombre,
      },
    };
  }

  /** Genera un secreto TOTP nuevo (pendiente de confirmar) + su QR — no activa el 2FA todavía */
  async generarTotp(usuarioId: number): Promise<{ secret: string; qrDataUrl: string }> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (usuario.totpHabilitado) {
      throw new BadRequestException(
        'La verificación en dos pasos ya está activada. Desactívala antes de generar un código nuevo.',
      );
    }

    const secret = authenticator.generateSecret();
    usuario.totpSecret = cifrarTotpSecret(secret);
    await this.usuarios.save(usuario);

    const otpauth = authenticator.keyuri(usuario.email, NOMBRE_EMISOR_TOTP, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    return { secret, qrDataUrl };
  }

  /** Confirma el código generado desde una app como Google Authenticator y activa el 2FA */
  async confirmarTotp(
    usuarioId: number,
    codigo: string,
  ): Promise<{ mensaje: string }> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (!usuario.totpSecret) {
      throw new BadRequestException(
        'Primero genera el código QR desde "Activar verificación en dos pasos"',
      );
    }
    if (usuario.totpHabilitado) {
      throw new BadRequestException('La verificación en dos pasos ya está activada');
    }

    const secretoPlano = descifrarTotpSecret(usuario.totpSecret);
    if (!authenticator.check(codigo, secretoPlano)) {
      throw new UnauthorizedException('Código incorrecto');
    }

    usuario.totpHabilitado = true;
    await this.usuarios.save(usuario);
    return { mensaje: 'Verificación en dos pasos activada' };
  }

  /** Exige la contraseña actual para desactivar el 2FA — evita que una sesión robada lo desactive sola */
  async desactivarTotp(
    usuarioId: number,
    dto: DesactivarTotpDto,
  ): Promise<{ mensaje: string }> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordValida = await argon2.verify(
      usuario.passwordHash,
      dto.password,
    );
    if (!passwordValida) {
      throw new BadRequestException('La contraseña es incorrecta');
    }

    usuario.totpSecret = null;
    usuario.totpHabilitado = false;
    await this.usuarios.save(usuario);
    return { mensaje: 'Verificación en dos pasos desactivada' };
  }

  async refrescar(refreshToken: string | undefined): Promise<TokensEmitidos> {
    if (!refreshToken) {
      throw new UnauthorizedException('Sesión inválida');
    }

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        refreshToken,
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
        },
      );
    } catch {
      throw new UnauthorizedException('Sesión inválida');
    }

    const usuario = await this.usuarios.findOne({
      where: { id: payload.sub },
      relations: { rol: true },
    });
    if (!usuario || !usuario.activo || !usuario.refreshTokenHash) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const hashRecibido = this.hashToken(refreshToken);
    if (hashRecibido !== usuario.refreshTokenHash) {
      // Reuso de un refresh token ya rotado: posible robo — invalidar todas las sesiones del usuario
      usuario.refreshTokenHash = null;
      await this.usuarios.save(usuario);
      this.logger.warn(
        `Reuso de refresh token detectado: usuario_id=${usuario.id}. Todas las sesiones invalidadas.`,
      );
      throw new UnauthorizedException('Sesión inválida');
    }

    const tokens = await this.emitirTokens(usuario);
    usuario.refreshTokenHash = this.hashToken(tokens.refreshToken);
    await this.usuarios.save(usuario);

    return tokens;
  }

  async logout(usuarioId: number): Promise<void> {
    await this.usuarios.update({ id: usuarioId }, { refreshTokenHash: null });
  }

  async verificarEmail(dto: VerificarEmailDto): Promise<{ mensaje: string }> {
    const tokenHash = this.hashToken(dto.token);
    const registro = await this.tokensUsuario.findOne({
      where: { tokenHash, tipo: 'verificar_email' },
    });

    if (
      !registro ||
      registro.usadoEn ||
      registro.expiraEn.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Token de verificación inválido o expirado',
      );
    }

    registro.usadoEn = new Date();
    await this.tokensUsuario.save(registro);
    await this.usuarios.update(
      { id: registro.usuarioId },
      { emailVerificado: true },
    );

    return { mensaje: 'Cuenta verificada correctamente' };
  }

  async solicitarReset(dto: SolicitarResetDto): Promise<{ mensaje: string }> {
    const usuario = await this.usuarios.findOne({
      where: { email: dto.email },
    });

    // Respuesta idéntica exista o no el email (CLAUDE.md)
    if (usuario && usuario.activo) {
      const tokenPlano = randomBytes(32).toString('hex');
      await this.tokensUsuario.save(
        this.tokensUsuario.create({
          usuarioId: usuario.id,
          tipo: 'reset_password',
          tokenHash: this.hashToken(tokenPlano),
          expiraEn: new Date(Date.now() + 60 * 60 * 1000),
        }),
      );
      this.emailService.enviarResetPassword(usuario.email, tokenPlano);
    }

    return {
      mensaje:
        'Si el correo existe en nuestro sistema, enviamos un enlace para restablecer la contraseña.',
    };
  }

  async confirmarReset(dto: ConfirmarResetDto): Promise<{ mensaje: string }> {
    const tokenHash = this.hashToken(dto.token);
    const registro = await this.tokensUsuario.findOne({
      where: { tokenHash, tipo: 'reset_password' },
    });

    if (
      !registro ||
      registro.usadoEn ||
      registro.expiraEn.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Token de restablecimiento inválido o expirado',
      );
    }

    const passwordHash = await argon2.hash(dto.passwordNueva, {
      type: argon2.argon2id,
    });

    registro.usadoEn = new Date();
    await this.tokensUsuario.save(registro);
    await this.usuarios.update(
      { id: registro.usuarioId },
      {
        passwordHash,
        refreshTokenHash: null,
        intentosLogin: 0,
        bloqueadoHasta: null,
      },
    );

    return { mensaje: 'Contraseña actualizada correctamente' };
  }

  /** Cambio de contraseña autenticado (distinto del flujo de reset por email): exige la actual */
  async cambiarPassword(
    usuarioId: number,
    dto: CambiarPasswordDto,
  ): Promise<{ mensaje: string }> {
    const usuario = await this.usuarios.findOne({ where: { id: usuarioId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const passwordValida = await argon2.verify(
      usuario.passwordHash,
      dto.passwordActual,
    );
    if (!passwordValida) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    // No se toca refreshTokenHash: este esquema guarda un solo refresh token activo por
    // usuario (se sobrescribe en cada login/rotación), así que invalidarlo acá solo
    // cerraría la sesión actual sin ganar nada — no hay "otros dispositivos" que rastrear.
    usuario.passwordHash = await argon2.hash(dto.passwordNueva, {
      type: argon2.argon2id,
    });
    await this.usuarios.save(usuario);

    return { mensaje: 'Contraseña actualizada correctamente' };
  }

  private async registrarIntentoFallido(usuario: Usuario): Promise<void> {
    usuario.intentosLogin += 1;
    if (usuario.intentosLogin >= MAX_INTENTOS_LOGIN) {
      usuario.bloqueadoHasta = new Date(
        Date.now() + BLOQUEO_MINUTOS * 60 * 1000,
      );
    }
    await this.usuarios.save(usuario);
  }

  private async emitirTokens(usuario: Usuario): Promise<TokensEmitidos> {
    const rolNombre =
      usuario.rol?.nombre ?? (await this.obtenerNombreRol(usuario.rolId));
    const payloadAccess: JwtPayload = { sub: usuario.id, rol: rolNombre };
    const payloadRefresh: JwtRefreshPayload = {
      ...payloadAccess,
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payloadAccess, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.accessExpires'),
      } as JwtSignOptions),
      this.jwtService.signAsync(payloadRefresh, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpires'),
      } as JwtSignOptions),
    ]);

    return { accessToken, refreshToken };
  }

  private async obtenerNombreRol(rolId: number): Promise<string> {
    const rol = await this.roles.findOne({ where: { id: rolId } });
    return rol?.nombre ?? 'cliente';
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async emitirTokenVerificacionEmail(usuario: Usuario): Promise<void> {
    const tokenPlano = randomBytes(32).toString('hex');
    await this.tokensUsuario.save(
      this.tokensUsuario.create({
        usuarioId: usuario.id,
        tipo: 'verificar_email',
        tokenHash: this.hashToken(tokenPlano),
        expiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    );
    this.emailService.enviarVerificacionEmail(usuario.email, tokenPlano);
  }

  private async registrarConsentimientosRegistro(
    usuario: Usuario,
    dto: RegistroDto,
    ctx: DatosContexto,
  ): Promise<void> {
    const [paginaTerminos, paginaPrivacidad] = await Promise.all([
      this.paginas.findOne({ where: { slug: 'terminos-condiciones' } }),
      this.paginas.findOne({ where: { slug: 'politica-privacidad' } }),
    ]);

    const filas = [
      this.consentimientos.create({
        usuarioId: usuario.id,
        email: usuario.email,
        finalidad: 'terminos_condiciones' as const,
        paginaId: paginaTerminos?.id ?? null,
        version: paginaTerminos?.version ?? 1,
        otorgado: true,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
      this.consentimientos.create({
        usuarioId: usuario.id,
        email: usuario.email,
        finalidad: 'politica_privacidad' as const,
        paginaId: paginaPrivacidad?.id ?? null,
        version: paginaPrivacidad?.version ?? 1,
        otorgado: true,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
      // Marketing SIEMPRE se registra, otorgado=true solo si el checkbox (nunca premarcado) fue marcado
      this.consentimientos.create({
        usuarioId: usuario.id,
        email: usuario.email,
        finalidad: 'marketing' as const,
        paginaId: null,
        version: 1,
        otorgado: !!dto.aceptaMarketing,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
    ];

    await this.consentimientos.save(filas);
  }
}
