# bliss-commission-advance

Serviço de antecipação de comissões de vendedores: dois serviços HTTP (`commission-service` e `advance-service`) que se comunicam de forma síncrona (reserva de comissão) e assíncrona (liquidação via evento em fila), com infra como código (Terraform) contra LocalStack simulando DynamoDB, SQS, Lambda e API Gateway.

## Estrutura inicial

```
apps/
  commission-service/   # dono de Sale, Seller e Commission — reserva/libera comissões
  advance-service/      # dono de Advance — solicita antecipação e calcula a taxa
packages/
  shared/               # tipos e regras compartilhadas entre os dois serviços
infra/
  terraform/            # infra como código, contra LocalStack
```

### Por que monorepo

Optei por um **monorepo com npm workspaces** (`apps/*`, `packages/shared`) em vez de um repositório por serviço. A razão é de escopo/prazo (projeto pequeno, dois serviços, poucos dias), não dogma:

- os dois serviços **precisam** concordar exatamente no que é um `Money`, um `SellerId` ou o formato de um evento de domínio — num multi-repo isso viraria um pacote npm privado publicado e versionado só para isso, overhead que não se paga num projeto deste tamanho;
- uma única config de `tsconfig`, `eslint` e `prettier` para o projeto inteiro, em vez de duplicada em N repositórios;
- um schema compartilhado que muda não exige PR cruzado coordenado em dois repos.

Mesmo assim, cada `apps/*` já é estruturado como se fosse um módulo independente desde o início — `package.json`, dependências e `tsconfig.json` próprios, sem nada implícito compartilhado além do que vem explicitamente de `packages/shared`. Se algum dia um serviço precisar escalar ou fazer deploy separado (ou até sair para o próprio repositório), a separação já existe: o trabalho é extrair a pasta e publicar `packages/shared` como pacote de verdade, não reestruturar a arquitetura.

### `packages/shared`

Domínio comum entre as duas apps — existe para elas nunca divergirem no que é um `Money`, um ID ou um evento, e para permitir testar cada serviço sem depender do outro estar rodando.

- **`branded.ts`** — "branded types" para os IDs (`SellerId`, `SaleId`, `CommissionId`, `AdvanceId`). Todos são `string` (UUID) em runtime, mas o compilador não deixa passar, por exemplo, um `SellerId` onde se espera um `CommissionId` — sem isso, uma troca de parâmetro só seria pega em produção. Também define `IdempotencyKey`, usado tanto no header `Idempotency-Key` das rotas HTTP quanto para correlacionar a chamada de `reserve` com o `Advance` que a originou.
- **`money.ts`** — dinheiro é sempre inteiro em centavos (`amountCents`), nunca `float`, para não sofrer o clássico erro de arredondamento binário (`0.1 + 0.2 !== 0.3`). A única operação que pode gerar fração (aplicar uma taxa, em `multiplyMoney`) arredonda uma única vez, no final, para não acumular erro em cálculos compostos.
- **`event.ts`** — eventos de domínio (`AdvanceApprovedEvent`, `AdvanceRejectedEvent`) que trafegam pela fila SQS compartilhada entre as duas apps. Cada evento carrega seu próprio `eventId` (não reaproveita o `advanceId`), para o consumer conseguir deduplicar uma reentrega do mesmo evento de negócio sem ambiguidade.

### `apps/commission-service`

Dono das entidades `Seller`, `Sale` e `Commission`. Uma comissão segue a máquina de estados `pending → available → reserved → advanced | paid`, implementada como funções puras e guardadas (`reserveCommission`, `releaseCommission`, `markCommissionAdvanced`) — nenhum código de aplicação atribui `status` diretamente, sempre passa por elas, para garantir que a invariante de concorrência (campo `version`) seja respeitada em todo lugar. `reserveCommission` também já nasce idempotente pela `reservationIdempotencyKey`.

### `apps/advance-service`

Dono da entidade `Advance`. Contém o `fee-calculator`, que isola a regra de cálculo da taxa de antecipação (`taxa = comissão × (taxa_mensal / 30) × dias_antecipados`) como função pura, já com os edge cases do plano cobertos: taxa mínima, teto de taxa como proporção da comissão (evita taxa > 100% em prazos longos) e comissão parcialmente antecipada.
