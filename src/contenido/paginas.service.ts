import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pagina } from '../database/entities/pagina.entity';
import { ActualizarPaginaDto, CrearPaginaDto } from './dto/pagina.dto';

const SLUGS_QUE_EXIGEN_CONSENTIMIENTO = [
  'terminos-condiciones',
  'politica-privacidad',
];

@Injectable()
export class PaginasService {
  constructor(
    @InjectRepository(Pagina) private readonly paginas: Repository<Pagina>,
  ) {}

  async listarPublicas(): Promise<Pagina[]> {
    return this.paginas.find({ where: { publicada: true } });
  }

  async obtenerPublicaPorSlug(slug: string): Promise<Pagina> {
    const pagina = await this.paginas.findOne({
      where: { slug, publicada: true },
    });
    if (!pagina) throw new NotFoundException('Página no encontrada');
    return pagina;
  }

  async listarAdmin(): Promise<Pagina[]> {
    return this.paginas.find({ order: { slug: 'ASC' } });
  }

  async crear(dto: CrearPaginaDto): Promise<Pagina> {
    const existente = await this.paginas.findOne({ where: { slug: dto.slug } });
    if (existente)
      throw new BadRequestException('Ya existe una página con ese slug');

    return this.paginas.save(
      this.paginas.create({
        slug: dto.slug,
        titulo: dto.titulo,
        contenido: dto.contenido,
        version: 1,
        publicada: true,
      }),
    );
  }

  /**
   * Si `nuevaVersion` es true en una página de términos/privacidad, sube `version`:
   * el próximo login/compra de cada usuario debe volver a pedir su aceptación,
   * porque el consentimiento de la versión anterior no cubre la nueva (Ley 21.719).
   */
  async actualizar(id: number, dto: ActualizarPaginaDto): Promise<Pagina> {
    const pagina = await this.paginas.findOne({ where: { id } });
    if (!pagina) throw new NotFoundException('Página no encontrada');

    Object.assign(pagina, {
      titulo: dto.titulo ?? pagina.titulo,
      contenido: dto.contenido ?? pagina.contenido,
      publicada: dto.publicada ?? pagina.publicada,
    });

    if (dto.nuevaVersion) {
      pagina.version += 1;
    }

    return this.paginas.save(pagina);
  }

  /** true si esta página, al cambiar de versión, obliga a re-pedir el consentimiento */
  exigeConsentimiento(slug: string): boolean {
    return SLUGS_QUE_EXIGEN_CONSENTIMIENTO.includes(slug);
  }
}
