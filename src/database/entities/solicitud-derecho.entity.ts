import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

export type TipoSolicitudDerecho =
  | 'acceso'
  | 'rectificacion'
  | 'supresion'
  | 'oposicion'
  | 'portabilidad'
  | 'bloqueo';
export type EstadoSolicitudDerecho =
  'recibida' | 'en_proceso' | 'completada' | 'rechazada';

/** Ejercicio de derechos del titular — Ley 21.719. Todo rechazo debe fundarse en motivo_rechazo. */
@Entity('solicitudes_derechos')
@Index('idx_sd_estado', ['estado', 'recibidaEn'])
export class SolicitudDerecho {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

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

  @Column({ type: 'varchar', length: 191 })
  email: string;

  @Column({
    type: 'enum',
    enum: [
      'acceso',
      'rectificacion',
      'supresion',
      'oposicion',
      'portabilidad',
      'bloqueo',
    ],
  })
  tipo: TipoSolicitudDerecho;

  @Column({ type: 'text', nullable: true })
  detalle: string | null;

  @Column({
    type: 'enum',
    enum: ['recibida', 'en_proceso', 'completada', 'rechazada'],
    default: 'recibida',
  })
  estado: EstadoSolicitudDerecho;

  @Column({ type: 'text', nullable: true })
  respuesta: string | null;

  @Column({
    name: 'motivo_rechazo',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  motivoRechazo: string | null;

  @CreateDateColumn({ name: 'recibida_en', type: 'datetime' })
  recibidaEn: Date;

  @Column({ name: 'resuelta_en', type: 'datetime', nullable: true })
  resueltaEn: Date | null;
}
