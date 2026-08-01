import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterSuscriptor } from '../database/entities/newsletter-suscriptor.entity';
import { NewsletterCampana } from '../database/entities/newsletter-campana.entity';
import { Consentimiento } from '../database/entities/consentimiento.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
}

describe('NewsletterService', () => {
  let service: NewsletterService;
  let suscriptoresRepo: ReturnType<typeof crearMockRepo>;
  let campanasRepo: ReturnType<typeof crearMockRepo>;
  let consentimientosRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    suscriptoresRepo = crearMockRepo();
    campanasRepo = crearMockRepo();
    consentimientosRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsletterService,
        {
          provide: getRepositoryToken(NewsletterSuscriptor),
          useValue: suscriptoresRepo,
        },
        {
          provide: getRepositoryToken(NewsletterCampana),
          useValue: campanasRepo,
        },
        {
          provide: getRepositoryToken(Consentimiento),
          useValue: consentimientosRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(NewsletterService);
  });

  describe('suscribirse', () => {
    it('crea el suscriptor sin confirmar (double opt-in) y registra el consentimiento', async () => {
      suscriptoresRepo.findOne.mockResolvedValueOnce(null);

      await service.suscribirse('nueva@rune.cl', { ip: '1.2.3.4' });

      expect(suscriptoresRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'nueva@rune.cl', confirmado: false }),
      );
      expect(consentimientosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ finalidad: 'marketing', otorgado: true }),
      );
    });

    it('reactiva a alguien que se había dado de baja', async () => {
      suscriptoresRepo.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'volvio@rune.cl',
        bajaEn: new Date(),
        confirmado: true,
      });

      await service.suscribirse('volvio@rune.cl', {});

      expect(suscriptoresRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ bajaEn: null, confirmado: false }),
      );
    });
  });

  describe('darDeBaja', () => {
    it('marca bajaEn y registra la revocación del consentimiento', async () => {
      suscriptoresRepo.findOne.mockResolvedValueOnce({
        id: 1,
        email: 'x@rune.cl',
        bajaEn: null,
      });

      await service.darDeBaja('token-valido', {});

      expect(suscriptoresRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ bajaEn: expect.any(Date) }),
      );
      expect(consentimientosRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ finalidad: 'marketing', otorgado: false }),
      );
    });

    it('lanza NotFoundException con un token inválido', async () => {
      suscriptoresRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.darDeBaja('token-invalido', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
