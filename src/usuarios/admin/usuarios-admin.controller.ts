import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../../auth/types';
import { CambiarRolDto } from '../dto/admin-usuario.dto';
import { ResolverSolicitudDto } from '../dto/solicitud-derecho.dto';
import { SolicitudesDerechoService } from '../solicitudes-derecho.service';
import { UsuariosService } from '../usuarios.service';

/** Solo admin cambia roles y (des)activa cuentas — ver Parte 5.1 del documento maestro */
@Controller('admin/usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsuariosAdminController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly solicitudesService: SolicitudesDerechoService,
  ) {}

  @Get()
  listar() {
    return this.usuariosService.listarAdmin();
  }

  @Patch(':id/rol')
  cambiarRol(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarRolDto,
    @UsuarioActual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    return this.usuariosService.cambiarRol(id, dto.rol, usuario.sub, req.ip);
  }

  @Patch(':id/toggle-activo')
  toggleActivo(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    return this.usuariosService.toggleActivo(id, usuario.sub, req.ip);
  }

  /** Excepción al "solo admin" de la clase: soporte también atiende solicitudes de derechos (Parte 5.1) */
  @Get('solicitudes-derechos')
  @Roles('admin', 'soporte')
  listarSolicitudes() {
    return this.solicitudesService.listarAdmin();
  }

  @Post('solicitudes-derechos/:id/resolver')
  @Roles('admin', 'soporte')
  resolverSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolverSolicitudDto,
    @UsuarioActual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    return this.solicitudesService.resolver(id, dto, usuario.sub, req.ip);
  }
}
