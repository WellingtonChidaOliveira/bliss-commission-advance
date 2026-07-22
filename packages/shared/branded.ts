import { z } from "zod";

/**
 * IDs "branded" — evita passar um SellerId onde se espera um CommissionId
 * mesmo os dois sendo string em runtime. Erro pego em compile-time.
 */
function brandedId<Brand extends string>(brand: Brand) {
  return z.string().uuid().brand<Brand>().describe(`Branded ID for ${brand}`);
}

export const SellerIdSchema = brandedId("SellerId");
export type SellerId = z.infer<typeof SellerIdSchema>;

export const SaleIdSchema = brandedId("SaleId");
export type SaleId = z.infer<typeof SaleIdSchema>;

export const CommissionIdSchema = brandedId("CommissionId");
export type CommissionId = z.infer<typeof CommissionIdSchema>;

export const AdvanceIdSchema = brandedId("AdvanceId");
export type AdvanceId = z.infer<typeof AdvanceIdSchema>;

export const IdempotencyKeySchema = z.string().min(8).max(128).describe(
  "Idempotency key provided by the client (header `Idempotency-Key`) or generated internally to correlate the reserve call with the Advance.",
);
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;