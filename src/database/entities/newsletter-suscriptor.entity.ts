import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('newsletter_suscriptores')
export class NewsletterSuscriptor {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 191, unique: true })
  email: string;

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

  /** Baja en 1 clic: obligatorio anti-spam */
  @Column({ name: 'token_baja', type: 'char', length: 64, unique: true })
  tokenBaja: string;

  /** Double opt-in: protege reputación del dominio */
  @Column({
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  confirmado: boolean;

  @CreateDateColumn({ name: 'suscrito_en', type: 'datetime' })
  suscritoEn: Date;

  @Column({ name: 'baja_en', type: 'datetime', nullable: true })
  bajaEn: Date | null;
}
