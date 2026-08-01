import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  CategoriaTicket,
  EstadoTicket,
  PrioridadTicket,
} from '../../database/entities/ticket.entity';

const CATEGORIAS: CategoriaTicket[] = [
  'envio',
  'cambio_devolucion',
  'producto_defectuoso',
  'pago',
  'otro',
];
const PRIORIDADES: PrioridadTicket[] = ['baja', 'media', 'alta'];
const ESTADOS: EstadoTicket[] = [
  'abierto',
  'en_proceso',
  'esperando_cliente',
  'resuelto',
  'cerrado',
];

export class CrearTicketDto {
  @IsString()
  @MaxLength(150)
  asunto: string;

  @IsIn(CATEGORIAS)
  categoria: CategoriaTicket;

  @IsOptional()
  @IsInt()
  ordenId?: number;

  @IsString()
  @MaxLength(4000)
  mensaje: string;
}

export class CrearMensajeDto {
  @IsString()
  @MaxLength(4000)
  mensaje: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adjuntoUrl?: string;
}

export class CrearMensajeAdminDto extends CrearMensajeDto {
  @IsOptional()
  @IsBoolean()
  esInterno?: boolean;
}

export class ActualizarTicketAdminDto {
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoTicket;

  @IsOptional()
  @IsIn(PRIORIDADES)
  prioridad?: PrioridadTicket;

  @IsOptional()
  @IsInt()
  asignadoA?: number;
}
