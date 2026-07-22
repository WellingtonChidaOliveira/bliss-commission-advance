import {
  Commission,
  CommissionStateError,
  isReservationExpired,
  markCommissionAdvanced,
  releaseCommission,
  reserveCommission,
} from "./commission.schema";

function buildCommission(overrides: Partial<Commission> = {}): Commission {
  const now = new Date("2026-01-01T00:00:00.000Z").toISOString();
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

describe("reserveCommission", () => {
  it("transiciona available -> reserved e incrementa version", () => {
    const commission = buildCommission();
    const now = new Date("2026-01-02T00:00:00.000Z");

    const result = reserveCommission(commission, {
      advanceId: "44444444-4444-4444-4444-444444444444",
      idempotencyKey: "req-0001",
      ttlMinutes: 15,
      now,
    });

    expect(result.status).toBe("reserved");
    expect(result.reservedByAdvanceId).toBe("44444444-4444-4444-4444-444444444444");
    expect(result.reservationIdempotencyKey).toBe("req-0001");
    expect(result.reservedAt).toBe(now.toISOString());
    expect(result.reservationExpiresAt).toBe(new Date(now.getTime() + 15 * 60_000).toISOString());
    expect(result.version).toBe(commission.version + 1);
    expect(result.updatedAt).toBe(now.toISOString());
  });

  it("é idempotente para retry com a mesma idempotencyKey (retorna o mesmo objeto, sem incrementar version)", () => {
    const reserved = buildCommission({
      status: "reserved",
      reservedByAdvanceId: "44444444-4444-4444-4444-444444444444" as Commission["reservedByAdvanceId"],
      reservationIdempotencyKey: "req-0001",
      reservedAt: "2026-01-02T00:00:00.000Z",
      reservationExpiresAt: "2026-01-02T00:15:00.000Z",
      version: 1,
    });

    const result = reserveCommission(reserved, {
      advanceId: "44444444-4444-4444-4444-444444444444",
      idempotencyKey: "req-0001",
      ttlMinutes: 15,
    });

    expect(result).toBe(reserved);
    expect(result.version).toBe(1);
  });

  it("rejeita reserva de uma comissão já reservada por outra idempotencyKey", () => {
    const reserved = buildCommission({
      status: "reserved",
      reservedByAdvanceId: "44444444-4444-4444-4444-444444444444" as Commission["reservedByAdvanceId"],
      reservationIdempotencyKey: "req-0001",
      reservedAt: "2026-01-02T00:00:00.000Z",
      reservationExpiresAt: "2026-01-02T00:15:00.000Z",
      version: 1,
    });

    expect(() =>
      reserveCommission(reserved, {
        advanceId: "55555555-5555-5555-5555-555555555555",
        idempotencyKey: "req-OUTRA",
        ttlMinutes: 15,
      }),
    ).toThrow(CommissionStateError);
  });

  it.each(["pending", "advanced", "paid"] as const)(
    "rejeita reserva quando status é %s",
    (status) => {
      const commission = buildCommission({ status });
      expect(() =>
        reserveCommission(commission, {
          advanceId: "44444444-4444-4444-4444-444444444444",
          idempotencyKey: "req-0001",
          ttlMinutes: 15,
        }),
      ).toThrow(CommissionStateError);
    },
  );
});

describe("releaseCommission", () => {
  it("transiciona reserved -> available e limpa os campos de reserva", () => {
    const reserved = buildCommission({
      status: "reserved",
      reservedByAdvanceId: "44444444-4444-4444-4444-444444444444" as Commission["reservedByAdvanceId"],
      reservationIdempotencyKey: "req-0001",
      reservedAt: "2026-01-02T00:00:00.000Z",
      reservationExpiresAt: "2026-01-02T00:15:00.000Z",
      version: 1,
    });
    const now = new Date("2026-01-03T00:00:00.000Z");

    const result = releaseCommission(reserved, now);

    expect(result.status).toBe("available");
    expect(result.reservedByAdvanceId).toBeNull();
    expect(result.reservationIdempotencyKey).toBeNull();
    expect(result.reservedAt).toBeNull();
    expect(result.reservationExpiresAt).toBeNull();
    expect(result.version).toBe(2);
    expect(result.updatedAt).toBe(now.toISOString());
  });

  it.each(["available", "pending", "advanced", "paid"] as const)(
    "rejeita release quando status é %s",
    (status) => {
      const commission = buildCommission({ status });
      expect(() => releaseCommission(commission)).toThrow(CommissionStateError);
    },
  );
});

describe("isReservationExpired", () => {
  it("retorna false para comissão que não está reservada", () => {
    expect(isReservationExpired(buildCommission({ status: "available" }))).toBe(false);
  });

  it("retorna false antes do TTL expirar", () => {
    const commission = buildCommission({
      status: "reserved",
      reservationExpiresAt: "2026-01-02T00:15:00.000Z",
    });
    expect(isReservationExpired(commission, new Date("2026-01-02T00:10:00.000Z"))).toBe(false);
  });

  it("retorna true depois do TTL expirar", () => {
    const commission = buildCommission({
      status: "reserved",
      reservationExpiresAt: "2026-01-02T00:15:00.000Z",
    });
    expect(isReservationExpired(commission, new Date("2026-01-02T00:20:00.000Z"))).toBe(true);
  });

  it("considera o instante exato de expiração como expirado", () => {
    const commission = buildCommission({
      status: "reserved",
      reservationExpiresAt: "2026-01-02T00:15:00.000Z",
    });
    expect(isReservationExpired(commission, new Date("2026-01-02T00:15:00.000Z"))).toBe(true);
  });
});

describe("markCommissionAdvanced", () => {
  it("transiciona reserved -> advanced quando reservada pelo advanceId correto", () => {
    const reserved = buildCommission({
      status: "reserved",
      reservedByAdvanceId: "44444444-4444-4444-4444-444444444444" as Commission["reservedByAdvanceId"],
      version: 1,
    });

    const result = markCommissionAdvanced(reserved, "44444444-4444-4444-4444-444444444444");

    expect(result.status).toBe("advanced");
    expect(result.version).toBe(2);
  });

  it("rejeita quando reservada por outro advanceId", () => {
    const reserved = buildCommission({
      status: "reserved",
      reservedByAdvanceId: "44444444-4444-4444-4444-444444444444" as Commission["reservedByAdvanceId"],
    });

    expect(() =>
      markCommissionAdvanced(reserved, "99999999-9999-9999-9999-999999999999"),
    ).toThrow(CommissionStateError);
  });

  it("rejeita quando não está reservada", () => {
    const commission = buildCommission({ status: "available" });
    expect(() =>
      markCommissionAdvanced(commission, "44444444-4444-4444-4444-444444444444"),
    ).toThrow(CommissionStateError);
  });
});
