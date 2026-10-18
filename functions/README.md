# Backend de IA do Debate Trainer (Cloud Functions 2ª geração)

| Função | Tipo | O que faz |
|---|---|---|
| `debateTurn` | callable (streaming) | Fala do aluno → réplica do oponente. Auth obrigatória, App Check por parâmetro, cota em transação. |
| `onTurnCreated` | trigger Firestore | Assíncrono: análise estruturada do turno (juiz) e, a cada 3 turnos, atualização do resumo. |
| `debateReport` | callable | Relatório final (prompt do antigo `api/evaluate.js`) com saída estruturada. |

Região: `southamerica-east1` (mesma do Firestore). Tudo o que é ajustável (cotas, modelos por papel, retry, safety, preços e escala) fica em `src/config.ts`.

## Estrutura

```
src/
  config.ts              ← ÚNICO lugar de cotas, modelos, retry, safety, preços, escala
  index.ts               ← exports das functions
  handlers/              ← debateTurn, debateReport, onTurnCreated
  llm/provider.ts        ← interface LLMProvider (plugar outro provedor depois)
  llm/gemini.ts          ← implementação Gemini (@google/genai)
  llm/retry.ts           ← backoff exponencial + jitter → modelo de reserva
  llm/semaphore.ts       ← limite de chamadas simultâneas por instância
  llm/router.ts          ← chamada por papel (opponent/turnAnalysis/summary/report)
  judgeGuards.ts         ← guardas sobre a saída do juiz (trecho de falácia, "falsa", refutacao no turno 1)
  context.ts             ← prefixo fixo (prompt + dossiê) + resumo + janela de turnos
  quota.ts               ← regras de cota (puras)
  store.ts               ← Firestore (transações de reserva/liberação/conclusão)
  prompts/               ← opponent.ts, judge.ts, summary.ts, report.ts (provisórios, exceto report); tpi.ts (comitê TPI)
  schemas/               ← turnAnalysis.ts, report.ts (responseJsonSchema)
  dossiers/<id>.md       ← dossiê do comitê, carregado inteiro no prefixo (_default.md se faltar)
scripts/compare-opponent.ts ← compara cenários (modelo + raciocínio) no oponente e no juiz
test/                    ← vitest (Gemini mockado)
```

## Testes unitários

```bash
cd functions
npm install
npm test           # cota, janela + resumo, retry/backoff/fallback, semáforo, custo
npm run typecheck
```

## Rodar no Emulator Suite

1. `functions/.env.local` (copie de `.env.local.example`): `ENFORCE_APP_CHECK=false`
2. `functions/.secret.local` (gitignored), uma linha: `GEMINI_API_KEY=sua-chave`
   (o emulador chama o Gemini **de verdade**; só Auth/Firestore/Functions são emulados)
3. Na raiz do repo:
   ```bash
   npm --prefix functions run build
   firebase emulators:start --only auth,firestore,functions
   ```
   UI do emulador: http://127.0.0.1:4000
4. Frontend contra o emulador: no `.env.local` da raiz, `VITE_USE_EMULATORS=true`, e depois `npm run dev`.
   (Atenção: com isso o login passa a usar o Auth emulado. Crie um usuário na UI do emulador.)
5. Para recompilar a cada mudança: `npm --prefix functions run build:watch` (o emulador recarrega sozinho).

Chamada manual (protocolo callable, sem streaming), com um ID token do Auth emulado:

```bash
curl -s http://127.0.0.1:5001/munconnectg/southamerica-east1/debateTurn \
  -H "Authorization: Bearer $ID_TOKEN" -H "Content-Type: application/json" \
  -d '{"data":{"committeeId":"SOLIDARNOSC","userText":"...","locale":"pt-BR","setup":{"topic":"...","userCountry":{"code2":"AA","name":"..."},"aiDelegation":{"code2":"BB","name":"..."}}}}'
```

Com `-H "Accept: text/event-stream"` a resposta vem em streaming (SSE).

## Comparar modelos do oponente

```bash
cd functions
npm run compare -- --file scripts/compare-args.example.json
npm run compare -- --file scripts/compare-args.tpi.json --judge --scenarios config
npm run compare -- --file scripts/compare-args.tpi.json --judge --scenarios gemini-3.1-flash-lite:low,gemini-3.5-flash-lite:low
```

