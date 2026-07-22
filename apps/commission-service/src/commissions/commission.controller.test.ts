import { randomUUID } from "node:crypto";
import { commissionRepository } from "./commission.repository";
import {
  CommissionConflictError,
  CommissionNotFoundError,
  getCommissionById,
  getCommissionByIdAndStatus,
  releaseCommissionById,
  reserveCommissionById,
} from "./commission.controller";
import { Commission, CommissionStateError } from "./commission.schema";

function seedCommission(overrides: Partial<Commission> = {}): Commission {
  const now = new Date().toISOString();
  const commission: Commission = {
    id: randomUUID() as Commission["id"],
    saleId: randomUUID() as Commission["saleId"],
    sellerId: randomUUID() as Commission["sellerId"],
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
  commissionRepository.create(commission);
  return commission;
}

describe("getCommissionById / getCommissionByIdAndStatus", () => {
  it("retorna a comissão pelo id", async () => {
    const commission = seedCommission();
    await expect(getCommissionById(commission.id)).resolves.toEqual(commission);
  });

  it("retorna null para id inexistente", async () => {
    await expect(getCommissionById(randomUUID())).resolves.toBeNull();
  });

  it("filtra por id e status", async () => {
    const commission = seedCommission({ status: "reserved" });
    await expect(getCommissionByIdAndStatus(commission.id, "reserved")).resolves.toEqual(commission);
    await expect(getCommissionByIdAndStatus(commission.id, "available")).resolves.toBeNull();
  });
});

describe("reserveCommissionById", () => {
  it("reserva uma comissão available", async () => {
    const commission = seedCommission();

    const result = await reserveCommissionById(commission.id, {
      advanceId: randomUUID(),
      idempotencyKey: "req-0001",
      ttlMinutes: 15,
    });

    expect(result.status).toBe("reserved");
    expect(result.version).toBe(1);
  });

  it("lança CommissionNotFoundError para id inexistente", async () => {
    await expect(
      reserveCommissionById(randomUUID(), {
        advanceId: randomUUID(),
        idempotencyKey: "req-0001",
        ttlMinutes: 15,
      }),
    ).rejects.toThrow(CommissionNotFoundError);
  });

  it("é idempotente: retry com a mesma idempotencyKey não incrementa version de novo", async () => {
    const commission = seedCommission();
    const advanceId = randomUUID();

    const first = await reserveCommissionById(commission.id, {
      advanceId,
      idempotencyKey: "req-0001",
      ttlMinutes: 15,
    });
    const second = await reserveCommissionById(commission.id, {
      advanceId,
      idempotencyKey: "req-0001",
      ttlMinutes: 15,
    });

    expect(second).toEqual(first);
    expect(second.version).toBe(1);
  });

  it("rejeita reserva de comissão já reservada por outra idempotencyKey (CommissionStateError)", async () => {
    const commission = seedCommission();
    await reserveCommissionById(commission.id, {
      advanceId: randomUUID(),
      idempotencyKey: "req-0001",
      ttlMinutes: 15,
    });

    await expect(
      reserveCommissionById(commission.id, {
        advanceId: randomUUID(),
        idempotencyKey: "req-OUTRA",
        ttlMinutes: 15,
      }),
    ).rejects.toThrow(CommissionStateError);
  });

  it("duas reservas concorrentes na mesma comissão: a primeira ganha, a segunda falha por CAS", async () => {
    const commission = seedCommission();

    const [resultA, resultB] = await Promise.allSettled([
      reserveCommissionById(commission.id, {
        advanceId: randomUUID(),
        idempotencyKey: "req-A",
        ttlMinutes: 15,
      }),
      reserveCommissionById(commission.id, {
        advanceId: randomUUID(),
        idempotencyKey: "req-B",
        ttlMinutes: 15,
      }),
    ]);

    expect(resultA.status).toBe("fulfilled");
    expect(resultB.status).toBe("rejected");
    if (resultB.status === "rejected") {
      expect(resultB.reason).toBeInstanceOf(CommissionConflictError);
    }

    const final = await getCommissionById(commission.id);
    expect(final?.status).toBe("reserved");
    expect(final?.reservationIdempotencyKey).toBe("req-A");
    expect(final?.version).toBe(1);
  });
});

describe("releaseCommissionById", () => {
  it("libera uma comissão reservada", async () => {
    const commission = seedCommission({
      status: "reserved",
      reservedByAdvanceId: randomUUID() as Commission["reservedByAdvanceId"],
      reservationIdempotencyKey: "req-0001",
      reservedAt: new Date().toISOString(),
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      version: 1,
    });

    const result = await releaseCommissionById(commission.id);

    expect(result.status).toBe("available");
    expect(result.version).toBe(2);
  });

  it("lança CommissionNotFoundError para id inexistente", async () => {
    await expect(releaseCommissionById(randomUUID())).rejects.toThrow(CommissionNotFoundError);
  });

  it("lança CommissionStateError ao liberar uma comissão que não está reservada", async () => {
    const commission = seedCommission({ status: "available" });
    await expect(releaseCommissionById(commission.id)).rejects.toThrow(CommissionStateError);
  });

  it("dois releases concorrentes na mesma comissão reservada: um ganha, o outro falha por CAS", async () => {
    const commission = seedCommission({
      status: "reserved",
      reservedByAdvanceId: randomUUID() as Commission["reservedByAdvanceId"],
      reservationIdempotencyKey: "req-0001",
      reservedAt: new Date().toISOString(),
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      version: 1,
    });

    const results = await Promise.allSettled([
      releaseCommissionById(commission.id),
      releaseCommissionById(commission.id),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual(["fulfilled", "rejected"]);

    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(CommissionConflictError);
  });
});
