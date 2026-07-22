import { z } from "zod";
import { AdvanceIdSchema, CommissionIdSchema, SaleIdSchema, SellerIdSchema } from "@bliss/shared/branded";
import { MoneySchema } from "@bliss/shared/money";

export const CommissionStatusSchema = z.enum([
  "pending", // criada, ainda dentro do prazo de carência antes de poder ser antecipada
  "available", // liberada, pode ser reservada para antecipação
  "reserved", // reservada por um Advance em andamento (temporário, com TTL)
  "advanced", // antecipada com sucesso (evento advance.approved processado)
  "paid", // paga no fluxo normal, sem antecipação
]);
export type CommissionStatus = z.infer<typeof CommissionStatusSchema>;

export const CommissionSchema = z.object({
  id: CommissionIdSchema,
  saleId: SaleIdSchema,
  sellerId: SellerIdSchema,
  amount: MoneySchema,
  expectedPaymentDate: z.string().datetime(),
  status: CommissionStatusSchema,

  // --- campos de reserva (existem só quando status === "reserved") ---
  reservedByAdvanceId: AdvanceIdSchema.nullable(),
  reservationIdempotencyKey: z.string().nullable(), // correlaciona com a chamada HTTP de reserve, evita reserva duplicada em retry
  reservedAt: z.string().datetime().nullable(),
  reservationExpiresAt: z.string().datetime().nullable(), // TTL — rede de segurança se o Advance Service morrer no meio do fluxo

  // --- controle de concorrência otimista ---
  // usado como ConditionExpression no DynamoDB: só escreve se `version` bater
  // com o valor lido. Incrementa a cada transição de status.
  version: z.number().int().nonnegative(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Commission = z.infer<typeof CommissionSchema>;

export const ReserveCommissionRequestSchema = z.object({
  advanceId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(128),
  ttlMinutes: z.number().int().positive(),
});
export type ReserveCommissionRequest = z.infer<typeof ReserveCommissionRequestSchema>;

// ---------------------------------------------------------------------------
// Transições de estado como funções puras e guardadas.
// Nenhum código de aplicação deve fazer `commission.status = "reserved"`
// diretamente — sempre passar por aqui, para garantir que a invariante
// (e o incremento de version) sejam respeitados em todo lugar.
// ---------------------------------------------------------------------------

export class CommissionStateError extends Error {}

/**
 * Reserva a comissão para um pedido de antecipação.
 * Idempotente: se já está reservada pela MESMA reservationIdempotencyKey,
 * retorna a comissão sem alterar nada (é um retry, não uma nova reserva).
 */
export function reserveCommission(
  commission: Commission,
  params: { advanceId: string; idempotencyKey: string; ttlMinutes: number; now?: Date },
): Commission {
  const now = params.now ?? new Date();

  if (commission.status === "reserved" && commission.reservationIdempotencyKey === params.idempotencyKey) {
    return commission; // retry idempotente, no-op
  }

  if (commission.status !== "available") {
    throw new CommissionStateError(
      `Cannot reserve commission ${commission.id}: expected status "available", got "${commission.status}"`,
    );
  }

  const expiresAt = new Date(now.getTime() + params.ttlMinutes * 60_000);

  return {
    ...commission,
    status: "reserved",
    reservedByAdvanceId: params.advanceId as Commission["reservedByAdvanceId"],
    reservationIdempotencyKey: params.idempotencyKey,
    reservedAt: now.toISOString(),
    reservationExpiresAt: expiresAt.toISOString(),
    version: commission.version + 1,
    updatedAt: now.toISOString(),
  };
}

/** Libera uma reserva (pedido de antecipação rejeitado, ou compensação de falha). */
export function releaseCommission(commission: Commission, now: Date = new Date()): Commission {
  if (commission.status !== "reserved") {
    throw new CommissionStateError(
      `Cannot release commission ${commission.id}: expected status "reserved", got "${commission.status}"`,
    );
  }

  return {
    ...commission,
    status: "available",
    reservedByAdvanceId: null,
    reservationIdempotencyKey: null,
    reservedAt: null,
    reservationExpiresAt: null,
    version: commission.version + 1,
    updatedAt: now.toISOString(),
  };
}

/** Verifica se uma reserva expirou (TTL estourado) e deveria ser liberada automaticamente. */
export function isReservationExpired(commission: Commission, now: Date = new Date()): boolean {
  if (commission.status !== "reserved" || !commission.reservationExpiresAt) return false;
  return new Date(commission.reservationExpiresAt) <= now;
}

/** Marca como antecipada — chamado só pelo consumer SQS ao processar advance.approved. */
export function markCommissionAdvanced(commission: Commission, advanceId: string, now: Date = new Date()): Commission {
  if (commission.status !== "reserved" || commission.reservedByAdvanceId !== advanceId) {
    throw new CommissionStateError(
      `Cannot mark commission ${commission.id} as advanced: not reserved by advance ${advanceId}`,
    );
  }

  return {
    ...commission,
    status: "advanced",
    version: commission.version + 1,
    updatedAt: now.toISOString(),
  };
}