import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsuarioActual } from '../auth/decorators/usuario-actual.decorator';
import type { JwtPayload } from '../auth/types';
import { R2Service } from '../common/r2/r2.service';
import { PresignedUrlDto } from '../catalogo/dto/presigned-url.dto';
import { CrearMensajeDto, CrearTicketDto } from './dto/ticket.dto';
import { CompraVerificadaGuard } from './guards/compra-verificada.guard';
import { TicketsService } from './tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly r2Service: R2Service,
  ) {}

  @Get()
  listarPropios(@UsuarioActual() usuario: JwtPayload) {
    return this.ticketsService.listarPropios(usuario.sub);
  }

  @Get(':id')
  obtenerPropio(
    @UsuarioActual() usuario: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.ticketsService.obtenerPropio(id, usuario.sub);
  }

  /** Guard adicional: solo con al menos una compra confirmada — ver CLAUDE.md */
  @Post()
  @UseGuards(CompraVerificadaGuard)
  crear(@UsuarioActual() usuario: JwtPayload, @Body() dto: CrearTicketDto) {
    return this.ticketsService.crear(usuario.sub, dto);
  }

  @Post(':id/mensajes')
  agregarMensaje(
    @UsuarioActual() usuario: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearMensajeDto,
  ) {
    return this.ticketsService.agregarMensajePropio(id, usuario.sub, dto);
  }

  @Post('adjuntos/presigned-url')
  generarPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.r2Service.generarUrlSubida(dto.mimeType, 'tickets');
  }
}
