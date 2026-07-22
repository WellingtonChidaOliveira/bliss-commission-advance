import { z } from "zod";
import { AdvanceIdSchema, CommissionIdSchema, SellerIdSchema } from "@bliss/shared/branded";
import { MoneySchema } from "@bliss/shared/money";

export const AdvanceStatusSchema = z.enum([
  "pending_reservation", // reserve() ainda não confirmado no Commission Service
  "pending_approval", // reservado, aguardando decisão (automática ou manual)
  "approved",
  "rejected",
  "failed", // reserva funcionou mas o Advance não pôde ser persistido -> deve disparar release (saga)
]);
export type AdvanceStatus = z.infer<typeof AdvanceStatusSchema>;

export const AdvanceSchema = z.object({
  id: AdvanceIdSchema,
  sellerId: SellerIdSchema,
  commissionIds: z.array(CommissionIdSchema).min(1),
  status: AdvanceStatusSchema,

  grossAmount: MoneySchema, // soma das comissões envolvidas
  feeAmount: MoneySchema, // taxa calculada (deságio)
  netAmount: MoneySchema, // grossAmount - feeAmount

  feeRateMonthly: z.number().positive(), // taxa mensal usada no cálculo, congelada no momento da criação
  daysAdvanced: z.number().int().nonnegative(),

  requestedAt: z.string().datetime(),
  decisionAt: z.string().datetime().nullable(),
  decisionReason: z.string().nullable(), // ex: "auto-approved: below threshold" | "rejected: exceeds daily limit"

  idempotencyKey: z.string().min(8).max(128), // dedupe de POST /advances
  reservationIdempotencyKey: z.string().min(8).max(128), // usado na chamada de reserve (pode ser igual ao acima)

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Advance = z.infer<typeof AdvanceSchema>;

export const CreateAdvanceSchema = z.object({
  sellerId: SellerIdSchema,
  commissionIds: z.array(CommissionIdSchema).min(1),
});
export type CreateAdvanceInput = z.infer<typeof CreateAdvanceSchema>;

/**
 * Guardrail mínimo de aprovação automática (documentado no ADR).
 * Mantido simples de propósito — não é um motor de anti-fraude completo.
 */
export const AutoApprovalPolicySchema = z.object({
  maxNetAmountCents: z.number().int().positive(), // teto por pedido
  maxApprovedAdvancesPerSellerPerDay: z.number().int().positive(), // velocity check simples
});
export type AutoApprovalPolicy = z.infer<typeof AutoApprovalPolicySchema>;