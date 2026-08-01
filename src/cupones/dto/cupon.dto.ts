import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearCuponDto {
  @IsString()
  @MaxLength(30)
  codigo: string;

  @IsIn(['porcentaje', 'monto_fijo', 'envio_gratis'])
  tipo: 'porcentaje' | 'monto_fijo' | 'envio_gratis';

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  montoMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsosTotal?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(255)
  limitePorUsuario?: number;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;
}

export class ActualizarCuponDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  limiteUsosTotal?: number;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ValidarCuponDto {
  @IsString()
  codigo: string;

  @IsInt()
  @Min(0)
  subtotal: number;
}
