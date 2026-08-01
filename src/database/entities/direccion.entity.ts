import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity('direcciones')
export class Direccion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'usuario_id', type: 'bigint', unsigned: true })
  usuarioId: number;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ type: 'varchar', length: 50, nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 150 })
  calle: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  depto: string | null;

  @Column({ type: 'varchar', length: 80 })
  comuna: string;

  @Column({ type: 'varchar', length: 80 })
  region: string;

  @Column({
    name: 'codigo_postal',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  codigoPostal: string | null;

  @Column({
    name: 'es_principal',
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  esPrincipal: boolean;
}
