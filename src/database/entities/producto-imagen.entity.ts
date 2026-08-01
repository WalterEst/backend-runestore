import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Producto } from './producto.entity';

@Entity('producto_imagenes')
export class ProductoImagen {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'producto_id', type: 'bigint', unsigned: true })
  productoId: number;

  @ManyToOne(() => Producto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'producto_id' })
  producto: Producto;

  /** URL en Cloudflare R2 — jamás binarios en la BD */
  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 150, nullable: true })
  altText: string | null;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  orden: number;
}
