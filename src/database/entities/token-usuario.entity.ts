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

export type TipoTokenUsuario = 'verificar_email' | 'reset_password';

@Entity('tokens_usuario')
@Index('idx_token_busqueda', ['tokenHash', 'tipo'])
export class TokenUsuario {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
  usuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'enum', enum: ['verificar_email', 'reset_password'] })
  tipo: TipoTokenUsuario;

  /** SHA-256 del token enviado por email; nunca el token en claro */
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string;

  @Column({ name: 'expira_en', type: 'datetime' })
  expiraEn: Date;

  @Column({ name: 'usado_en', type: 'datetime', nullable: true })
  usadoEn: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;
}
