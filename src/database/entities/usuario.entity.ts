import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Rol } from './rol.entity';

@Entity('usuarios')
@Index('idx_usuarios_email', ['email'])
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'rol_id', type: 'tinyint', unsigned: true, default: 1 })
  rolId: number;

  @ManyToOne(() => Rol, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rol_id' })
  rol: Rol;

  @Column({ type: 'varchar', length: 191, unique: true })
  email: string;

  /** Hash argon2id. Prohibido texto plano/MD5/SHA1 — ver CLAUDE.md */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 80 })
  apellido: string;

  @Column({ type: 'varchar', length: 12, unique: true, nullable: true })
  rut: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefono: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({
    name: 'email_verificado',
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  emailVerificado: boolean;

  @Column({ name: 'total_compras', type: 'int', unsigned: true, default: 0 })
  totalCompras: number;

  @Column({
    name: 'acepta_marketing',
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  aceptaMarketing: boolean;

  @Column({
    name: 'intentos_login',
    type: 'tinyint',
    unsigned: true,
    default: 0,
  })
  intentosLogin: number;

  @Column({ name: 'bloqueado_hasta', type: 'datetime', nullable: true })
  bloqueadoHasta: Date | null;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activo: boolean;

  /** SOLO el hash del refresh token — nunca el token en claro (ver CLAUDE.md) */
  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  refreshTokenHash: string | null;

  /** Secreto TOTP cifrado (AES-256-GCM, ver totp-crypto.util.ts) — nunca en texto plano */
  @Column({ name: 'totp_secret', type: 'varchar', length: 255, nullable: true })
  totpSecret: string | null;

  @Column({
    name: 'totp_habilitado',
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  totpHabilitado: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime' })
  actualizadoEn: Date;

  @Column({ name: 'eliminado_en', type: 'datetime', nullable: true })
  eliminadoEn: Date | null;
}
