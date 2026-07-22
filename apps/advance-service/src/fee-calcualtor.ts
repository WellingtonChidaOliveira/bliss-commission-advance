import { Money, money, multiplyMoney, subtractMoney } from "@bliss/shared/money";

/**
 * dias_antecipados = data_prevista_pagamento - data_solicitacao
 * taxa = valor_comissao * (taxa_mensal / 30) * dias_antecipados
 * valor_liquido = valor_comissao - taxa
 *
 * Tudo em centavos, arredondamento só na etapa final da multiplicação
 * (ver multiplyMoney). Edge cases tratados explicitamente abaixo — são
 * exatamente os pontos que a análise de arquitetura marcou como
 * prováveis perguntas de entrevistador sênior.
 */

export class FeeCalculationError extends Error {}

export interface FeeCalculationInput {
  commissionAmount: Money;
  expectedPaymentDate: Date;
  requestDate: Date;
  feeRateMonthly: number; // ex: 0.03 = 3% ao mês
  minFeeAmountCents?: number; // taxa mínima cobrada, se aplicável
  maxFeeRatioOfCommission?: number; // teto de taxa como fração da comissão, ex: 0.5 = taxa nunca > 50% do valor
}

export interface FeeCalculationResult {
  daysAdvanced: number;
  feeAmount: Money;
  netAmount: Money;
}

export function calculateAdvanceFee(input: FeeCalculationInput): FeeCalculationResult {
  const {
    commissionAmount,
    expectedPaymentDate,
    requestDate,
    feeRateMonthly,
    minFeeAmountCents = 0,
    maxFeeRatioOfCommission = 1,
  } = input;

  // Edge case: comissão já vencida ou solicitação na mesma data do pagamento —
  // não faz sentido cobrar taxa por antecipação de algo que não está sendo antecipado.
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysAdvanced = Math.ceil((expectedPaymentDate.getTime() - requestDate.getTime()) / msPerDay);

  if (daysAdvanced <= 0) {
    throw new FeeCalculationError(
      "Commission expectedPaymentDate must be in the future relative to requestDate to be advanceable",
    );
  }

  if (commissionAmount.amountCents <= 0) {
    throw new FeeCalculationError("commissionAmount must be positive");
  }

  // taxa = valor * (taxa_mensal / 30) * dias
  const dailyRate = feeRateMonthly / 30;
  let feeAmount = multiplyMoney(commissionAmount, dailyRate * daysAdvanced);

  // Edge case: taxa mínima
  if (feeAmount.amountCents < minFeeAmountCents) {
    feeAmount = money(minFeeAmountCents);
  }

  // Edge case: teto de taxa como proporção da comissão (evita taxa > 100% em prazos muito longos)
  const maxFeeCents = Math.round(commissionAmount.amountCents * maxFeeRatioOfCommission);
  if (feeAmount.amountCents > maxFeeCents) {
    feeAmount = money(maxFeeCents);
  }

  const netAmount = subtractMoney(commissionAmount, feeAmount);

  // Edge case: nunca deveria ficar negativo dado o teto acima, mas é uma
  // invariante barata de garantir explicitamente.
  if (netAmount.amountCents < 0) {
    throw new FeeCalculationError("Calculated netAmount is negative — check fee configuration");
  }

  return { daysAdvanced, feeAmount, netAmount };
}

/**
 * Comissão parcialmente antecipada: quando o pedido cobre só uma fração do
 * valor total da comissão. O cálculo acima já funciona se `commissionAmount`
 * recebido for o valor da FRAÇÃO solicitada, não o total — a validação de
 * que a fração não excede o saldo disponível é responsabilidade do service
 * layer (fora do domínio puro), pois depende de estado persistido.
 */