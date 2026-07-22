import { z } from "zod";

/**
 * Dinheiro é SEMPRE inteiro em centavos. Nunca usar `number` fracionário
 * (float) para valores monetários — problema clássico de 0.1 + 0.2.
 *
 * `amountCents` é a fonte da verdade. `currency` fixo em BRL por ora,
 * mas já modelado para não precisar de migração se isso mudar.
 */
export const MoneySchema = z.object({
  amountCents: z.number().int(),
  currency: z.literal("BRL").default("BRL"),
});
export type Money = z.infer<typeof MoneySchema>;

export function money(amountCents: number): Money {
  if (!Number.isInteger(amountCents)) {
    throw new Error(`Money must be an integer number of cents, got ${amountCents}`);
  }
  return { amountCents, currency: "BRL" };
}

export function addMoney(a: Money, b: Money): Money {
  return money(a.amountCents + b.amountCents);
}

export function subtractMoney(a: Money, b: Money): Money {
  return money(a.amountCents - b.amountCents);
}

export function sumMoney(values: Money[]): Money {
  return money(values.reduce((total, v) => total + v.amountCents, 0));
}

export function isNegative(m: Money): boolean {
  return m.amountCents < 0;
}

/**
 * Multiplica um valor monetário por um fator racional (ex: taxa),
 * arredondando SÓ no final, uma única vez, para minimizar erro acumulado.
 * Estratégia: round-half-up.
 */
export function multiplyMoney(m: Money, factor: number): Money {
  const rounded = Math.round(m.amountCents * factor);
  return money(rounded);
}