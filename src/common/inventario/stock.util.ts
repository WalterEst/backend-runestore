import { EntityManager } from 'typeorm';
import { ProductoVariante } from '../../database/entities/producto-variante.entity';
import { ReservaStock } from '../../database/entities/reserva-stock.entity';

/**
 * Stock disponible = stock físico − SUM(reservas vigentes). Ver CLAUDE.md.
 * Para uso en checkout (con lock), el caller debe hacer el SELECT ... FOR UPDATE
 * de la variante ANTES de llamar a esta función, para que el punto de
 * serialización sea el lock de fila y no esta lectura agregada.
 */
export async function calcularStockDisponible(
  manager: EntityManager,
  varianteId: number,
  stockFisico: number,
): Promise<number> {
  const resultado = await manager
    .createQueryBuilder(ReservaStock, 'r')
    .select('COALESCE(SUM(r.cantidad), 0)', 'total')
    .where('r.varianteId = :varianteId', { varianteId })
    .andWhere('r.expiraEn > :ahora', { ahora: new Date() })
    .getRawOne<{ total: string }>();

  const reservado = parseInt(resultado?.total ?? '0', 10);
  return stockFisico - reservado;
}

/** SELECT ... FOR UPDATE de la variante: punto de serialización de la transacción */
export async function bloquearVariante(
  manager: EntityManager,
  varianteId: number,
): Promise<ProductoVariante | null> {
  return manager
    .createQueryBuilder(ProductoVariante, 'v')
    .setLock('pessimistic_write')
    .where('v.id = :id', { id: varianteId })
    .getOne();
}
