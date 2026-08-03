import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from '../database/entities/categoria.entity';
import { ActualizarCategoriaDto, CrearCategoriaDto } from './dto/categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectRepository(Categoria)
    private readonly categorias: Repository<Categoria>,
  ) {}

  async listarPublico(): Promise<Categoria[]> {
    return this.categorias.find({
      where: { activa: true },
      order: { orden: 'ASC' },
    });
  }

  async listarAdmin(): Promise<Categoria[]> {
    return this.categorias.find({ order: { orden: 'ASC' } });
  }

  async crear(dto: CrearCategoriaDto): Promise<Categoria> {
    await this.verificarSlugLibre(dto.slug);
    // activa se fija explícito: el transformer de la columna convierte "undefined" (el DTO
    // no trae este campo) en 0/false al insertar, así que confiar en el DEFAULT 1 de la
    // tabla no basta — sin esto, toda categoría nueva nace oculta en la tienda pública.
    return this.categorias.save(this.categorias.create({ ...dto, activa: true }));
  }

  async actualizar(
    id: number,
    dto: ActualizarCategoriaDto,
  ): Promise<Categoria> {
    const categoria = await this.obtener(id);
    if (dto.slug && dto.slug !== categoria.slug) {
      await this.verificarSlugLibre(dto.slug);
    }
    Object.assign(categoria, dto);
    return this.categorias.save(categoria);
  }

  private async obtener(id: number): Promise<Categoria> {
    const categoria = await this.categorias.findOne({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  private async verificarSlugLibre(slug: string): Promise<void> {
    const existente = await this.categorias.findOne({ where: { slug } });
    if (existente)
      throw new ConflictException('Ya existe una categoría con ese slug');
  }
}
