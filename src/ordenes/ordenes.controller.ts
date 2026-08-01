import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthOpcionalGuard } from '../auth/guards/jwt-auth-opcional.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../auth/types';
import { CrearOrdenDto } from './dto/crear-orden.dto';
import { OrdenesService } from './ordenes.service';

const NOMBRE_COOKIE_CARRITO = 'cart_session';

@Controller('ordenes')
export class OrdenesController {
  constructor(private readonly ordenesService: OrdenesService) {}

  /** Checkout: sirve tanto a usuarios logueados como a invitados (guest checkout) */
  @Post()
  @UseGuards(JwtAuthOpcionalGuard)
  crear(
    @Body() dto: CrearOrdenDto,
    @Req() req: Request & { user?: JwtPayload },
  ) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[
      NOMBRE_COOKIE_CARRITO
    ];
    const ctx = req.user ? { usuarioId: req.user.sub } : { sessionId };
    return this.ordenesService.crear(ctx, dto);
  }

  @Get('mias')
  @UseGuards(JwtAuthGuard)
  listarPropias(@UsuarioActual() usuario: JwtPayload) {
    return this.ordenesService.listarPropias(usuario.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  obtenerPropia(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: JwtPayload,
  ) {
    return this.ordenesService.obtenerPropia(id, usuario.sub);
  }

  /** Tracking para invitados: /ordenes/tracking/ORD-2026-XXXX?token=... */
  @Get('tracking/:numeroOrden')
  obtenerPorToken(
    @Param('numeroOrden') numeroOrden: string,
    @Query('token') token: string,
  ) {
    return this.ordenesService.obtenerPorToken(numeroOrden, token);
  }
}
