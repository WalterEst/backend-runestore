import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { Faq } from '../database/entities/faq.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
}

describe('FaqsService', () => {
  let service: FaqsService;
  let faqsRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    faqsRepo = crearMockRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FaqsService,
        { provide: getRepositoryToken(Faq), useValue: faqsRepo },
      ],
    }).compile();
    service = moduleRef.get(FaqsService);
  });

  it('listarPublicas solo trae las publicadas, ordenadas', async () => {
    await service.listarPublicas();
    expect(faqsRepo.find).toHaveBeenCalledWith({
      where: { publicada: true },
      order: { orden: 'ASC' },
    });
  });

  it('crear() por defecto queda publicada', async () => {
    await service.crear({
      pregunta: '¿Hacen envíos?',
      respuesta: 'Sí, a todo Chile.',
    });
    expect(faqsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ publicada: true, categoria: 'general' }),
    );
  });

  it('eliminar lanza NotFoundException si no existe', async () => {
    faqsRepo.delete.mockResolvedValueOnce({ affected: 0 });
    await expect(service.eliminar(999)).rejects.toThrow(NotFoundException);
  });
});
