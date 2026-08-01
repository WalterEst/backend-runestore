import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import { Ticket } from '../database/entities/ticket.entity';
import { TicketMensaje } from '../database/entities/ticket-mensaje.entity';
import {
  CrearMensajeAdminDto,
  CrearMensajeDto,
  CrearTicketDto,
  ActualizarTicketAdminDto,
} from './dto/ticket.dto';

const MAX_INTENTOS_NUMERO = 5;

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketMensaje)
    private readonly mensajes: Repository<TicketMensaje>,
  ) {}

  async crear(usuarioId: number, dto: CrearTicketDto): Promise<Ticket> {
    const numero = await this.generarNumeroUnico();
    const ticket = await this.tickets.save(
      this.tickets.create({
        numero,
        usuarioId,
        ordenId: dto.ordenId ?? null,
        asunto: dto.asunto,
        categoria: dto.categoria,
        prioridad: 'media',
        estado: 'abierto',
      }),
    );

    await this.mensajes.save(
      this.mensajes.create({
        ticketId: ticket.id,
        usuarioId,
        mensaje: sanitizeHtml(dto.mensaje, { allowedTags: [] }),
        esInterno: false,
      }),
    );

    return ticket;
  }

  async listarPropios(usuarioId: number): Promise<Ticket[]> {
    return this.tickets.find({
      where: { usuarioId },
      order: { creadoEn: 'DESC' },
    });
  }

  async obtenerPropio(ticketId: number, usuarioId: number) {
    const ticket = await this.obtenerTicketOFallar(ticketId);
    if (ticket.usuarioId !== usuarioId) {
      throw new ForbiddenException('Este ticket no te pertenece');
    }
    // El cliente nunca ve las notas internas entre agentes — ver CLAUDE.md
    const mensajes = await this.mensajes.find({
      where: { ticketId, esInterno: false },
      order: { creadoEn: 'ASC' },
    });
    return { ...ticket, mensajes };
  }

  async agregarMensajePropio(
    ticketId: number,
    usuarioId: number,
    dto: CrearMensajeDto,
  ): Promise<TicketMensaje> {
    const ticket = await this.obtenerTicketOFallar(ticketId);
    if (ticket.usuarioId !== usuarioId) {
      throw new ForbiddenException('Este ticket no te pertenece');
    }
    if (ticket.estado === 'cerrado') {
      throw new ForbiddenException('Este ticket está cerrado');
    }

    const mensaje = await this.mensajes.save(
      this.mensajes.create({
        ticketId,
        usuarioId,
        mensaje: sanitizeHtml(dto.mensaje, { allowedTags: [] }),
        adjuntoUrl: dto.adjuntoUrl ?? null,
        esInterno: false,
      }),
    );

    // El cliente escribió: vuelve a "abierto" si el agente estaba esperando su respuesta
    if (ticket.estado === 'esperando_cliente') {
      await this.tickets.update({ id: ticketId }, { estado: 'abierto' });
    }

    return mensaje;
  }

  // --- Admin / soporte ---

  async listarAdmin(estado?: string): Promise<Ticket[]> {
    return this.tickets.find({
      where: estado ? { estado: estado as Ticket['estado'] } : {},
      relations: { usuario: true, agente: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async obtenerAdmin(ticketId: number) {
    const ticket = await this.obtenerTicketOFallar(ticketId);
    const mensajes = await this.mensajes.find({
      where: { ticketId },
      relations: { usuario: true },
      order: { creadoEn: 'ASC' },
    });
    return { ...ticket, mensajes };
  }

  async agregarMensajeAdmin(
    ticketId: number,
    agenteId: number,
    dto: CrearMensajeAdminDto,
  ): Promise<TicketMensaje> {
    await this.obtenerTicketOFallar(ticketId);
    return this.mensajes.save(
      this.mensajes.create({
        ticketId,
        usuarioId: agenteId,
        mensaje: sanitizeHtml(dto.mensaje, { allowedTags: [] }),
        adjuntoUrl: dto.adjuntoUrl ?? null,
        esInterno: !!dto.esInterno,
      }),
    );
  }

  async actualizarAdmin(
    ticketId: number,
    dto: ActualizarTicketAdminDto,
  ): Promise<Ticket> {
    const ticket = await this.obtenerTicketOFallar(ticketId);
    Object.assign(ticket, dto);
    if (dto.estado === 'cerrado' || dto.estado === 'resuelto') {
      ticket.cerradoEn = new Date();
    }
    return this.tickets.save(ticket);
  }

  private async obtenerTicketOFallar(ticketId: number): Promise<Ticket> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  private async generarNumeroUnico(): Promise<string> {
    const anio = new Date().getFullYear();
    for (let intento = 0; intento < MAX_INTENTOS_NUMERO; intento++) {
      const numero = `TCK-${anio}-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existente = await this.tickets.findOne({ where: { numero } });
      if (!existente) return numero;
    }
    throw new Error('No se pudo generar un número de ticket único');
  }
}
