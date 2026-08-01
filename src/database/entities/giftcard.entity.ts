import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Usuario } from './usuario.entity';

export type EstadoGiftcard = 'activa' | 'agotada' | 'expirada' | 'bloqueada';

@Entity('giftcards')
export class Giftcard {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  /** Generado con crypto.randomBytes — jamás secuencial ni adivinable */
  @Column({ type: 'varchar', length: 30, unique: true })
  codigo: string;

  @Column({
    name: 'monto_inicial',
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  montoInicial: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  saldo: number;

  @Column({
    name: 'comprador_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  compradorId: number | null;

  @ManyToOne(() => Usuario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'comprador_id' })
  comprador: Usuario | null;

  @Column({
    name: 'email_destinatario',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  emailDestinatario: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  mensaje: string | null;

  @Column({
    type: 'enum',
    enum: ['activa', 'agotada', 'expirada', 'bloqueada'],
    default: 'activa',
  })
  estado: EstadoGiftcard;

  @Column({ name: 'expira_en', type: 'date', nullable: true })
  expiraEn: string | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
