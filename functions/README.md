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
  context.ts             ← prefixo fixo (prompt + dossiê) + resumo + janela de turnos
  quota.ts               ← regras de cota (puras)
  store.ts               ← Firestore (transações de reserva/liberação/conclusão)
  prompts/               ← opponent.ts, judge.ts, summary.ts, report.ts (provisórios, exceto report)
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
npm run compare -- --file scripts/compare-args.tpi.json --judge   --scenarios gemini-3.1-flash-lite:low,gemini-3.1-flash-lite:minimal,gemini-3.5-flash-lite:low
```

Cada cenário é `modelo:thinkingLevel`. `--judge` roda também o juiz (análise por turno, com o schema) sobre a réplica do mesmo cenário. `--args 1,3` roda só esses argumentos, `--judge-max-tokens N` troca o teto de saída do juiz e `--out arquivo.json` grava tudo em JSON. Em comitê de blocos (TPI), cada argumento diz o bloco do aluno (`"aluno"`), e o oponente fica com o bloco contrário.

Faz chamadas reais e cobradas, sem retry. O script também imprime o log `prefix_tokens` (tamanho do prefixo fixo do oponente e do juiz) e avisa se ele estiver abaixo de 4.096 tokens (nesse caso o cache implícito não ativa).

## Capacidade (RPM/TPM) — pico de 200 alunos

**Variáveis** (padrões em `src/config.ts`):

| | | |
|---|---|---|
| `U` | alunos debatendo ao mesmo tempo | 200 |
| `T` | segundos entre dois turnos do mesmo aluno | ≥ 20 (`QUOTA.minSecondsBetweenTurns`, contado do início do turno anterior) |
| `N` | analisar a cada N turnos | 1 (`ANALYSIS.analyzeEveryTurns`) |
| `S` | resumo a cada S turnos | 3 (`CONTEXT.summaryEveryTurns`) |
| `L` | latência do oponente | ~3 s (medido: 2–3 s; picos de 10–18 s com retry de rede) |

**Fórmulas:**

```
turnos/min        = U × 60 / T
RPM oponente      = turnos/min                      → pool gemini-3.1-flash-lite
RPM resumo        = turnos/min / S                  → pool gemini-3.1-flash-lite
RPM análise       = turnos/min / N                  → pool gemini-3.5-flash-lite (modelo separado)
chamadas em voo   = RPM oponente × L / 60           (concorrência das instâncias)
TPM entrada       = Σ RPM × tokens de entrada por chamada
```

**Tokens por chamada.** O cenário "com dossiê real" é o que vale para novembro.

| Chamada | Medido hoje (dossiê placeholder, prefixo ~216 tokens) | Com dossiê real (prefixo P ≈ 4.500) |
|---|---|---|
| Oponente, entrada | 371 (turno 1) → 1.489 (turno 4); regime ≈ P + 2.000 | ≈ 6.500 |
| Oponente, saída | ~235 visível + ~120 raciocínio (pico raro: 949) | igual |
| Análise, entrada | 544–785 (P_juiz ≈ 180) | ≈ 5.100 |
| Resumo, entrada | ≈ 1.300 (estimado: 3 turnos + resumo anterior) | igual (sem dossiê) |

### (a) Pior caso: todos no intervalo mínimo (T = 20 s)

```
turnos/min   = 200 × 60 / 20 = 600
3.1 Flash-Lite: oponente 600 + resumo 600/3 = 200   → 800 RPM
3.5 Flash-Lite: análise 600/1                        → 600 RPM
em voo:        600 × 3 / 60                          → ~30 chamadas simultâneas ao oponente
TPM (dossiê real):
  3.1: 600 × 6.500 + 200 × 1.300 = 3,90M + 0,26M     → ~4,2M TPM
  3.5: 600 × 5.100                                   → ~3,1M TPM
```

Esse pico dura no máximo ~4 min por debate (12 turnos × 20 s, limite `QUOTA.turnsPerDebate`).

### (b) Realista: fala por voz, um turno a cada 60–120 s

```
                     T = 60 s                  T = 120 s
turnos/min           200 × 60/60 = 200         200 × 60/120 = 100
3.1 (oponente+res.)  200 + 67   = 267 RPM      100 + 33   = 133 RPM
3.5 (análise)        200 RPM                    100 RPM
TPM 3.1 (dossiê)     200×6.500 + 67×1.300 ≈ 1,39M     ≈ 0,69M
TPM 3.5 (dossiê)     200×5.100 ≈ 1,02M                ≈ 0,51M
em voo (oponente)    ~10                        ~5
```

**Teto diário.** No máximo, cada aluno faz 3 debates × 12 turnos = 36 turnos por dia. Com 200 alunos, isso dá 7.200 turnos por dia:

| Pool | Requisições por dia |
|---|---|
| 3.1 Flash-Lite | 7.200 + 2.400 (resumo) = 9.600 |
| 3.5 Flash-Lite | 7.200 |
| 3.8 Flash (relatórios) | 600 |

**Margem.** Cada retry por 429/503 é mais uma requisição. Deixe 20–30% de folga sobre esses números ao conferir os limites do tier no AI Studio. Considere também que tokens cacheados contam no TPM.

**Botões para aliviar:**
- `ANALYSIS.analyzeEveryTurns = 2` corta a RPM da análise pela metade.
- Subir `minSecondsBetweenTurns` reduz o pior caso de forma proporcional.
- Trocar o modelo de um papel move a carga para outro pool (os limites são por modelo).

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

No Cloud Logging:

```
jsonPayload.message="llm_call"
```

O custo acumulado da sessão fica em `debates/{id}.usage.costUsd`, e o do dia em `usage/{uid}/days/{AAAA-MM-DD}.costUsd`.
