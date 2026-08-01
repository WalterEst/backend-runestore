import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../../auth/types';
import { CancelarOrdenDto } from '../dto/cancelar-orden.dto';
import { OrdenesService } from '../ordenes.service';

/** Bodeguero ve y prepara órdenes; solo admin cancela — ver Parte 5.1 del documento maestro */
@Controller('admin/pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'bodeguero')
export class OrdenesAdminController {
  constructor(private readonly ordenesService: OrdenesService) {}

  @Get()
  listar(@Query('estado') estado?: string) {
    return this.ordenesService.listarAdmin(estado);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.ordenesService.obtenerAdmin(id);
  }

  @Patch(':id/cancelar')
  @Roles('admin')
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarOrdenDto,
    @UsuarioActual() usuario: JwtPayload,
    @Req() req: Request,
  ) {
    return this.ordenesService.cancelar(id, dto.motivo, usuario.sub, req.ip);
  }
}
