import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Orden } from './orden.entity';
import { Usuario } from './usuario.entity';

export type CategoriaTicket =
  'envio' | 'cambio_devolucion' | 'producto_defectuoso' | 'pago' | 'otro';
export type PrioridadTicket = 'baja' | 'media' | 'alta';
export type EstadoTicket =
  'abierto' | 'en_proceso' | 'esperando_cliente' | 'resuelto' | 'cerrado';

/** REGLA: crear solo si usuarios.total_compras >= 1 (Guard en NestJS) */
@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  numero: string;

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
  usuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true, nullable: true })
  ordenId: number | null;

  @ManyToOne(() => Orden, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orden_id' })
  orden: Orden | null;

  @Column({ type: 'varchar', length: 150 })
  asunto: string;

  @Column({
    type: 'enum',
    enum: ['envio', 'cambio_devolucion', 'producto_defectuoso', 'pago', 'otro'],
  })
  categoria: CategoriaTicket;

  @Column({ type: 'enum', enum: ['baja', 'media', 'alta'], default: 'media' })
  prioridad: PrioridadTicket;

  @Index('idx_ticket_estado')
  @Column({
    type: 'enum',
    enum: ['abierto', 'en_proceso', 'esperando_cliente', 'resuelto', 'cerrado'],
    default: 'abierto',
  })
  estado: EstadoTicket;

  @Column({
    name: 'asignado_a',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  asignadoA: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'asignado_a' })
  agente: Usuario | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @Column({ name: 'cerrado_en', type: 'datetime', nullable: true })
  cerradoEn: Date | null;
}
