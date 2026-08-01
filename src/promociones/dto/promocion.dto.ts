import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearPromocionDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsIn(['porcentaje', 'monto_fijo'])
  tipo: 'porcentaje' | 'monto_fijo';

  @IsNumber()
  @IsPositive()
  valor: number;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;

  /**
   * Solo se soportan promociones de tienda completa por ahora. El defecto de esquema que
   * bloqueaba insertar filas en `promocion_productos` ya se corrigió (PK propia + UNIQUE,
   * ver promocion-producto.entity.ts), pero el servicio todavía no implementa la lógica de
   * descuento por producto/categoría — eso es trabajo de una fase futura, no un bloqueo técnico.
   */
  @IsOptional()
  @IsBoolean()
  aplicaTodo?: boolean;
}

export class ActualizarPromocionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valor?: number;

  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
