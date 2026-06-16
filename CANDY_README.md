# 🍬 Doce Mel — Site de Balas Artesanais

Site one-page para vender balas de fabricação caseira, com **muitas animações**
(Framer Motion). É **totalmente separado** do app MUNConnect — nenhum arquivo do
MUNConnect foi modificado.

## Arquivos (todos novos)

```
candy.html              # página HTML de entrada do site de balas
vite.candy.config.js    # config de build dedicado (não usa o vite.config.js principal)
src/candy/
  ├─ main.jsx           # ponto de entrada React
  ├─ Candy.jsx          # site completo (todas as seções + animações)
  ├─ data.js            # catálogo de balas, depoimentos, FAQ
  └─ candy.css          # fontes e keyframes de animação
```

## Como rodar

**Desenvolvimento** (abre em http://localhost:5174/candy.html):

```bash
npx vite --config vite.candy.config.js
```

> Alternativa: com o dev server padrão do MUNConnect (`npm run dev`),
> o site também fica acessível em `http://localhost:5173/candy.html`.

**Build de produção** (gera a pasta `dist-candy/`):

```bash
npx vite build --config vite.candy.config.js
```

## Animações incluídas

- Fundo com gradiente animado e blobs com parallax no scroll
- Doces flutuantes e brilhos (✨) no hero
- Título com entrada palavra-a-palavra (spring)
- Faixa (marquee) deslizante de slogans
- Cards de produto com efeito 3D tilt, hover, brilho e badges
- Reveal no scroll das etapas "como é feito"
- Carrossel automático de depoimentos
- Acordeão de FAQ animado
- Carrinho lateral (drawer) com itens animados, contador com bounce e toast
- Formulário de pedido com confirmação animada
- Respeita `prefers-reduced-motion`
