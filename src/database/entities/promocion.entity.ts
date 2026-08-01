import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TipoPromocion = 'porcentaje' | 'monto_fijo';

@Entity('promociones')
export class Promocion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nombre: string;

  @Column({ type: 'enum', enum: ['porcentaje', 'monto_fijo'] })
  tipo: TipoPromocion;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: number;

  @Column({ name: 'fecha_inicio', type: 'datetime' })
  fechaInicio: Date;

  @Column({ name: 'fecha_fin', type: 'datetime' })
  fechaFin: Date;

  @Column({
    name: 'aplica_todo',
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  aplicaTodo: boolean;

  /** Kill-switch manual */
  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activa: boolean;
}
