import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Orden } from './orden.entity';

export type EstadoEnvio =
  'preparacion' | 'despachado' | 'en_transito' | 'entregado' | 'devuelto';

@Entity('envios')
export class Envio {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true, unique: true })
  ordenId: number;

  @OneToOne(() => Orden, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden: Orden;

  @Column({ type: 'varchar', length: 50 })
  courier: string;

  @Column({
    name: 'numero_seguimiento',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  numeroSeguimiento: string | null;

  @Column({
    type: 'enum',
    enum: ['preparacion', 'despachado', 'en_transito', 'entregado', 'devuelto'],
    default: 'preparacion',
  })
  estado: EstadoEnvio;

  @Column({
    name: 'etiqueta_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  etiquetaUrl: string | null;

  @Column({ name: 'despachado_en', type: 'datetime', nullable: true })
  despachadoEn: Date | null;

  @Column({ name: 'entregado_en', type: 'datetime', nullable: true })
  entregadoEn: Date | null;
}
