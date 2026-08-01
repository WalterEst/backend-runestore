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
import { Usuario } from './usuario.entity';

export type EstadoCarrito = 'activo' | 'convertido' | 'abandonado';

@Entity('carritos')
export class Carrito {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'usuario_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  usuarioId: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario | null;

  /** Cookie de invitado; se fusiona al iniciar sesión */
  @Index('idx_carrito_session')
  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId: string | null;

  @Column({
    type: 'enum',
    enum: ['activo', 'convertido', 'abandonado'],
    default: 'activo',
  })
  estado: EstadoCarrito;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime' })
  actualizadoEn: Date;
}