Cada cenário é `modelo:thinkingLevel`, ou `config`: o caminho de produção (`callModel` com os papéis de `config.ts`, retry, reserva e validação do JSON do juiz). Em todos, a análise passa pelas guardas de `judgeGuards.ts` e o script imprime o que elas corrigiram. Um argumento com `"turns": [...]` roda falas seguidas no mesmo debate (com janela de turnos). `--judge` roda também o juiz (análise por turno, com o schema) sobre a réplica do mesmo cenário. `--args 1,3` roda só esses argumentos, `--judge-max-tokens N` troca o teto de saída do juiz e `--out arquivo.json` grava tudo em JSON. Em comitê de blocos (TPI), cada argumento diz o bloco do aluno (`"aluno"`), e o oponente fica com o bloco contrário.

Faz chamadas reais e cobradas (sem retry, exceto no cenário `config`). O script também imprime o log `prefix_tokens` (tamanho do prefixo fixo do oponente e do juiz) e avisa se ele estiver abaixo de 4.096 tokens (nesse caso o cache implícito não ativa).

## Capacidade (RPM/TPM) — pico de 200 alunos

**Variáveis** (padrões em `src/config.ts`):

| | | |
|---|---|---|
| `U` | alunos debatendo ao mesmo tempo | 200 |
| `T` | segundos entre dois turnos do mesmo aluno | ≥ 20 (`QUOTA.minSecondsBetweenTurns`, contado do início do turno anterior) |
| `N` | analisar a cada N turnos | 1 (`ANALYSIS.analyzeEveryTurns`) |
| `S` | resumo a cada S turnos | 3 (`CONTEXT.summaryEveryTurns`) |
| `L` | latência do oponente | ~4,5 s (3.5 Flash-Lite low, compare de 2026-10-18: 3,7–5,1 s) |
| `J` | latência do juiz | ~7 s (3.1 Flash-Lite low: 6,5–7,6 s sem retry) |
| `p` | fração de chamadas que caem na reserva | medir em `llm_call` (`isFallback`); 1/8 no compare |

**Modelos por papel** (`ROLES` em `src/config.ts`; os limites RPM/TPM são **por modelo**):

| Papel | Principal | Reserva |
|---|---|---|
| Oponente | gemini-3.5-flash-lite · low | gemini-3.1-flash-lite · minimal |
| Resumo | gemini-3.5-flash-lite · low | gemini-3.1-flash-lite · minimal |
| Análise (juiz) | gemini-3.1-flash-lite · low · 4096 tokens de saída | gemini-3.5-flash-lite · low |
| Relatório | gemini-3.8-flash · low | gemini-3.5-flash-lite |

**Fórmulas por modelo:**

```
turnos/min          = U × 60 / T
RPM oponente        = turnos/min
RPM resumo          = turnos/min / S
RPM análise         = turnos/min / N

RPM 3.5 Flash-Lite  = (RPM oponente + RPM resumo) × (1 − p)  +  RPM análise × p
RPM 3.1 Flash-Lite  =  RPM análise × (1 − p)                 + (RPM oponente + RPM resumo) × p
(com p ≈ 0 no dia a dia; cada retry no mesmo modelo é +1 requisição nesse pool)

em voo (oponente)   = RPM oponente × L / 60      (concorrência de debateTurn)
em voo (juiz)       = RPM análise × J / 60       (concorrência de onTurnCreated)
TPM entrada         = Σ RPM × tokens de entrada por chamada (tokens cacheados contam)
```

**Tokens por chamada** (dossiê real do TPI; prefixo fixo P ≈ 5.130 no oponente e no juiz):

| Chamada | Medido (turno 1, sem resumo) | Regime (com resumo e janela) |
|---|---|---|
| Oponente, entrada | 5.315–5.345; turno 3 do mesmo debate: 5.884 | ≈ P + 2.000 ≈ 7.100 |
| Oponente, saída | ~225 visível + ~1.090 raciocínio | igual |
| Análise, entrada | 5.450–5.530 | ≈ 5.500 (não leva a janela) |
| Análise, saída | ~970 JSON + ~1.280 raciocínio | igual |
| Resumo, entrada | ≈ 1.300 (estimado: 3 turnos + resumo anterior) | igual (sem dossiê) |

### (a) Pior caso: todos no intervalo mínimo (T = 20 s)

```
turnos/min   = 200 × 60 / 20 = 600
3.5 Flash-Lite: oponente 600 + resumo 600/3 = 200   → 800 RPM
3.1 Flash-Lite: análise 600/1                        → 600 RPM
em voo:        oponente 600 × 4,5 / 60 ≈ 45 · juiz 600 × 7 / 60 = 70
TPM:
  3.5: 600 × 7.100 + 200 × 1.300 = 4,26M + 0,26M     → ~4,5M TPM
  3.1: 600 × 5.500                                   → ~3,3M TPM
```

