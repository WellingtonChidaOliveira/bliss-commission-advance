import { randomUUID } from "node:crypto";
import { assertValidSaleDates, CreateSaleInput, Sale } from "./sale.schema";
import { saleRepository } from "./sale.repository";
import { Commission } from "../commissions/commission.schema";
import { commissionRepository } from "../commissions/commission.repository";

export interface CreateSaleResult {
  sale: Sale;
  commission: Commission;
}

/**
 * Cria a venda e já gera a comissão correspondente (status "pending" —
 * ainda dentro do prazo de carência, não pode ser reservada/antecipada
 * ainda). A transição pending -> available é responsabilidade de outro
 * fluxo, fora do escopo do POST /sales.
 */
export async function createSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  assertValidSaleDates(input);

  const now = new Date().toISOString();

  const sale: Sale = {
    id: randomUUID() as Sale["id"],
    sellerId: input.sellerId,
    planReference: input.planReference,
    saleAmount: input.saleAmount,
    commissionAmount: input.commissionAmount,
    saleDate: input.saleDate,
    expectedPaymentDate: input.expectedPaymentDate,
    createdAt: now,
  };

  const commission: Commission = {
    id: randomUUID() as Commission["id"],
    saleId: sale.id,
    sellerId: sale.sellerId,
    amount: sale.commissionAmount,
    expectedPaymentDate: sale.expectedPaymentDate,
    status: "pending",
    reservedByAdvanceId: null,
    reservationIdempotencyKey: null,
    reservedAt: null,
    reservationExpiresAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };

  await saleRepository.create(sale);
  await commissionRepository.create(commission);

  return { sale, commission };
}
