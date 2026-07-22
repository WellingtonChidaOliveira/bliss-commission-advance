import { z } from "zod";
import { AdvanceIdSchema, CommissionIdSchema, SellerIdSchema } from "./branded";
import { MoneySchema } from "./money";

/**
 * Todo evento de domínio carrega um `eventId` próprio (não reaproveitar o
 * advanceId como chave de dedupe) para permitir reentrega do MESMO evento
 * de negócio sem ambiguidade. O consumer deduplica por `eventId`.
 */
const BaseEvent = z.object({
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
});

export const AdvanceApprovedEventSchema = BaseEvent.extend({
  type: z.literal("advance.approved"),
  advanceId: AdvanceIdSchema,
  sellerId: SellerIdSchema,
  commissionIds: z.array(CommissionIdSchema).min(1),
  netAmount: MoneySchema,
});
export type AdvanceApprovedEvent = z.infer<typeof AdvanceApprovedEventSchema>;

export const AdvanceRejectedEventSchema = BaseEvent.extend({
  type: z.literal("advance.rejected"),
  advanceId: AdvanceIdSchema,
  sellerId: SellerIdSchema,
  commissionIds: z.array(CommissionIdSchema).min(1),
  reason: z.string(),
});
export type AdvanceRejectedEvent = z.infer<typeof AdvanceRejectedEventSchema>;

export const DomainEventSchema = z.discriminatedUnion("type", [
  AdvanceApprovedEventSchema,
  AdvanceRejectedEventSchema,
]);
export type DomainEvent = z.infer<typeof DomainEventSchema>;