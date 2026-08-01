import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../database/entities/faq.entity';
import { ActualizarFaqDto, CrearFaqDto } from './dto/faq.dto';

@Injectable()
export class FaqsService {
  constructor(@InjectRepository(Faq) private readonly faqs: Repository<Faq>) {}

  async listarPublicas(): Promise<Faq[]> {
    return this.faqs.find({
      where: { publicada: true },
      order: { orden: 'ASC' },
    });
  }

  async listarAdmin(): Promise<Faq[]> {
    return this.faqs.find({ order: { orden: 'ASC' } });
  }

  async crear(dto: CrearFaqDto): Promise<Faq> {
    return this.faqs.save(
      this.faqs.create({
        categoria: dto.categoria ?? 'general',
        pregunta: dto.pregunta,
        respuesta: dto.respuesta,
        orden: dto.orden ?? 0,
        publicada: true,
      }),
    );
  }

  async actualizar(id: number, dto: ActualizarFaqDto): Promise<Faq> {
    const faq = await this.faqs.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ no encontrada');
    Object.assign(faq, dto);
    return this.faqs.save(faq);
  }

  async eliminar(id: number): Promise<void> {
    const resultado = await this.faqs.delete({ id });
    if (!resultado.affected) throw new NotFoundException('FAQ no encontrada');
  }
}
