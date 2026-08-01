import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('categorias')
export class Categoria {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'padre_id', type: 'int', unsigned: true, nullable: true })
  padreId: number | null;

  @ManyToOne(() => Categoria, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'padre_id' })
  padre: Categoria | null;

  @Column({ type: 'varchar', length: 80 })
  nombre: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'imagen_url', type: 'varchar', length: 500, nullable: true })
  imagenUrl: string | null;

  @Column({ type: 'smallint', unsigned: true, default: 0 })
  orden: number;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activa: boolean;
}
