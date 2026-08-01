import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Categoria } from './categoria.entity';
import { Producto } from './producto.entity';
import { Promocion } from './promocion.entity';

/**
 * PK propia (no compuesta): MySQL exige NOT NULL en toda columna de una PRIMARY KEY,
 * pero producto_id/categoria_id deben poder ser NULL (una fila es "por producto" o
 * "por categoría", nunca ambas) — ver RunarStore.sql. La UNIQUE KEY reemplaza el rol
 * de no-duplicados que tendría la PK compuesta.
 */
@Entity('promocion_productos')
@Unique('uq_promocion_producto_categoria', [
  'promocionId',
  'productoId',
  'categoriaId',
])
export class PromocionProducto {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'promocion_id', type: 'bigint', unsigned: true })
  promocionId: number;

  @ManyToOne(() => Promocion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promocion_id' })
  promocion: Promocion;

  /** Producto específico (NULL si aplica por categoría) */
  @Column({
    name: 'producto_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  productoId: number | null;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto | null;

  /** Categoría completa en promo (NULL si aplica por producto) */
  @Column({ name: 'categoria_id', type: 'int', unsigned: true, nullable: true })
  categoriaId: number | null;

  @ManyToOne(() => Categoria, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria | null;
}
