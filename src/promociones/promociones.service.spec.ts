import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PromocionesService } from './promociones.service';
import { Promocion } from '../database/entities/promocion.entity';

function crearMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v) => v),
    save: jest.fn(async (v) => ({ id: 1, ...v })),
  };
}

describe('PromocionesService', () => {
  let service: PromocionesService;
  let promocionesRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    promocionesRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PromocionesService,
        { provide: getRepositoryToken(Promocion), useValue: promocionesRepo },
      ],
    }).compile();

    service = moduleRef.get(PromocionesService);
  });

  describe('calcularDescuentoTiendaCompleta', () => {
    it('devuelve 0 si no hay promociones vigentes', async () => {
      promocionesRepo.find.mockResolvedValueOnce([]);
      expect(await service.calcularDescuentoTiendaCompleta(10000)).toBe(0);
    });

    it('calcula el porcentaje sobre el subtotal', async () => {
      promocionesRepo.find.mockResolvedValueOnce([
        { tipo: 'porcentaje', valor: 15 },
      ]);
      expect(await service.calcularDescuentoTiendaCompleta(10000)).toBe(1500);
    });

    it('usa el monto fijo cuando el tipo es monto_fijo', async () => {
      promocionesRepo.find.mockResolvedValueOnce([
        { tipo: 'monto_fijo', valor: 3000 },
      ]);
      expect(await service.calcularDescuentoTiendaCompleta(10000)).toBe(3000);
    });

    it('nunca descuenta más que el propio subtotal', async () => {
      promocionesRepo.find.mockResolvedValueOnce([
        { tipo: 'monto_fijo', valor: 999999 },
      ]);
      expect(await service.calcularDescuentoTiendaCompleta(10000)).toBe(10000);
    });

    it('con varias promociones vigentes, usa la de mayor descuento', async () => {
      promocionesRepo.find.mockResolvedValueOnce([
        { tipo: 'porcentaje', valor: 10 },
        { tipo: 'monto_fijo', valor: 5000 },
      ]);
      expect(await service.calcularDescuentoTiendaCompleta(10000)).toBe(5000);
    });
  });

  describe('toggleActiva', () => {
    it('invierte el estado activa (kill-switch)', async () => {
      promocionesRepo.findOne.mockResolvedValueOnce({ id: 1, activa: true });
      await service.toggleActiva(1);
      expect(promocionesRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ activa: false }),
      );
    });
  });
});
