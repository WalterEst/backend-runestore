import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtAuthOpcionalGuard } from '../auth/guards/jwt-auth-opcional.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../auth/types';
import { ActualizarDireccionDto, CrearDireccionDto } from './dto/direccion.dto';
import { ActualizarPerfilDto } from './dto/perfil.dto';
import { CrearSolicitudDerechoDto } from './dto/solicitud-derecho.dto';
import { SolicitudesDerechoService } from './solicitudes-derecho.service';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly solicitudesService: SolicitudesDerechoService,
  ) {}

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  obtenerPerfil(@UsuarioActual() usuario: JwtPayload) {
    return this.usuariosService.obtenerPerfil(usuario.sub);
  }

  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  actualizarPerfil(
    @UsuarioActual() usuario: JwtPayload,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.usuariosService.actualizarPerfil(usuario.sub, dto);
  }

  @Get('direcciones')
  @UseGuards(JwtAuthGuard)
  listarDirecciones(@UsuarioActual() usuario: JwtPayload) {
    return this.usuariosService.listarDirecciones(usuario.sub);
  }

  @Post('direcciones')
  @UseGuards(JwtAuthGuard)
  crearDireccion(
    @UsuarioActual() usuario: JwtPayload,
    @Body() dto: CrearDireccionDto,
  ) {
    return this.usuariosService.crearDireccion(usuario.sub, dto);
  }

  @Patch('direcciones/:id')
  @UseGuards(JwtAuthGuard)
  actualizarDireccion(
    @UsuarioActual() usuario: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarDireccionDto,
  ) {
    return this.usuariosService.actualizarDireccion(usuario.sub, id, dto);
  }

  @Delete('direcciones/:id')
  @UseGuards(JwtAuthGuard)
  eliminarDireccion(
    @UsuarioActual() usuario: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.usuariosService.eliminarDireccion(usuario.sub, id);
  }

  @Get('exportar')
  @UseGuards(JwtAuthGuard)
  exportar(@UsuarioActual() usuario: JwtPayload) {
    return this.usuariosService.exportarDatos(usuario.sub);
  }

  /** Qué políticas subieron de versión desde la última vez que este usuario las aceptó */
  @Get('consentimientos-pendientes')
  @UseGuards(JwtAuthGuard)
  consentimientosPendientes(@UsuarioActual() usuario: JwtPayload) {
    return this.usuariosService.consentimientosPendientes(usuario.sub);
  }

  @Post('consentimientos/:slug/aceptar')
  @UseGuards(JwtAuthGuard)
  aceptarConsentimiento(
    @UsuarioActual() usuario: JwtPayload,
    @Param('slug') slug: string,
    @Req() req: Request,
  ) {
    return this.usuariosService.aceptarConsentimiento(usuario.sub, slug, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Invitados también pueden ejercer sus derechos (identificados por email) — ver CLAUDE.md */
  @Post('solicitudes-derechos')
  @UseGuards(JwtAuthOpcionalGuard)
  crearSolicitud(
    @UsuarioActual() usuario: JwtPayload | undefined,
    @Body() dto: CrearSolicitudDerechoDto,
    @Req() req: Request,
  ) {
    return this.solicitudesService.crear(
      { usuarioId: usuario?.sub, email: dto.email, ip: req.ip },
      dto,
    );
  }

  @Get('solicitudes-derechos')
  @UseGuards(JwtAuthGuard)
  listarSolicitudesPropias(@UsuarioActual() usuario: JwtPayload) {
    return this.solicitudesService.listarPropias(usuario.sub);
  }
}