Esse pico dura no máximo ~4 min por debate (12 turnos × 20 s, limite `QUOTA.turnsPerDebate`).

### (b) Realista: fala por voz, um turno a cada 60–120 s

```
                     T = 60 s                  T = 120 s
turnos/min           200 × 60/60 = 200         200 × 60/120 = 100
3.5 (oponente+res.)  200 + 67   = 267 RPM      100 + 33   = 133 RPM
3.1 (análise)        200 RPM                    100 RPM
TPM 3.5              200×7.100 + 67×1.300 ≈ 1,51M     ≈ 0,75M
TPM 3.1              200×5.500 ≈ 1,10M                ≈ 0,55M
em voo (op. / juiz)  ~15 / ~23                  ~8 / ~12
```

**Teto diário.** No máximo, cada aluno faz 3 debates × 12 turnos = 36 turnos por dia. Com 200 alunos, isso dá 7.200 turnos por dia:

| Pool | Requisições por dia |
|---|---|
| 3.5 Flash-Lite | 7.200 + 2.400 (resumo) = 9.600 |
| 3.1 Flash-Lite | 7.200 |
| 3.8 Flash (relatórios) | 600 |

**Margem.** Cada retry é mais uma requisição: por 429/503 e, agora, também por resposta inutilizável (vazia, `MALFORMED_RESPONSE`, `finishReason` inesperado ou JSON inválido do juiz). Se um pool entrar em 429 sustentado, `p` sobe e a carga passa para o outro modelo pelas fórmulas acima. Deixe 20–30% de folga sobre esses números ao conferir os limites do tier no AI Studio.

**Botões para aliviar:**
- `ANALYSIS.analyzeEveryTurns = 2` corta a RPM da análise pela metade.
- Subir `minSecondsBetweenTurns` reduz o pior caso de forma proporcional.
- Trocar o modelo de um papel move a carga para outro pool (os limites são por modelo).

## Custo por turno e por debate

Tokens medidos em 2026-10-18 no comitê TPI (dossiê real), na configuração de `ROLES`: oponente e juiz pela média de 15 chamadas do `npm run compare --scenarios config`; resumo e relatório numa transcrição de 10 turnos montada com falas reais do compare. Preços de tabela (`PRICES` em `src/config.ts`, US$ por 1M de tokens; raciocínio é cobrado como saída):

| Modelo | Entrada | Entrada cacheada | Saída |
|---|---|---|---|
| gemini-3.5-flash-lite | 0,30 | 0,03 | 2,50 |
| gemini-3.1-flash-lite | 0,25 | 0,025 | 1,50 |
| gemini-3.8-flash (até 31/12/2026) | 0,75 | 0,075 | 3,75 |

| Chamada | Modelo | Entrada (cacheada) | Saída + raciocínio | Custo com o cache medido | Sem cache |
|---|---|---|---|---|---|
| Oponente (1 por turno) | 3.5 FL low | 5.467 (1.763) | 222 + 771 | US$ 0,00365 | US$ 0,00412 |
| Juiz (1 por turno, N = 1) | 3.1 FL low | 5.519 (1.970) | 995 + 1.362 | US$ 0,00447 | US$ 0,00492 |
| Resumo (1 a cada 3 turnos) | 3.5 FL low | 1.208 (0) | 290 + 0 | US$ 0,00109 | igual |
| Relatório (1 por debate) | 3.8 Flash low | 9.615 (0) | 1.111 + 0 | US$ 0,0114 | igual |

```
custo por turno   = oponente + juiz + resumo / 3
                  = 0,00365 + 0,00447 + 0,00036 ≈ US$ 0,0085   (sem cache: US$ 0,0094)

debate de 10 turnos = 10 × oponente + 10 × juiz + 3 × resumo + relatório
                  = 0,0365 + 0,0447 + 0,0033 + 0,0114 ≈ US$ 0,096   (sem cache: US$ 0,105)
                  a partir de 01/01/2027 (3.8 Flash dobra): ≈ US$ 0,107
```

Por 1.000 debates de 10 turnos: ≈ US$ 96. Observações:
- O raciocínio é cerca de metade do custo do oponente (53%) e do juiz (46%). O raciocínio do oponente varia muito entre rodadas (média de 1.087 tokens numa, 409 na outra, com chamadas em 0), então o custo do oponente oscila entre ~US$ 0,0025 e ~US$ 0,0045.
- O cache implícito pegou só parte do prefixo (~1.760 de ~5.130 tokens no oponente, ~1.970 no juiz) e economiza ~10% por turno.
- Não entram aqui: retries (cada um é uma chamada a mais), a janela crescendo nos turnos seguintes (+~300 tokens de entrada por turno no oponente, até 4 turnos) e o custo das Cloud Functions/Firestore.
- Com `ANALYSIS.analyzeEveryTurns = 2`, o juiz cai pela metade e o turno fica em ≈ US$ 0,0063.

