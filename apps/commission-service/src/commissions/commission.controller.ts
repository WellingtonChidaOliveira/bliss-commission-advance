import { commissionRepository } from "./commission.repository";
import {
  Commission,
  reserveCommission,
  releaseCommission,
  ReserveCommissionRequest,
} from "./commission.schema";

export interface CreateCommissionResult {
  commission: Commission;
}

export class CommissionNotFoundError extends Error {}
export class CommissionConflictError extends Error {}

export async function getCommissionByIdAndStatus(id: string, status: string): Promise<Commission | null> {
    return commissionRepository.getByIdAndStatus(id, status);
}

export async function getCommissionById(id: string): Promise<Commission | null> {
    return commissionRepository.getById(id);
}

/**
 * Reserva a comissão para um Advance. A leitura + cálculo da transição
 * acontecem antes da escrita, então o `updateIfVersionMatches` é quem
 * garante a atomicidade real: se outra chamada reservou a mesma comissão
 * entre o `getById` e o `update`, essa chamada perde e vira 409 (mapeado
 * no router via `CommissionConflictError`).
 */
export async function reserveCommissionById(
  id: string,
  request: ReserveCommissionRequest,
): Promise<Commission> {
  const commission = await commissionRepository.getById(id);
  if (!commission) {
    throw new CommissionNotFoundError(`Commission ${id} not found`);
  }

  const updated = reserveCommission(commission, request); // pode lançar CommissionStateError

  if (updated === commission) {
    return updated; // retry idempotente (mesma idempotencyKey) — nada para persistir
  }

  const saved = await commissionRepository.updateIfVersionMatches(id, commission.version, updated);
  if (!saved) {
    throw new CommissionConflictError(`Commission ${id} was modified concurrently, retry`);
  }
  return saved;
}

/** Libera a reserva. Mesma proteção de concorrência do reserve. */
export async function releaseCommissionById(id: string): Promise<Commission> {
  const commission = await commissionRepository.getById(id);
  if (!commission) {
    throw new CommissionNotFoundError(`Commission ${id} not found`);
  }

  const updated = releaseCommission(commission); // pode lançar CommissionStateError

  const saved = await commissionRepository.updateIfVersionMatches(id, commission.version, updated);
  if (!saved) {
    throw new CommissionConflictError(`Commission ${id} was modified concurrently, retry`);
  }
  return saved;
}

