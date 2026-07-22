import { z } from "zod";
import { SaleIdSchema, SellerIdSchema } from "@bliss/shared/branded";
import { MoneySchema } from "@bliss/shared/money";

export const SaleSchema = z.object({
  id: SaleIdSchema,
  sellerId: SellerIdSchema,
  planReference: z.string().min(1).describe("Identity of the plan that generated this sale"), 
  saleAmount: MoneySchema.describe("Total amount of the sale"),
  commissionAmount: MoneySchema.describe("Amount of commission for this sale"),
  saleDate: z.string().datetime(),
  expectedPaymentDate: z.string().datetime().describe("Define limit for payment date antecipation"), // D+30/60/90
  idempotencyKey: z.string().min(8).max(128).optional(), // dedupe de POST /sales
  createdAt: z.string().datetime(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const CreateSaleSchema = z.object({
  sellerId: SellerIdSchema,
  planReference: z.string().min(1),
  saleAmount: MoneySchema,
  commissionAmount: MoneySchema,
  saleDate: z.string().datetime(),
  expectedPaymentDate: z.string().datetime(),
});
export type CreateSaleInput = z.infer<typeof CreateSaleSchema>;

/** expectedPaymentDate nunca pode ser anterior à data da venda. */
export function assertValidSaleDates(input: CreateSaleInput): void {
  if (new Date(input.expectedPaymentDate) <= new Date(input.saleDate)) {
    throw new Error("expectedPaymentDate must be after saleDate");
  }
}