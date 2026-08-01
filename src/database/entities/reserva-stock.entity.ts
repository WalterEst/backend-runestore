import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductoVariante } from './producto-variante.entity';

@Entity('reservas_stock')
export class ReservaStock {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'variante_id', type: 'bigint', unsigned: true })
  varianteId: number;

  @ManyToOne(() => ProductoVariante)
  @JoinColumn({ name: 'variante_id' })
  variante: ProductoVariante;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true })
  ordenId: number;

  @Column({ type: 'smallint', unsigned: true })
  cantidad: number;

  /** Ventana de pago (ej: 15 min); un cron libera reservas vencidas */
  @Index('idx_reserva_expira')
  @Column({ name: 'expira_en', type: 'datetime' })
  expiraEn: Date;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
