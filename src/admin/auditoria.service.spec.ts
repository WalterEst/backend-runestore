import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditoriaService } from './auditoria.service';
import { Auditoria } from '../database/entities/auditoria.entity';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  let repo: { find: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditoriaService,
        { provide: getRepositoryToken(Auditoria), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(AuditoriaService);
  });

  it('lista sin filtro por defecto', async () => {
    repo.find.mockResolvedValueOnce([]);
    await service.listar();
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('filtra por entidad cuando se indica', async () => {
    repo.find.mockResolvedValueOnce([]);
    await service.listar('orden');
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entidad: 'orden' } }),
    );
  });
});
