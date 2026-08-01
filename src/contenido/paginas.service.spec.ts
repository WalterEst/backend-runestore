import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaginasService } from './paginas.service';
import { Pagina } from '../database/entities/pagina.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
}

describe('PaginasService', () => {
  let service: PaginasService;
  let paginasRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    paginasRepo = crearMockRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaginasService,
        { provide: getRepositoryToken(Pagina), useValue: paginasRepo },
      ],
    }).compile();
    service = moduleRef.get(PaginasService);
  });

  describe('crear', () => {
    it('rechaza un slug duplicado', async () => {
      paginasRepo.findOne.mockResolvedValueOnce({
        id: 1,
        slug: 'terminos-condiciones',
      });
      await expect(
        service.crear({
          slug: 'terminos-condiciones',
          titulo: 'x',
          contenido: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crea la página en version 1', async () => {
      paginasRepo.findOne.mockResolvedValueOnce(null);
      const pagina = await service.crear({
        slug: 'envios',
        titulo: 'Política de envíos',
        contenido: '...',
      });
      expect(paginasRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ version: 1, publicada: true }),
      );
      expect(pagina).toBeDefined();
    });
  });

  describe('actualizar', () => {
    it('sube la versión solo si nuevaVersion=true', async () => {
      paginasRepo.findOne.mockResolvedValueOnce({
        id: 1,
        slug: 'politica-privacidad',
        version: 3,
        titulo: 'x',
        contenido: 'x',
        publicada: true,
      });

      await service.actualizar(1, {
        contenido: 'nuevo texto',
        nuevaVersion: true,
      });

      expect(paginasRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ version: 4 }),
      );
    });

    it('no sube la versión en una corrección menor (nuevaVersion ausente)', async () => {
      paginasRepo.findOne.mockResolvedValueOnce({
        id: 1,
        slug: 'politica-privacidad',
        version: 3,
        titulo: 'x',
        contenido: 'x',
        publicada: true,
      });

      await service.actualizar(1, { contenido: 'typo corregido' });

      expect(paginasRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ version: 3 }),
      );
    });

    it('lanza NotFoundException si la página no existe', async () => {
      paginasRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.actualizar(999, { titulo: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exigeConsentimiento', () => {
    it('es true para términos y privacidad', () => {
      expect(service.exigeConsentimiento('terminos-condiciones')).toBe(true);
      expect(service.exigeConsentimiento('politica-privacidad')).toBe(true);
    });

    it('es false para páginas informativas', () => {
      expect(service.exigeConsentimiento('envios')).toBe(false);
    });
  });
});
