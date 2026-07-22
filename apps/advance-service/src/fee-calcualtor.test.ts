import { calculateAdvanceFee, FeeCalculationError } from "./fee-calcualtor";

const DAY = 24 * 60 * 60 * 1000;

describe("calculateAdvanceFee", () => {
  it("calcula taxa e valor líquido no caso padrão (30 dias, 3% ao mês)", () => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 30 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 10000, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 0.03,
    });

    expect(result.daysAdvanced).toBe(30);
    expect(result.feeAmount).toEqual({ amountCents: 300, currency: "BRL" });
    expect(result.netAmount).toEqual({ amountCents: 9700, currency: "BRL" });
  });

  it("arredonda só uma vez, no final (round-half-up)", () => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 17 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 1699, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 0.085,
    });

    // 1699 * (0.085/30) * 17 = 81.835166... -> arredonda para 82, uma única vez
    expect(result.feeAmount.amountCents).toBe(82);
    expect(result.netAmount.amountCents).toBe(1617);
  });

  it("aplica a taxa mínima quando o cálculo proporcional fica abaixo dela", () => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 1 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 10000, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 0.03,
      minFeeAmountCents: 50,
    });

    // taxa proporcional para 1 dia seria 10 centavos, bem abaixo do mínimo de 50
    expect(result.feeAmount.amountCents).toBe(50);
    expect(result.netAmount.amountCents).toBe(9950);
  });

  it("não aplica a taxa mínima quando o cálculo já é maior que ela", () => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 30 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 10000, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 0.03,
      minFeeAmountCents: 50,
    });

    expect(result.feeAmount.amountCents).toBe(300);
  });

  it("aplica o teto de taxa como proporção da comissão em prazos muito longos/taxas altas", () => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 60 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 10000, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 0.5, // agressiva de propósito, pra forçar o teto
      maxFeeRatioOfCommission: 0.5,
    });

    // sem teto a taxa seria 10000 (100% da comissão); o teto trava em 50%
    expect(result.feeAmount.amountCents).toBe(5000);
    expect(result.netAmount.amountCents).toBe(5000);
  });

  it("nunca deixa o netAmount negativo (teto garante isso mesmo em cenário extremo)", () => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 365 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 10000, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 2, // 200% ao mês, cenário absurdo de propósito
      maxFeeRatioOfCommission: 0.9,
    });

    expect(result.netAmount.amountCents).toBeGreaterThanOrEqual(0);
    expect(result.feeAmount.amountCents).toBe(9000);
  });

  it("funciona para comissão parcialmente antecipada (fração do valor total como input)", () => {
    // comissão total de 1000, mas só 400 estão sendo antecipados agora —
    // quem decide a fração é o service layer; a função só precisa receber
    // o valor da fração e calcular normalmente sobre ele.
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 30 * DAY);

    const result = calculateAdvanceFee({
      commissionAmount: { amountCents: 400, currency: "BRL" },
      requestDate,
      expectedPaymentDate,
      feeRateMonthly: 0.03,
    });

    expect(result.feeAmount.amountCents).toBe(12); // 400 * 0.001 * 30
    expect(result.netAmount.amountCents).toBe(388);
  });

  it.each([0, -1])(
    "rejeita quando daysAdvanced <= 0 (expectedPaymentDate não é depois de requestDate, offset=%i dias)",
    (offsetDays) => {
      const requestDate = new Date("2026-01-01T00:00:00.000Z");
      const expectedPaymentDate = new Date(requestDate.getTime() + offsetDays * DAY);

      expect(() =>
        calculateAdvanceFee({
          commissionAmount: { amountCents: 1000, currency: "BRL" },
          requestDate,
          expectedPaymentDate,
          feeRateMonthly: 0.03,
        }),
      ).toThrow(FeeCalculationError);
    },
  );

  it.each([0, -100])("rejeita quando commissionAmount não é positivo (%i)", (amountCents) => {
    const requestDate = new Date("2026-01-01T00:00:00.000Z");
    const expectedPaymentDate = new Date(requestDate.getTime() + 30 * DAY);

    expect(() =>
      calculateAdvanceFee({
        commissionAmount: { amountCents, currency: "BRL" },
        requestDate,
        expectedPaymentDate,
        feeRateMonthly: 0.03,
      }),
    ).toThrow(FeeCalculationError);
  });
});
