import { createSale } from "./sales.controller";
import { saleRepository } from "./sale.repository";
import { commissionRepository } from "../commissions/commission.repository";
import { CreateSaleInput } from "./sale.schema";

const validInput: CreateSaleInput = {
  sellerId: "11111111-1111-1111-1111-111111111111" as CreateSaleInput["sellerId"],
  planReference: "PLANO-1",
  saleAmount: { amountCents: 19990, currency: "BRL" },
  commissionAmount: { amountCents: 1699, currency: "BRL" },
  saleDate: "2026-01-01T00:00:00.000Z",
  expectedPaymentDate: "2026-02-01T00:00:00.000Z",
};

describe("createSale", () => {
  it("cria a Sale e a Commission vinculada, ambas persistidas", async () => {
    const result = await createSale(validInput);

    expect(result.sale.sellerId).toBe(validInput.sellerId);
    expect(result.sale.commissionAmount).toEqual(validInput.commissionAmount);

    expect(result.commission.saleId).toBe(result.sale.id);
    expect(result.commission.sellerId).toBe(validInput.sellerId);
    expect(result.commission.amount).toEqual(validInput.commissionAmount);
    expect(result.commission.status).toBe("pending");
    expect(result.commission.version).toBe(0);
    expect(result.commission.reservedByAdvanceId).toBeNull();

    await expect(saleRepository.getById(result.sale.id)).resolves.toEqual(result.sale);
    await expect(commissionRepository.getById(result.commission.id)).resolves.toEqual(result.commission);
  });

  it("rejeita quando expectedPaymentDate não é depois de saleDate, sem persistir nada", async () => {
    const invalidInput: CreateSaleInput = {
      ...validInput,
      saleDate: "2026-02-01T00:00:00.000Z",
      expectedPaymentDate: "2026-01-01T00:00:00.000Z",
    };

    await expect(createSale(invalidInput)).rejects.toThrow(/expectedPaymentDate must be after saleDate/);
  });

  it("gera ids diferentes para vendas diferentes", async () => {
    const first = await createSale(validInput);
    const second = await createSale(validInput);

    expect(first.sale.id).not.toBe(second.sale.id);
    expect(first.commission.id).not.toBe(second.commission.id);
  });
});
