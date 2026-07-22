import { money, addMoney, subtractMoney, sumMoney, isNegative, multiplyMoney } from "./money";

describe("money", () => {
  it("cria Money a partir de um inteiro de centavos", () => {
    expect(money(1990)).toEqual({ amountCents: 1990, currency: "BRL" });
  });

  it("rejeita valores não inteiros", () => {
    expect(() => money(19.9)).toThrow(/integer/);
  });

  it("aceita zero e negativos (estorno/ajuste)", () => {
    expect(money(0).amountCents).toBe(0);
    expect(money(-500).amountCents).toBe(-500);
  });
});

describe("addMoney / subtractMoney / sumMoney", () => {
  it("soma sem erro de ponto flutuante", () => {
    const a = money(10);
    const b = money(20);
    expect(addMoney(a, b).amountCents).toBe(30);
  });

  it("subtrai corretamente, incluindo resultado negativo", () => {
    expect(subtractMoney(money(100), money(150)).amountCents).toBe(-50);
  });

  it("soma uma lista de valores", () => {
    const values = [money(100), money(200), money(300)];
    expect(sumMoney(values).amountCents).toBe(600);
  });

  it("soma de lista vazia é zero", () => {
    expect(sumMoney([]).amountCents).toBe(0);
  });
});

describe("isNegative", () => {
  it("identifica valores negativos", () => {
    expect(isNegative(money(-1))).toBe(true);
    expect(isNegative(money(0))).toBe(false);
    expect(isNegative(money(1))).toBe(false);
  });
});

describe("multiplyMoney", () => {
  it("arredonda só no final (round-half-up), sem erro de float acumulado", () => {
    // 199.90 (19990 centavos) * 8,5% = 1699.15 -> arredonda para 1699
    expect(multiplyMoney(money(19990), 0.085).amountCents).toBe(1699);
  });

  it("arredonda .5 para cima", () => {
    expect(multiplyMoney(money(100), 0.125).amountCents).toBe(13); // 12.5 -> 13
  });

  it("fator zero resulta em zero", () => {
    expect(multiplyMoney(money(19990), 0).amountCents).toBe(0);
  });

  it("fator 1 preserva o valor original", () => {
    expect(multiplyMoney(money(19990), 1).amountCents).toBe(19990);
  });
});
