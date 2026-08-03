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
import { R2Service } from '../common/r2/r2.service';
import { PresignedUrlDto } from '../catalogo/dto/presigned-url.dto';
import { ActualizarAvatarDto } from './dto/avatar.dto';
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
    private readonly r2Service: R2Service,
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

  @Post('perfil/foto/presigned-url')
  @UseGuards(JwtAuthGuard)
  generarPresignedUrlAvatar(@Body() dto: PresignedUrlDto) {
    return this.r2Service.generarUrlSubida(dto.mimeType, 'avatares');
  }

  @Patch('perfil/foto')
  @UseGuards(JwtAuthGuard)
  actualizarAvatar(
    @UsuarioActual() usuario: JwtPayload,
    @Body() dto: ActualizarAvatarDto,
  ) {
    return this.usuariosService.actualizarAvatar(usuario.sub, dto.url);
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
