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
scripts/compare-opponent.ts ← compara dois modelos no prompt do oponente
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
npm run compare -- --file meus-args.json --models gemini-3.1-flash-lite,gemini-3.8-flash
```

Faz chamadas reais e cobradas. O script também mostra o tamanho do prefixo fixo e avisa se ele estiver abaixo de 4.096 tokens (nesse caso o cache implícito não ativa).

## Logs

Cada chamada gera um `llm_call` (modelo, tokens de entrada/saída/raciocínio/cache, latência, custo estimado, debateId), sem o texto do aluno. Falhas transitórias geram `llm_attempt_failed`, e bloqueios de segurança geram `llm_blocked` (motivo e categorias). No Cloud Logging:

```
jsonPayload.message="llm_call"
```

O custo acumulado da sessão fica em `debates/{id}.usage.costUsd`, e o do dia em `usage/{uid}/days/{AAAA-MM-DD}.costUsd`.
