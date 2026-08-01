import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Orden } from './orden.entity';
import { Producto } from './producto.entity';
import { Usuario } from './usuario.entity';

/** Solo compra verificada: NestJS valida que la orden pagada del usuario contenga el producto */
@Entity('resenas')
@Unique('uq_resena', ['productoId', 'usuarioId'])
export class Resena {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'producto_id', type: 'bigint', unsigned: true })
  productoId: number;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
  usuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true })
  ordenId: number;

  @ManyToOne(() => Orden)
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @Column({ type: 'tinyint', unsigned: true })
  puntuacion: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  titulo: string | null;

  @Column({ type: 'text', nullable: true })
  comentario: string | null;

  @Column({
    name: 'talla_comprada',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  tallaComprada: string | null;

  /** Moderación previa anti-spam: 0 por defecto */
  @Column({
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  aprobada: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
