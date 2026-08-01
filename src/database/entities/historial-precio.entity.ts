import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Producto } from './producto.entity';
import { Usuario } from './usuario.entity';

/**
 * Poblada por los triggers trg_historial_precio / trg_historial_precio_alta (ver RunarStore.sql):
 * capturan todo cambio de precio aunque se haga por SQL directo. NestJS solo debe INSERTAR
 * usuario_id + motivo cuando el cambio viene del panel admin — no duplicar la lógica del trigger.
 */
@Entity('historial_precios')
@Index('idx_hp_producto_fecha', ['productoId', 'creadoEn'])
export class HistorialPrecio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'producto_id', type: 'bigint', unsigned: true })
  productoId: number;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({
    name: 'precio_anterior',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  precioAnterior: number | null;

  @Column({
    name: 'precio_nuevo',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  precioNuevo: number;

  @Column({
    name: 'oferta_anterior',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  ofertaAnterior: number | null;

  @Column({
    name: 'oferta_nueva',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  ofertaNueva: number | null;

  @Column({
    name: 'usuario_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  motivo: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
