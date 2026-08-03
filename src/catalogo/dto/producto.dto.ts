import { Type } from 'class-transformer';
import {
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

  /** "blanco" = polera base sin estampar (bodega interna, nunca visible en la tienda pública) */
  @IsIn(['blanco', 'estampado'])
  tipoProducto: 'blanco' | 'estampado';

  @IsInt()
  categoriaId: number;

  /** Requerido solo si tipoProducto=estampado — validado en el servicio, no acá */
  @IsOptional()
  @IsInt()
  @IsPositive()
  precio?: number;

  /** Requerido solo si tipoProducto=blanco — validado en el servicio, no acá */
  @IsOptional()
  @IsInt()
  @IsPositive()
  costo?: number;

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

  // tipoProducto NO se edita: insumo y producto terminado son flujos separados
  // (2 inventarios); cambiar de tipo implicaría perder precio/costo con sentido.

  @IsOptional()
  @IsInt()
  categoriaId?: number;

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

/** Cambio de costo de un insumo (tipoProducto=blanco) — sin historial, no fiscaliza SERNAC como el precio */
export class ActualizarCostoDto {
  @IsInt()
  @IsPositive()
  costo: number;
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

export class CrearTallaDto {
  @IsString()
  @MaxLength(10)
  codigo: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
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

/** Filtros del listado de inventario en el admin — a diferencia de QueryCatalogoDto, sí incluye tipoProducto (blanco/estampado) */
export class QueryInventarioDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['blanco', 'estampado'])
  tipoProducto?: 'blanco' | 'estampado';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoriaId?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  stockBajo?: boolean;

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
