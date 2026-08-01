import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Producto } from './producto.entity';
import { Talla } from './talla.entity';

@Entity('producto_variantes')
@Unique('uq_variante', ['productoId', 'tallaId', 'color'])
export class ProductoVariante {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'producto_id', type: 'bigint', unsigned: true })
  productoId: number;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ name: 'talla_id', type: 'tinyint', unsigned: true })
  tallaId: number;

  @ManyToOne(() => Talla)
  @JoinColumn({ name: 'talla_id' })
  talla: Talla;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 60, unique: true })
  sku: string;

  /** Stock físico total. El stock disponible real = stock - SUM(reservas vigentes) */
  @Column({ type: 'int', unsigned: true, default: 0 })
  stock: number;

  @Column({ name: 'stock_minimo', type: 'int', unsigned: true, default: 3 })
  stockMinimo: number;

  @Column({
    name: 'precio_extra',
    type: 'decimal',
    precision: 10,
    scale: 0,
    default: 0,
    transformer: moneyTransformer,
  })
  precioExtra: number;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activa: boolean;
}
