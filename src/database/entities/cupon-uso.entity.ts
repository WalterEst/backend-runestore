import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Cupon } from './cupon.entity';
import { Orden } from './orden.entity';
import { Usuario } from './usuario.entity';

@Entity('cupon_usos')
export class CuponUso {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'cupon_id', type: 'bigint', unsigned: true })
  cuponId: number;

  @ManyToOne(() => Cupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cupon_id' })
  cupon: Cupon;

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
  usuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true })
  ordenId: number;

  @ManyToOne(() => Orden)
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @CreateDateColumn({ name: 'usado_en', type: 'datetime' })
  usadoEn: Date;
}
