import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Consentimiento } from '../database/entities/consentimiento.entity';
import { NewsletterCampana } from '../database/entities/newsletter-campana.entity';
import { NewsletterSuscriptor } from '../database/entities/newsletter-suscriptor.entity';
import { ActualizarCampanaDto, CrearCampanaDto } from './dto/newsletter.dto';

interface ContextoConsentimiento {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectRepository(NewsletterSuscriptor)
    private readonly suscriptores: Repository<NewsletterSuscriptor>,
    @InjectRepository(NewsletterCampana)
    private readonly campanas: Repository<NewsletterCampana>,
    @InjectRepository(Consentimiento)
    private readonly consentimientos: Repository<Consentimiento>,
  ) {}

  /** Double opt-in: crea el suscriptor sin confirmar y envía el link de confirmación */
  async suscribirse(
    email: string,
    ctx: ContextoConsentimiento,
  ): Promise<{ mensaje: string }> {
    let suscriptor = await this.suscriptores.findOne({ where: { email } });

    if (!suscriptor) {
      suscriptor = await this.suscriptores.save(
        this.suscriptores.create({
          email,
          tokenBaja: randomBytes(32).toString('hex'),
          confirmado: false,
        }),
      );
    } else if (suscriptor.bajaEn) {
      // Se re-suscribe: reactiva y vuelve a pedir confirmación
      suscriptor.bajaEn = null;
      suscriptor.confirmado = false;
      await this.suscriptores.save(suscriptor);
    }

    await this.consentimientos.save(
      this.consentimientos.create({
        email,
        finalidad: 'marketing',
        version: 1,
        otorgado: true,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
    );

    this.logger.log(
      `[email pendiente de proveedor real] Confirma tu suscripción: token=${suscriptor.tokenBaja}`,
    );

    return {
      mensaje:
        'Revisa tu correo para confirmar tu suscripción (double opt-in).',
    };
  }

  async confirmar(token: string): Promise<{ mensaje: string }> {
    const suscriptor = await this.suscriptores.findOne({
      where: { tokenBaja: token },
    });
    if (!suscriptor)
      throw new NotFoundException('Token de confirmación inválido');
    suscriptor.confirmado = true;
    await this.suscriptores.save(suscriptor);
    return { mensaje: 'Suscripción confirmada' };
  }

  /** Baja en 1 clic — obligatorio anti-spam, ver documento maestro */
  async darDeBaja(
    token: string,
    ctx: ContextoConsentimiento,
  ): Promise<{ mensaje: string }> {
    const suscriptor = await this.suscriptores.findOne({
      where: { tokenBaja: token },
    });
    if (!suscriptor) throw new NotFoundException('Token inválido');

    suscriptor.bajaEn = new Date();
    await this.suscriptores.save(suscriptor);

    await this.consentimientos.save(
      this.consentimientos.create({
        email: suscriptor.email,
        finalidad: 'marketing',
        version: 1,
        otorgado: false,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      }),
    );

    return { mensaje: 'Te diste de baja correctamente' };
  }

  // --- Admin ---

  async listarSuscriptoresAdmin(): Promise<NewsletterSuscriptor[]> {
    return this.suscriptores.find({ order: { suscritoEn: 'DESC' } });
  }

  async listarCampanasAdmin(): Promise<NewsletterCampana[]> {
    return this.campanas.find({ order: { creadoEn: 'DESC' } });
  }

  async crearCampana(dto: CrearCampanaDto): Promise<NewsletterCampana> {
    return this.campanas.save(
      this.campanas.create({
        asunto: dto.asunto,
        contenidoHtml: dto.contenidoHtml,
        estado: dto.programadaPara ? 'programada' : 'borrador',
        programadaPara: dto.programadaPara
          ? new Date(dto.programadaPara)
          : null,
      }),
    );
  }

  async actualizarCampana(
    id: number,
    dto: ActualizarCampanaDto,
  ): Promise<NewsletterCampana> {
    const campana = await this.campanas.findOne({ where: { id } });
    if (!campana) throw new NotFoundException('Campaña no encontrada');
    if (campana.estado === 'enviada') {
      throw new BadRequestException(
        'No se puede editar una campaña ya enviada',
      );
    }

    Object.assign(campana, {
      asunto: dto.asunto ?? campana.asunto,
      contenidoHtml: dto.contenidoHtml ?? campana.contenidoHtml,
      estado: dto.estado ?? campana.estado,
      programadaPara: dto.programadaPara
        ? new Date(dto.programadaPara)
        : campana.programadaPara,
    });
    return this.campanas.save(campana);
  }
}
