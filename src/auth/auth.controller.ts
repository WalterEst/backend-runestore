import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegistroDto } from './dto/registro.dto';
import { LoginDto } from './dto/login.dto';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { ConfirmarResetDto, SolicitarResetDto } from './dto/reset-password.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsuarioActual } from './decorators/usuario-actual.decorator';
import type { JwtPayload } from './types';

const NOMBRE_COOKIE_REFRESH = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('registro')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async registro(@Body() dto: RegistroDto, @Req() req: Request) {
    return this.authService.registro(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, usuario } = await this.authService.login(
      dto,
      {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, usuario };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      NOMBRE_COOKIE_REFRESH
    ];
    const tokens = await this.authService.refrescar(refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(
    @UsuarioActual() usuario: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(usuario.sub);
    res.clearCookie(NOMBRE_COOKIE_REFRESH, { path: '/api/v1/auth' });
    return { mensaje: 'Sesión cerrada' };
  }

  @Post('verificar-email')
  @HttpCode(HttpStatus.OK)
  async verificarEmail(@Body() dto: VerificarEmailDto) {
    return this.authService.verificarEmail(dto);
  }

  @Post('reset-password/solicitar')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async solicitarReset(@Body() dto: SolicitarResetDto) {
    return this.authService.solicitarReset(dto);
  }

  @Post('reset-password/confirmar')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmarReset(@Body() dto: ConfirmarResetDto) {
    return this.authService.confirmarReset(dto);
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  perfil(@UsuarioActual() usuario: JwtPayload) {
    return usuario;
  }

  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async cambiarPassword(
    @UsuarioActual() usuario: JwtPayload,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(usuario.sub, dto);
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(NOMBRE_COOKIE_REFRESH, refreshToken, {
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
