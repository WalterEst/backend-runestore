import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Categoria } from './categoria.entity';

@Entity('productos')
@Index('idx_producto_anime', ['anime'])
export class Producto {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  slug: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    name: 'descripcion_corta',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  descripcionCorta: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  anime: string | null;

  /**
   * "blanco" = polera base sin estampar, insumo de bodega — nunca se muestra en la tienda
   * pública. "estampado" = producto terminado/colección que sí se vende. Ver CLAUDE.md.
   */
  @Column({
    name: 'tipo_producto',
    type: 'enum',
    enum: ['blanco', 'estampado'],
    default: 'estampado',
  })
  tipoProducto: 'blanco' | 'estampado';

  @Column({ name: 'categoria_id', type: 'int', unsigned: true })
  categoriaId: number;

  /** Categoría única: tipo de prenda (Poleras/Polerones/Pantalones), mutuamente excluyente */
  @ManyToOne(() => Categoria)
  @JoinColumn({ name: 'categoria_id' })
  categoria: Categoria;

  /** Solo tipo_producto=estampado. DECIMAL(10,0) — CLP entero, nunca float. Ver CLAUDE.md */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  precio: number | null;

  @Column({
    name: 'precio_oferta',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  precioOferta: number | null;

  /** Solo tipo_producto=blanco: costo de compra del insumo (no se vende, no tiene precio) */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  costo: number | null;

  @Column({
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  destacado: boolean;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime' })
  actualizadoEn: Date;
}
