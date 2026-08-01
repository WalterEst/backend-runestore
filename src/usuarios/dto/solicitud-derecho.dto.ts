import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { TipoSolicitudDerecho } from '../../database/entities/solicitud-derecho.entity';

const TIPOS: TipoSolicitudDerecho[] = [
  'acceso',
  'rectificacion',
  'supresion',
  'oposicion',
  'portabilidad',
  'bloqueo',
];

export class CrearSolicitudDerechoDto {
  /** Solo para invitados sin sesión (identifica al titular por email) */
  @IsOptional()
  @IsEmail()
  @MaxLength(191)
  email?: string;

  @IsIn(TIPOS)
  tipo: TipoSolicitudDerecho;

  @IsOptional()
  @IsString()
  detalle?: string;
}

export class ResolverSolicitudDto {
  @IsIn(['completada', 'rechazada'])
  estado: 'completada' | 'rechazada';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  respuesta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  motivoRechazo?: string;
}