## Relatório final: timeouts e estado para a UI

| Camada | Valor | Onde |
|---|---|---|
| Função `debateReport` | 300 s (1800 s com Flex) | `FUNCTIONS.debateReport.timeoutSeconds` |
| Orçamento de retry | 270 s, dos quais os últimos 60 s ficam para o modelo de reserva | `ROLES.report.deadlineMs` / `fallbackReserveMs` |
| Uma tentativa | 150 s (600 s com Flex), nunca < 10 s | `ROLES.report.timeoutMs` |
| Cliente (`httpsCallable`) | 310 s | `src/services/debateAI.js` → `REPORT_TIMEOUT_MS` |

O relatório leva ~75 s no 3.8 Flash. Para a UI, o estado vive em `debates/{id}`:

```
reportStatus: null → "generating" (reportStartedAt) → "done" (report)
                                                     ↘ "error" (reportError.reason)
```

`useDebateReport(debateId)` (em `src/hooks/useDebateReport.js`) junta a chamada com um `onSnapshot` desse doc:
- Se o cliente estourar o timeout ou fechar a página, a função **continua** e grava o resultado. Isso foi testado no emulador: o cliente abortou aos 5 s e o relatório ficou `done` em 80 s.
- Um `generating` com mais de 360 s vira `error` com `reason: "stale"`. Nesse caso a UI pode oferecer "tentar de novo".

## Diagnóstico do cache (prefixo fixo)

Uma vez por instância, para cada papel + comitê + modelo, o log registra `prefix_tokens`, que é o tamanho do system prompt + dossiê:
- Abaixo de 4.096 tokens, o registro sai como **warning**, com `cacheEligible: false`.
- Hoje, com o dossiê placeholder, o valor é **216** (oponente) e **180** (juiz).

```
jsonPayload.message="prefix_tokens"
```

## Logs

Nenhum desses logs inclui o texto do aluno:

| Log | Quando aparece | O que registra |
|---|---|---|
| `llm_call` | cada chamada | modelo, tokens de entrada/saída/raciocínio/cache, latência, custo estimado, debateId |
| `llm_attempt_failed` | cada falha transitória | tipo e status da falha |
| `llm_call_failed` | quando a chamada falha de vez, depois do retry e do modelo de reserva | — |
| `llm_blocked` | bloqueio de segurança | motivo e categorias |
| `llm_truncated` | `finishReason = MAX_TOKENS` | o turno fica com `truncated: true` |
| `judge_trecho_invalido` | o juiz cita como falácia um trecho que não está em nenhuma das duas falas | lado e tipo da falácia descartada |

No Cloud Logging:

```
jsonPayload.message="llm_call"
```

## Guardas do juiz (`src/judgeGuards.ts`)

Aplicadas à análise antes de gravar; o que cada uma corrigiu fica em `turns/{id}.analysisGuards`:

| Guarda | Regra | Campo |
|---|---|---|
| Trecho de falácia | trecho (normalizado: minúsculas, pontuação, espaços; reticências aceitas) fora das duas falas → falácia descartada | `fallaciesDropped` |
| Premissa de valor | `valor` + `falsa` → `fraca` | `valueFalseToWeak` |
| "falsa" sem evidência | `falsa` com `evidencia_dossie` vazio → `nao_verificavel` | `falseWithoutEvidence` |
| Falácia "outra" | confiança no máximo `possivel` | `otherFallacyDowngraded` |
| Turno 1 | `rubrica.refutacao = null` | `refutacaoNulled` |
| Fonte específica | fala sem fonte específica → todas as notas da rubrica limitadas a 3 | `citesSource`, `scoresCapped` |

A guarda de fonte específica é uma **heurística**, não uma verificação jurídica: conta como fonte um número de artigo, regra ou resolução (`art. 12`, `artigo 8`, `regra 20`, `resolução 2334`) ou uma citação nominal de decisão (decisão, acórdão, sentença, Câmara, caso ou mandado seguido, na mesma frase, de data ou nome próprio: "a decisão de 21/11/2024", "o caso Bemba"). Não confere se a fonte existe nem se está no dossiê; uma fonte citada de outro jeito não é reconhecida, e "a Câmara reconheceu a Palestina" passa como citação.

O custo acumulado da sessão fica em `debates/{id}.usage.costUsd`, e o do dia em `usage/{uid}/days/{AAAA-MM-DD}.costUsd`.
