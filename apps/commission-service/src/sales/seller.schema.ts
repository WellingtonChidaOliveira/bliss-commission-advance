import { z } from "zod";
import { SellerIdSchema } from "@bliss/shared/branded";

export const SellerStatusSchema = z.enum(["active", "inactive"]);
export type SellerStatus = z.infer<typeof SellerStatusSchema>;

export const SellerSchema = z.object({
  id: SellerIdSchema,
  name: z.string().min(1),
  email: z.string().email(),
  document: z.string().min(11).max(14).describe("CPF or CNPJ, without formatting"),
  status: SellerStatusSchema,
  createdAt: z.string().datetime(),
});
export type Seller = z.infer<typeof SellerSchema>;

export const CreateSellerSchema = SellerSchema.pick({
  name: true,
  email: true,
  document: true,
});
export type CreateSellerInput = z.infer<typeof CreateSellerSchema>;

/** Guarda de invariante: só vendedor ativo pode gerar novas vendas/comissões. */
export function assertSellerCanSell(seller: Seller): void {
  if (seller.status !== "active") {
    throw new Error(`Seller ${seller.id} is not active`);
  }
}