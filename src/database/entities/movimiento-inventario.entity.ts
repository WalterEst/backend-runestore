import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductoVariante } from './producto-variante.entity';
import { Usuario } from './usuario.entity';

export type TipoMovimientoInventario =
  'entrada' | 'venta' | 'devolucion' | 'ajuste' | 'merma';

@Entity('movimientos_inventario')
export class MovimientoInventario {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'variante_id', type: 'bigint', unsigned: true })
  varianteId: number;

  @ManyToOne(() => ProductoVariante)
  @JoinColumn({ name: 'variante_id' })
  variante: ProductoVariante;

  @Column({
    type: 'enum',
    enum: ['entrada', 'venta', 'devolucion', 'ajuste', 'merma'],
  })
  tipo: TipoMovimientoInventario;

  /** Con signo: +10 entrada, -1 venta */
  @Column({ type: 'int' })
  cantidad: number;

  /** Snapshot del stock resultante: detecta descuadres sin recalcular */
  @Column({ name: 'stock_resultante', type: 'int', unsigned: true })
  stockResultante: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  referencia: string | null;

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

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
