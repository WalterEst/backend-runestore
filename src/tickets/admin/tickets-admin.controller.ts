import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UsuarioActual } from '../../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../../auth/types';
import {
  ActualizarTicketAdminDto,
  CrearMensajeAdminDto,
} from '../dto/ticket.dto';
import { TicketsService } from '../tickets.service';

/** Soporte gestiona tickets; admin también — ver Parte 5.1 del documento maestro */
@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'soporte')
export class TicketsAdminController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  listar(@Query('estado') estado?: string) {
    return this.ticketsService.listarAdmin(estado);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.obtenerAdmin(id);
  }

  @Post(':id/mensajes')
  agregarMensaje(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearMensajeAdminDto,
    @UsuarioActual() usuario: JwtPayload,
  ) {
    return this.ticketsService.agregarMensajeAdmin(id, usuario.sub, dto);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarTicketAdminDto,
  ) {
    return this.ticketsService.actualizarAdmin(id, dto);
  }
}
