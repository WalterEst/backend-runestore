import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';

export type TipoCupon = 'porcentaje' | 'monto_fijo' | 'envio_gratis';

@Entity('cupones')
export class Cupon {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  codigo: string;

  @Column({ type: 'enum', enum: ['porcentaje', 'monto_fijo', 'envio_gratis'] })
  tipo: TipoCupon;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  valor: number;

  @Column({
    name: 'monto_minimo',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  montoMinimo: number | null;

  @Column({
    name: 'limite_usos_total',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  limiteUsosTotal: number | null;

  @Column({
    name: 'limite_por_usuario',
    type: 'tinyint',
    unsigned: true,
    default: 1,
  })
  limitePorUsuario: number;

  /** Desnormalizado: valida sin COUNT() en checkout. Se incrementa con UPDATE atómico condicionado. */
  @Column({ name: 'usos_actuales', type: 'int', unsigned: true, default: 0 })
  usosActuales: number;

  @Column({ name: 'fecha_inicio', type: 'datetime' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'datetime' })
  fechaFin: Date;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activo: boolean;
}
