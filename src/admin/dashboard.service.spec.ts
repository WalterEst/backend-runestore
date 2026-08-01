import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { Boleta } from '../database/entities/boleta.entity';
import { Orden } from '../database/entities/orden.entity';
import { OrdenItem } from '../database/entities/orden-item.entity';
import { Pago } from '../database/entities/pago.entity';
import { ProductoVariante } from '../database/entities/producto-variante.entity';
import { SolicitudDerecho } from '../database/entities/solicitud-derecho.entity';
import { Ticket } from '../database/entities/ticket.entity';
import { Usuario } from '../database/entities/usuario.entity';
import { WebhookLog } from '../database/entities/webhook-log.entity';

function crearQueryBuilderMock(resultado: unknown) {
  const qb: Record<string, jest.Mock> = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(resultado),
    getCount: jest.fn().mockResolvedValue(resultado),
  };
  return qb;
}

function crearMockRepo() {
  return {
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let ordenesRepo: ReturnType<typeof crearMockRepo>;
  let ordenItemsRepo: ReturnType<typeof crearMockRepo>;
  let pagosRepo: ReturnType<typeof crearMockRepo>;
  let variantesRepo: ReturnType<typeof crearMockRepo>;
  let ticketsRepo: ReturnType<typeof crearMockRepo>;
  let solicitudesRepo: ReturnType<typeof crearMockRepo>;
  let webhooksRepo: ReturnType<typeof crearMockRepo>;
  let usuariosRepo: ReturnType<typeof crearMockRepo>;

  beforeEach(async () => {
    ordenesRepo = crearMockRepo();
    ordenItemsRepo = crearMockRepo();
    pagosRepo = crearMockRepo();
    variantesRepo = crearMockRepo();
    ticketsRepo = crearMockRepo();
    solicitudesRepo = crearMockRepo();
    webhooksRepo = crearMockRepo();
    usuariosRepo = crearMockRepo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Orden), useValue: ordenesRepo },
        { provide: getRepositoryToken(OrdenItem), useValue: ordenItemsRepo },
        { provide: getRepositoryToken(Pago), useValue: pagosRepo },
        { provide: getRepositoryToken(Boleta), useValue: crearMockRepo() },
        {
          provide: getRepositoryToken(ProductoVariante),
          useValue: variantesRepo,
        },
        { provide: getRepositoryToken(Ticket), useValue: ticketsRepo },
        {
          provide: getRepositoryToken(SolicitudDerecho),
          useValue: solicitudesRepo,
        },
        { provide: getRepositoryToken(WebhookLog), useValue: webhooksRepo },
        { provide: getRepositoryToken(Usuario), useValue: usuariosRepo },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('ventasPorPeriodo agrupa por día y castea los totales a número', async () => {
    ordenesRepo.createQueryBuilder.mockReturnValue(
      crearQueryBuilderMock([
        { fecha: '2026-07-01', totalVentas: '150000', ordenes: '3' },
      ]),
    );

    const resultado = await service.ventasPorPeriodo();

    expect(resultado).toEqual([
      { fecha: '2026-07-01', totalVentas: 150000, ordenes: 3 },
    ]);
  });

  it('topProductos usa el límite por defecto de 10', async () => {
    const qb = crearQueryBuilderMock([]);
    ordenItemsRepo.createQueryBuilder.mockReturnValue(qb);

    await service.topProductos();

    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it('topProductos respeta un límite explícito', async () => {
    const qb = crearQueryBuilderMock([]);
    ordenItemsRepo.createQueryBuilder.mockReturnValue(qb);

    await service.topProductos({ limite: 3 });

    expect(qb.limit).toHaveBeenCalledWith(3);
  });

  it('stockBajoMinimo solo trae variantes activas con stock en el límite', async () => {
    const qb = crearQueryBuilderMock([
      {
        varianteId: 1,
        sku: 'RUNE-1',
        producto: 'Polera Naruto',
        stock: 2,
        stockMinimo: 3,
      },
    ]);
    variantesRepo.createQueryBuilder.mockReturnValue(qb);

    const resultado = await service.stockBajoMinimo();

    expect(qb.where).toHaveBeenCalledWith('variante.activa = true');
    expect(resultado).toHaveLength(1);
  });

  it('ticketsAbiertos suma el total excluyendo cerrados', async () => {
    const qb = crearQueryBuilderMock([
      { estado: 'abierto', cantidad: '2' },
      { estado: 'en_proceso', cantidad: '1' },
    ]);
    ticketsRepo.createQueryBuilder.mockReturnValue(qb);

    const resultado = await service.ticketsAbiertos();

    expect(resultado).toEqual({
      total: 3,
      porEstado: { abierto: 2, en_proceso: 1 },
    });
  });

  it('solicitudesPendientes marca en rojo una solicitud que superó el plazo', async () => {
    const haceOnceDias = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000);
    solicitudesRepo.find.mockResolvedValueOnce([
      {
        id: 1,
        email: 'cliente@rune.cl',
        tipo: 'acceso',
        estado: 'recibida',
        recibidaEn: haceOnceDias,
      },
    ]);

    const [resultado] = await service.solicitudesPendientes();

    expect(resultado.semaforo).toBe('rojo');
  });

  it('solicitudesPendientes marca en verde una solicitud recién recibida', async () => {
    solicitudesRepo.find.mockResolvedValueOnce([
      {
        id: 2,
        email: 'otro@rune.cl',
        tipo: 'portabilidad',
        estado: 'recibida',
        recibidaEn: new Date(),
      },
    ]);

    const [resultado] = await service.solicitudesPendientes();

    expect(resultado.semaforo).toBe('verde');
  });

  it('webhooksSinProcesar cuenta el total y los que llevan más de 10 minutos', async () => {
    webhooksRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);

    const resultado = await service.webhooksSinProcesar();

    expect(resultado).toEqual({ total: 5, masDe10Min: 2 });
  });

  it('alertas combina las señales de todos los módulos', async () => {
    pagosRepo.createQueryBuilder.mockReturnValue(crearQueryBuilderMock(4));
    webhooksRepo.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    variantesRepo.createQueryBuilder.mockReturnValue(
      crearQueryBuilderMock([{ varianteId: 1 }]),
    );
    usuariosRepo.count.mockResolvedValueOnce(2);
    solicitudesRepo.find.mockResolvedValueOnce([
      {
        id: 1,
        email: 'a@rune.cl',
        tipo: 'acceso',
        estado: 'recibida',
        recibidaEn: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
      },
    ]);

    const resultado = await service.alertas();

    expect(resultado).toEqual({
      pagosSinBoleta: 4,
      webhooksSinProcesar: 1,
      stockBajoMinimo: 1,
      usuariosBloqueados: 2,
      solicitudesCercaDelPlazo: 1,
    });
  });
});
