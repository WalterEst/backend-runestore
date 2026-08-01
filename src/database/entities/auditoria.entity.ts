import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Log de acciones sensibles: login fallido, cambio de rol, anulación de boleta, cambio de precio, supresión de datos */
@Entity('auditoria')
@Index('idx_audit_entidad', ['entidad', 'entidadId'])
@Index('idx_audit_fecha', ['creadoEn'])
export class Auditoria {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({
    name: 'usuario_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  usuarioId: number | null;

  @Column({ type: 'varchar', length: 60 })
  accion: string;

  @Column({ type: 'varchar', length: 40 })
  entidad: string;

  @Column({
    name: 'entidad_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  entidadId: number | null;

  @Column({ type: 'json', nullable: true })
  detalle: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
