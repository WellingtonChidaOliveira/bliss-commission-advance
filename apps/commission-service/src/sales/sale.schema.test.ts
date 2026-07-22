import { assertValidSaleDates, CreateSaleInput, CreateSaleSchema } from "./sale.schema";

describe("assertValidSaleDates", () => {
  const base = {
    sellerId: "11111111-1111-1111-1111-111111111111" as CreateSaleInput["sellerId"],
    planReference: "PLANO-1",
    saleAmount: { amountCents: 1000, currency: "BRL" as const },
    commissionAmount: { amountCents: 100, currency: "BRL" as const },
  };

  it("aceita quando expectedPaymentDate é depois de saleDate", () => {
    expect(() =>
      assertValidSaleDates({
        ...base,
        saleDate: "2026-01-01T00:00:00.000Z",
        expectedPaymentDate: "2026-02-01T00:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("rejeita quando expectedPaymentDate é igual a saleDate", () => {
    expect(() =>
      assertValidSaleDates({
        ...base,
        saleDate: "2026-01-01T00:00:00.000Z",
        expectedPaymentDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(/expectedPaymentDate must be after saleDate/);
  });

  it("rejeita quando expectedPaymentDate é antes de saleDate", () => {
    expect(() =>
      assertValidSaleDates({
        ...base,
        saleDate: "2026-02-01T00:00:00.000Z",
        expectedPaymentDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow(/expectedPaymentDate must be after saleDate/);
  });
});

describe("CreateSaleSchema", () => {
  const valid = {
    sellerId: "11111111-1111-1111-1111-111111111111",
    planReference: "PLANO-1",
    saleAmount: { amountCents: 1000, currency: "BRL" },
    commissionAmount: { amountCents: 100, currency: "BRL" },
    saleDate: "2026-01-01T00:00:00.000Z",
    expectedPaymentDate: "2026-02-01T00:00:00.000Z",
  };

  it("aceita um payload válido", () => {
    expect(CreateSaleSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita sellerId que não é uuid", () => {
    expect(CreateSaleSchema.safeParse({ ...valid, sellerId: "not-a-uuid" }).success).toBe(false);
  });

  it("rejeita planReference vazio", () => {
    expect(CreateSaleSchema.safeParse({ ...valid, planReference: "" }).success).toBe(false);
  });

  it("rejeita saleAmount com centavos fracionados", () => {
    expect(
      CreateSaleSchema.safeParse({
        ...valid,
        saleAmount: { amountCents: 10.5, currency: "BRL" },
      }).success,
    ).toBe(false);
  });

  it("rejeita quando falta um campo obrigatório", () => {
    const withoutSaleDate = {
      sellerId: valid.sellerId,
      planReference: valid.planReference,
      saleAmount: valid.saleAmount,
      commissionAmount: valid.commissionAmount,
      expectedPaymentDate: valid.expectedPaymentDate,
    };
    expect(CreateSaleSchema.safeParse(withoutSaleDate).success).toBe(false);
  });
});
