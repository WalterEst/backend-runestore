import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Carrito } from '../src/database/entities/carrito.entity';
import { CarritoItem } from '../src/database/entities/carrito-item.entity';
import { Categoria } from '../src/database/entities/categoria.entity';
import { Orden } from '../src/database/entities/orden.entity';
import { OrdenItem } from '../src/database/entities/orden-item.entity';
import { Producto } from '../src/database/entities/producto.entity';
import { ProductoVariante } from '../src/database/entities/producto-variante.entity';
import { ReservaStock } from '../src/database/entities/reserva-stock.entity';
import { Talla } from '../src/database/entities/talla.entity';

/**
 * Criterio de término de la Fase 4 del documento maestro: "2 compras simultáneas
 * del último stock → solo 1 pasa". Verifica que el SELECT ... FOR UPDATE sobre la
 * variante (ver src/common/inventario/stock.util.ts) serializa correctamente el
 * checkout concurrente contra una base de datos real (requiere MySQL — ver CI).
 */
describe('Checkout — concurrencia de stock (e2e)', () => {
  let app: INestApplication<App>;
  let categorias: Repository<Categoria>;
  let productos: Repository<Producto>;
  let tallas: Repository<Talla>;
  let variantes: Repository<ProductoVariante>;
  let ordenes: Repository<Orden>;
  let ordenItems: Repository<OrdenItem>;
  let reservas: Repository<ReservaStock>;
  let carritos: Repository<Carrito>;
  let carritoItems: Repository<CarritoItem>;

  let categoria: Categoria;
  let producto: Producto;
  let variante: ProductoVariante;

  const EMAIL_COMPRADOR = `concurrencia-${Date.now()}@rune.cl`;

  jest.setTimeout(30000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(json({ limit: '1mb' }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    categorias = moduleFixture.get(getRepositoryToken(Categoria));
    productos = moduleFixture.get(getRepositoryToken(Producto));
    tallas = moduleFixture.get(getRepositoryToken(Talla));
    variantes = moduleFixture.get(getRepositoryToken(ProductoVariante));
    ordenes = moduleFixture.get(getRepositoryToken(Orden));
    ordenItems = moduleFixture.get(getRepositoryToken(OrdenItem));
    reservas = moduleFixture.get(getRepositoryToken(ReservaStock));
    carritos = moduleFixture.get(getRepositoryToken(Carrito));
    carritoItems = moduleFixture.get(getRepositoryToken(CarritoItem));

    const sufijo = Date.now();
    categoria = await categorias.save(
      categorias.create({
        nombre: 'Test Concurrencia',
        slug: `test-concurrencia-${sufijo}`,
      }),
    );
    producto = await productos.save(
      productos.create({
        nombre: 'Producto de prueba concurrencia',
        slug: `producto-concurrencia-${sufijo}`,
        descripcion:
          'Producto usado solo por el test e2e de concurrencia de stock',
        precio: 10000,
        categorias: [categoria],
      }),
    );

    const talla = await tallas.findOne({ where: { codigo: 'M' } });
    if (!talla) {
      throw new Error(
        'Talla "M" no encontrada: ¿se cargó RunarStore.sql en la BD de test?',
      );
    }

    variante = await variantes.save(
      variantes.create({
        productoId: producto.id,
        tallaId: talla.id,
        sku: `SKU-CONC-${sufijo}`,
        stock: 1, // última unidad: el corazón del test
      }),
    );
  });

  afterAll(async () => {
    const ordenesDeTest = await ordenes.find({
      where: { emailComprador: EMAIL_COMPRADOR },
    });
    const idsOrdenes = ordenesDeTest.map((o) => o.id);

    // Los carritos de este test (invitado) son los que quedaron ligados a la variante,
    // ya sea porque el checkout falló (item sigue ahí) o porque quedó "convertido"
    const itemsRestantes = await carritoItems.find({
      where: { varianteId: variante.id },
    });
    const idsCarritosPorItems = itemsRestantes.map((i) => i.carritoId);

    if (idsOrdenes.length > 0) {
      await reservas.delete({ ordenId: In(idsOrdenes) });
      await ordenItems.delete({ ordenId: In(idsOrdenes) });
    }
    if (idsCarritosPorItems.length > 0) {
      await carritoItems.delete({ carritoId: In(idsCarritosPorItems) });
      await carritos.delete({ id: In(idsCarritosPorItems) });
    }
    if (idsOrdenes.length > 0) {
      await ordenes.delete({ id: In(idsOrdenes) });
    }
    await variantes.delete({ id: variante.id });
    await productos.delete({ id: producto.id });
    await categorias.delete({ id: categoria.id });
    await app.close();
  });

  it('con stock=1, dos checkouts simultáneos del mismo producto: solo uno debe pasar', async () => {
    const agenteA = request.agent(app.getHttpServer());
    const agenteB = request.agent(app.getHttpServer());

    await agenteA
      .post('/carrito/items')
      .send({ varianteId: variante.id, cantidad: 1 })
      .expect(201);
    await agenteB
      .post('/carrito/items')
      .send({ varianteId: variante.id, cantidad: 1 })
      .expect(201);

    const datosOrden = {
      emailComprador: EMAIL_COMPRADOR,
      nombreComprador: 'Test Concurrencia',
      direccionEnvio: {
        calle: 'Calle Falsa 123',
        comuna: 'Santiago',
        region: 'Metropolitana',
      },
    };

    const [respuestaA, respuestaB] = await Promise.all([
      agenteA.post('/ordenes').send(datosOrden),
      agenteB.post('/ordenes').send(datosOrden),
    ]);

    const codigos = [respuestaA.status, respuestaB.status].sort(
      (a, b) => a - b,
    );
    expect(codigos).toEqual([201, 400]);

    // La que falló debe ser explícitamente por falta de stock, no por otro motivo
    const fallida = respuestaA.status === 400 ? respuestaA : respuestaB;
    expect(JSON.stringify(fallida.body)).toMatch(/[Ss]tock/);

    const variantePersistida = await variantes.findOne({
      where: { id: variante.id },
    });
    expect(variantePersistida?.stock).toBe(1); // el stock físico no se toca en checkout, solo en pago (fase 5)

    const reservasCreadas = await reservas.find({
      where: { varianteId: variante.id },
    });
    expect(reservasCreadas).toHaveLength(1); // solo la orden ganadora reservó la unidad
  });
});
