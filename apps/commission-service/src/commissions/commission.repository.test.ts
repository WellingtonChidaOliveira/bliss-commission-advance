import { CommissionRepository } from "./commission.repository";
import { Commission } from "./commission.schema";

function buildCommission(overrides: Partial<Commission> = {}): Commission {
  const now = new Date().toISOString();
  return {
    id: "11111111-1111-1111-1111-111111111111" as Commission["id"],
    saleId: "22222222-2222-2222-2222-222222222222" as Commission["saleId"],
    sellerId: "33333333-3333-3333-3333-333333333333" as Commission["sellerId"],
    amount: { amountCents: 1000, currency: "BRL" },
    expectedPaymentDate: "2026-02-01T00:00:00.000Z",
    status: "available",
    reservedByAdvanceId: null,
    reservationIdempotencyKey: null,
    reservedAt: null,
    reservationExpiresAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("CommissionRepository", () => {
  it("cria e busca por id", async () => {
    const repo = new CommissionRepository();
    const commission = buildCommission();
    await repo.create(commission);

    await expect(repo.getById(commission.id)).resolves.toEqual(commission);
  });

  it("getById retorna null quando não encontrado", async () => {
    const repo = new CommissionRepository();
    await expect(repo.getById("nao-existe")).resolves.toBeNull();
  });

  it("getByIdAndStatus só encontra quando o status bate", async () => {
    const repo = new CommissionRepository();
    const commission = buildCommission({ status: "reserved" });
    await repo.create(commission);

    await expect(repo.getByIdAndStatus(commission.id, "reserved")).resolves.toEqual(commission);
    await expect(repo.getByIdAndStatus(commission.id, "available")).resolves.toBeNull();
  });

  it("getAll retorna todas as comissões criadas", async () => {
    const repo = new CommissionRepository();
    const a = buildCommission({ id: "11111111-1111-1111-1111-111111111111" as Commission["id"] });
    const b = buildCommission({ id: "99999999-9999-9999-9999-999999999999" as Commission["id"] });
    await repo.create(a);
    await repo.create(b);

    await expect(repo.getAll()).resolves.toEqual([a, b]);
  });

  it("delete remove a comissão e retorna true; segunda chamada retorna false", async () => {
    const repo = new CommissionRepository();
    const commission = buildCommission();
    await repo.create(commission);

    await expect(repo.delete(commission.id)).resolves.toBe(true);
    await expect(repo.getById(commission.id)).resolves.toBeNull();
    await expect(repo.delete(commission.id)).resolves.toBe(false);
  });

  describe("updateIfVersionMatches (compare-and-swap)", () => {
    it("escreve quando a version informada bate com a armazenada", async () => {
      const repo = new CommissionRepository();
      const commission = buildCommission({ version: 0 });
      await repo.create(commission);

      const updated: Commission = { ...commission, status: "reserved", version: 1 };
      const result = await repo.updateIfVersionMatches(commission.id, 0, updated);

      expect(result).toEqual(updated);
      await expect(repo.getById(commission.id)).resolves.toEqual(updated);
    });

    it("rejeita (retorna null) quando a version não bate — simula CAS perdido", async () => {
      const repo = new CommissionRepository();
      const commission = buildCommission({ version: 0 });
      await repo.create(commission);

      // simula outra escrita que já aconteceu antes desta tentativa
      await repo.updateIfVersionMatches(commission.id, 0, { ...commission, version: 1 });

      const staleUpdate: Commission = { ...commission, status: "reserved", version: 1 };
      const result = await repo.updateIfVersionMatches(commission.id, 0, staleUpdate);

      expect(result).toBeNull();
      // a escrita perdedora não deve ter sobrescrito o estado
      await expect(repo.getById(commission.id)).resolves.toEqual({ ...commission, version: 1 });
    });

    it("retorna null quando o id não existe", async () => {
      const repo = new CommissionRepository();
      const result = await repo.updateIfVersionMatches("nao-existe", 0, buildCommission());
      expect(result).toBeNull();
    });
  });
});
