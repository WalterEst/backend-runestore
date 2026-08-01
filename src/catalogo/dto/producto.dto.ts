import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearProductoDto {
  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsString()
  descripcion: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcionCorta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  anime?: string;

  @IsInt()
  @IsPositive()
  precio: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  categoriaIds: number[];

  @IsOptional()
  @IsBoolean()
  destacado?: boolean;
}

export class ActualizarProductoDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcionCorta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  anime?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoriaIds?: number[];

  @IsOptional()
  @IsBoolean()
  destacado?: boolean;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/** El cambio de precio es su propio endpoint: exige motivo, lo exige la Parte 5.2 del doc maestro */
export class ActualizarPrecioDto {
  @IsInt()
  @IsPositive()
  precio: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  precioOferta?: number | null;

  @IsString()
  @MaxLength(150)
  motivo: string;
}

export class CrearVarianteDto {
  @IsInt()
  tallaId: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsString()
  @MaxLength(60)
  sku: string;

  @IsInt()
  @Min(0)
  stock: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  precioExtra?: number;
}

export class ActualizarVarianteDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  precioExtra?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class AjustarStockDto {
  /** Con signo: positivo entrada/devolución, negativo merma/ajuste — nunca puede dejar el stock negativo */
  @IsInt()
  cantidad: number;

  @IsIn(['entrada', 'ajuste', 'merma', 'devolucion'])
  tipo: 'entrada' | 'ajuste' | 'merma' | 'devolucion';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referencia?: string;
}

export class RegistrarImagenDto {
  @IsString()
  @MaxLength(500)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}

export class QueryCatalogoDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  destacado?: boolean;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  anime?: string;

  @IsOptional()
  @IsString()
  talla?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precioMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  precioMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number;
}
