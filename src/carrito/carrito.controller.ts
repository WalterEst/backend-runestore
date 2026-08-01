import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthOpcionalGuard } from '../auth/guards/jwt-auth-opcional.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../auth/types';
import { CarritoService, ContextoCarrito } from './carrito.service';
import { ActualizarItemDto, AgregarItemDto } from './dto/carrito-item.dto';

const NOMBRE_COOKIE_CARRITO = 'cart_session';

@Controller('carrito')
@UseGuards(JwtAuthOpcionalGuard)
export class CarritoController {
  constructor(
    private readonly carritoService: CarritoService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async obtener(
    @Req() req: Request & { user?: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.carritoService.resumen(this.contexto(req));
    this.aplicarCookieSiCorresponde(res, resultado.sessionIdNueva);
    return this.sinSessionId(resultado);
  }

  @Post('items')
  async agregar(
    @Body() dto: AgregarItemDto,
    @Req() req: Request & { user?: JwtPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    const resultado = await this.carritoService.agregarItem(
      this.contexto(req),
      dto,
    );
    this.aplicarCookieSiCorresponde(res, resultado.sessionIdNueva);
    return this.sinSessionId(resultado);
  }

  @Patch('items/:id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarItemDto,
    @Req() req: Request & { user?: JwtPayload },
  ) {
    return this.carritoService.actualizarItem(this.contexto(req), id, dto);
  }

  @Delete('items/:id')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: JwtPayload },
  ) {
    return this.carritoService.eliminarItem(this.contexto(req), id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async vaciar(@Req() req: Request & { user?: JwtPayload }) {
    await this.carritoService.vaciar(this.contexto(req));
  }

  /** Se llama justo después de un login exitoso para traspasar el carrito de invitado */
  @Post('fusionar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async fusionar(
    @UsuarioActual() usuario: JwtPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[
      NOMBRE_COOKIE_CARRITO
    ];
    await this.carritoService.fusionar(usuario.sub, sessionId);
    res.clearCookie(NOMBRE_COOKIE_CARRITO, { path: '/' });
    return { mensaje: 'Carrito fusionado' };
  }

  /** La cookie ya se aplicó en la respuesta; sessionIdNueva es un detalle interno, no se expone */
  private sinSessionId<T extends { sessionIdNueva?: string }>(
    resultado: T,
  ): Omit<T, 'sessionIdNueva'> {
    return Object.fromEntries(
      Object.entries(resultado).filter(([clave]) => clave !== 'sessionIdNueva'),
    ) as Omit<T, 'sessionIdNueva'>;
  }

  private contexto(req: Request & { user?: JwtPayload }): ContextoCarrito {
    if (req.user) return { usuarioId: req.user.sub };
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[
      NOMBRE_COOKIE_CARRITO
    ];
    return { sessionId };
  }

  private aplicarCookieSiCorresponde(
    res: Response,
    sessionIdNueva?: string,
  ): void {
    if (!sessionIdNueva) return;
    res.cookie(NOMBRE_COOKIE_CARRITO, sessionIdNueva, {
      httpOnly: true,
      secure: this.config.get<string>('nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
