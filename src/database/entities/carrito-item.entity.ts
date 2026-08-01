import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Carrito } from './carrito.entity';
import { ProductoVariante } from './producto-variante.entity';

@Entity('carrito_items')
@Unique('uq_carrito_variante', ['carritoId', 'varianteId'])
export class CarritoItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'carrito_id', type: 'bigint', unsigned: true })
  carritoId: number;

  @ManyToOne(() => Carrito, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'carrito_id' })
  carrito: Carrito;

  @Column({ name: 'variante_id', type: 'bigint', unsigned: true })
  varianteId: number;

  @ManyToOne(() => ProductoVariante, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variante_id' })
  variante: ProductoVariante;

  @Column({ type: 'smallint', unsigned: true, default: 1 })
  cantidad: number;

  /** Precio congelado al agregar al carrito */
  @Column({
    name: 'precio_unitario',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  precioUnitario: number;

  @CreateDateColumn({ name: 'agregado_en', type: 'datetime' })
  agregadoEn: Date;
}
