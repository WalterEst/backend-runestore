import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { moneyTransformer } from '../transformers/money.transformer';
import { Categoria } from './categoria.entity';

@Entity('productos')
@Index('idx_producto_anime', ['anime'])
export class Producto {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  slug: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({
    name: 'descripcion_corta',
    type: 'varchar',
    length: 300,
    nullable: true,
  })
  descripcionCorta: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  anime: string | null;

  /** DECIMAL(10,0) — CLP entero, nunca float. Ver CLAUDE.md */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 0,
    transformer: moneyTransformer,
  })
  precio: number;

  @Column({
    name: 'precio_oferta',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
    transformer: moneyTransformer,
  })
  precioOferta: number | null;

  @Column({
    type: 'tinyint',
    default: 0,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  destacado: boolean;

  @Column({
    type: 'tinyint',
    default: 1,
    transformer: { to: (v: boolean) => (v ? 1 : 0), from: (v: number) => !!v },
  })
  activo: boolean;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'datetime' })
  actualizadoEn: Date;

  /** Tabla puente producto_categoria (N:M sin columnas propias) */
  @ManyToMany(() => Categoria)
  @JoinTable({
    name: 'producto_categoria',
    joinColumn: { name: 'producto_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoria_id', referencedColumnName: 'id' },
  })
  categorias: Categoria[];
}
