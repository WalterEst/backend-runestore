import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Orden } from './orden.entity';
import { ProductoVariante } from './producto-variante.entity';

/** Snapshots inmutables: la orden es un documento histórico, nunca se edita */
@Entity('orden_items')
export class OrdenItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true })
  ordenId: number;

  @ManyToOne(() => Orden, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @Column({
    name: 'variante_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  varianteId: number | null;

  @ManyToOne(() => ProductoVariante, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'variante_id' })
  variante: ProductoVariante | null;

  @Column({ name: 'nombre_producto', type: 'varchar', length: 150 })
  nombreProducto: string;

  @Column({ type: 'varchar', length: 10 })
  talla: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 60 })
  sku: string;

  /** Precio efectivamente cobrado, inmutable */
  @Column({
    name: 'precio_unitario',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  precioUnitario: number;

  @Column({ type: 'smallint', unsigned: true })
  cantidad: number;
}
