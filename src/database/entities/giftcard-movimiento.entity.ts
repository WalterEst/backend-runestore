import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Giftcard } from './giftcard.entity';
import { Orden } from './orden.entity';

/** Cuenta corriente de cada giftcard */
@Entity('giftcard_movimientos')
export class GiftcardMovimiento {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'giftcard_id', type: 'bigint', unsigned: true })
  giftcardId: number;

  @ManyToOne(() => Giftcard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'giftcard_id' })
  giftcard: Giftcard;

  @Column({ name: 'orden_id', type: 'bigint', unsigned: true, nullable: true })
  ordenId: number | null;

  @ManyToOne(() => Orden, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'orden_id' })
  orden: Orden | null;

  /** Con signo: negativo = uso */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  monto: number;

  @Column({
    name: 'saldo_resultante',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  saldoResultante: number;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
