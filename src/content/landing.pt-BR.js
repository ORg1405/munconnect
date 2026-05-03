export const ptBR = {
  nav: {
    logo: { mun: 'MUN', connect: 'Connect' },
    links: [
      { label: 'Recursos', href: '#features' },
      { label: 'Como funciona', href: '#how-it-works' },
      { label: 'Para delegados', href: '#use-cases' },
      { label: 'Para organizadores', href: '#use-cases' },
      { label: 'FAQ', href: '#faq' },
    ],
    signIn: 'Entrar',
    openApp: 'Abrir o app',
  },

  headlineRotation: [
    { pre: 'Entre preparado. Saia ', italic: 'inesquecível.' },
    { pre: 'Não participe da simulação — ', italic: 'lidere ela.' },
    { pre: 'Pense mais rápido. Fale melhor. ', italic: 'Convença sempre.' },
    { pre: 'De iniciante a ', italic: 'destaque', post: ' em poucas sessões.' },
    { pre: 'Cada decisão, cada discurso, mais perto do ', italic: 'topo.' },
    { pre: 'Domine a sala antes ', italic: 'de entrar.' },
    { pre: 'Diplomacia é a arte de ter razão ', italic: 'sem fazer inimigos.' },
    { pre: 'Aqui, retórica é ', italic: 'poder.' },
    { pre: 'Ouça, argumente ', italic: 'e vença.' },
    { pre: 'Prepare-se mais. ', italic: 'Resista mais.' },
  ],

  hero: {
    eyebrow: '▲ Feito com Claude · Open source · Criado por MUNers',
    headlinePre: 'Vença a sala antes',
    headlineItalic: 'de entrar nela.',
    subhead: 'O MUNConnect é o co-delegado de IA para quem leva MUN a sério. Gere motions em segundos, treine debates contra qualquer país e chegue na próxima conferência três falas à frente.',
    primaryCta: 'Começar sua próxima conferência',
    secondaryCta: 'Ver demo de 60s',
    trust: ['Open source no GitHub', 'Desenvolvido com Claude', 'Gratuito no beta'],
    mockupCommittee: 'Conselho de Segurança da ONU',
    mockupTopic: 'A situação no Sahel',
    mockupLabel: 'Motion gerada',
    mockupText: '"Moção para definir a lista de oradores em 2 minutos,\ncom cessão de 30 segundos, priorizando membros P5\ne estados observadores da União Africana."',
    mockupMeta: '→ Sugerido pela França 🇫🇷  ·  Justificativa: trava o tempo do CS antes da fragmentação de bloco',
  },

  logoStrip: {
    eyebrow: 'Usado por delegados que se preparam para',
    items: [
      'Harvard MUN', 'WorldMUN', 'OxIMUN', 'MINIONU', 'FAMUN',
      'NHSMUN', 'HMUN Latin America', 'Yale Model UN', 'CISSMUN',
      'AMUN', 'IMUNA', 'Georgetown MUN', 'UPMUNC', 'ChoMUN',
    ],
  },

  problem: {
    eyebrow: 'O problema',
    headline: 'MUN é difícil. As partes chatas não precisam ser.',
    items: [
      {
        icon: 'clock',
        headline: 'Você passa noites, não minutos, pesquisando países.',
        body: 'O delegado médio gasta 4–8 horas por comitê em background. Multiplica por três dias de conferência e sua vida social vira vítima do Ministério das Relações Exteriores de lugar nenhum.',
        metric: '~6h por comitê',
      },
      {
        icon: 'mic',
        headline: 'Suas motions nunca chegam na hora certa.',
        body: 'As melhores jogadas no MUN dependem de timing. Quando você termina de formular a motion na cabeça, alguém mais fraco já tomou o microfone — e o chair já seguiu em frente.',
        metric: '87% das motions são reativas',
      },
      {
        icon: 'users',
        headline: 'Você não consegue treinar debate sozinho.',
        body: 'Preparar sozinho significa reler position papers. Preparar de verdade significa defender o assento da Rússia contra cinco delegações hostis que realmente pressionam.',
        metric: '0 parceiros de treino numa terça à noite',
      },
    ],
  },

  features: {
    eyebrow: 'O que tem dentro',
    headline: 'Um workspace.',
    headlineItalic: 'Todo o ciclo da conferência.',
    cards: [
      {
        id: 'motion',
        label: 'Gerador de Motions',
        headline: 'Motions procedimentais, redigidas na linguagem que seu chair realmente aceita.',
        detail: 'Treinado em discursos de transcrições da HMUN, WorldMUN e OxIMUN.',
        large: true,
      },
      {
        id: 'debate',
        label: 'Simulador de Debate',
        headline: 'Treine contra qualquer delegação, em qualquer tópico, em tempo real.',
        detail: 'Desenvolvido com Claude. Posições dos países baseadas em registros de votação.',
      },
      {
        id: 'research',
        label: 'Pesquisa de País',
        headline: 'Briefings de política externa que realmente cabem em uma tela.',
        detail: 'Inclui filiações de bloco, votos recentes na ONU e linhas vermelhas.',
      },
      {
        id: 'calendar',
        label: 'Calendário de Conferências',
        headline: 'Toda conferência que vale a pena, em um feed filtrável.',
        detail: 'Cobertura LATAM, EUA e Europa. Prazos sincronizados ao seu calendário.',
      },
      {
        id: 'papers',
        label: 'Rascunhos de Position Paper',
        headline: 'Do tópico ao primeiro rascunho em menos de 90 segundos.',
        detail: 'Consciente de citações. Não alucina resoluções da ONU.',
      },
      {
        id: 'export',
        label: 'Exportação com um clique',
        headline: 'Envie seu trabalho para Discord, Notion, Google Docs ou PDF.',
        detail: 'Sem taxa de copiar e colar.',
      },
    ],
  },

  howItWorks: {
    eyebrow: 'Três passos para uma conferência melhor',
    steps: [
      {
        number: '01',
        headline: 'Escolha seu comitê',
        body: 'Informe ao MUNConnect o comitê, o tópico e o país atribuído. Ele busca histórico de votação, aliados e os pontos quentes que seu delegado realmente se importaria.',
      },
      {
        number: '02',
        headline: 'Briefing em 90 segundos',
        body: 'Você recebe um briefing de posição em uma tela, três discursos de abertura e um conjunto inicial de motions classificadas pelo que está funcionando nas conferências desta temporada.',
      },
      {
        number: '03',
        headline: 'Treine antes de chegar',
        body: 'Rode o simulador na noite anterior. Defenda seu assento contra cinco delegações. Chegue já calibrado.',
      },
    ],
    cta: 'Experimentar agora',
  },

  useCases: {
    eyebrow: 'Para quem é',
    tabs: [
      {
        id: 'delegates',
        label: 'Para delegados',
        bullets: [
          'Entre no comitê com um arsenal de motions pronto.',
          'Pratique réplica contra qualquer bloco adversário.',
          'Obtenha um rascunho de position paper em menos de dois minutos.',
          'Acompanhe todas as conferências para as quais se inscreveu.',
        ],
      },
      {
        id: 'organizers',
        label: 'Para organizadores',
        bullets: [
          'Gere uma lista de tópicos equilibrada entre comitês.',
          'Pré-valide delegações para conflitos de política plausíveis.',
          'Crie guias de estudo que os delegados realmente leem.',
          'Realize sessões simuladas para testar seu tópico.',
        ],
      },
      {
        id: 'clubs',
        label: 'Para clubes',
        bullets: [
          'Integre novos membros com trilhas de preparação estruturadas.',
          'Substitua o caos do Google Docs por um único workspace.',
          'Calendário interno de conferências compartilhado com sua escola.',
          'Veja quem está preparando o quê, sem microgerenciar.',
        ],
      },
    ],
  },

  liveDemo: {
    eyebrow: 'Experimente uma motion agora',
    headline: 'Sem cadastro necessário.',
    committees: ['Conselho de Segurança da ONU', 'Assembleia Geral da ONU', 'Conselho de Direitos Humanos', 'ECOSOC', 'ACNUR'],
    topics: ['A situação no Sahel', 'Não proliferação nuclear', 'Deslocamento climático', 'Governança de cibersegurança', 'Emergências de saúde global'],
    buttonLabel: 'Gerar motion',
    loadingLabel: 'Gerando…',
    disclaimer: 'Limitado a 3 gerações por IP. Cadastre-se para uso ilimitado.',
    sampleMotion: '"Moção para abrir a lista de oradores em 90 segundos por discurso, com cessão de 20 segundos para pontos de informação, priorizando delegações de regiões afetadas.\n\nJustificativa: Estabelece ritmo de debate estruturado priorizando a expertise dos Estados-membros diretamente impactados."',
  },

  techTrust: {
    headline: 'Construído com as ferramentas que você usaria',
    items: [
      {
        icon: 'claude',
        headline: 'Desenvolvido com Claude',
        body: 'O modelo de fronteira da Anthropic cuida de cada geração. Sem atalhos de fine-tuning.',
      },
      {
        icon: 'github',
        headline: 'Open source no GitHub',
        body: 'Leia o código, abra uma issue, envie um PR.',
        link: 'https://github.com/ORg1405/munconnect',
      },
      {
        icon: 'firebase',
        headline: 'Construído no Firebase',
        body: 'Seus dados são seus. Não vendemos. Não treinamos com eles.',
      },
    ],
  },

  faq: {
    eyebrow: 'FAQ',
    headline: 'Perguntas frequentes',
    items: [
      {
        q: 'O MUNConnect é gratuito?',
        a: 'Gratuito durante o beta, para usuários sérios. Vamos introduzir planos pagos mais tarde para clubes e organizadores — usuários atuais mantêm o acesso beta gratuito.',
      },
      {
        q: 'Ele escreve meu position paper por mim?',
        a: 'Ele rascunha. Você edita. Burlar a preparação é a maneira mais rápida de perder um debate, e os juízes leem muitos papers.',
      },
      {
        q: 'Meu chair vai saber que usei IA?',
        a: 'O resultado é um ponto de partida, não um discurso pronto. Os bons delegados reescrevem. Os preguiçosos são pegos de qualquer jeito.',
      },
      {
        q: 'Quais conferências o calendário cobre?',
        a: 'Atualmente forte em LATAM (foco no Brasil), América do Norte e Europa Ocidental. Expandindo para APAC e África em breve.',
      },
      {
        q: 'Funciona em português?',
        a: 'Sim. EN e PT-BR totalmente suportados. Espanhol está em beta.',
      },
      {
        q: 'Toda a minha delegação pode usar?',
        a: 'Sim — convide seu comitê. Gratuito durante o beta, sem limites de assentos.',
      },
      {
        q: 'Por que devo confiar nas posições dos países?',
        a: 'O simulador é baseado em registros públicos de votação da ONU e declarações recentes de ministérios das relações exteriores. Cita fontes quando solicitado.',
      },
      {
        q: 'Meus dados são vendidos ou usados para treinar modelos?',
        a: 'Não. O Firebase é seu armazenamento. As gerações não são retidas para treinamento.',
      },
    ],
  },

  finalCta: {
    headline: 'Pare de preparar como se fosse 2014.',
    subhead: 'O MUNConnect é a única ferramenta que transforma a parte que você odeia na parte que te dá o gavel.',
    cta: 'Abrir o app',
    note: 'Sem cartão de crédito. Sem lista de espera. Gratuito no beta.',
  },

  footer: {
    tagline: 'Feito por delegados de MUN. Criado no Brasil.',
    columns: [
      {
        heading: 'Produto',
        links: [
          { label: 'Gerador de Motions', href: '/app' },
          { label: 'Simulador de Debate', href: '/app' },
          { label: 'Calendário', href: '/app' },
          { label: 'Pesquisa', href: '/app' },
        ],
      },
      {
        heading: 'Para',
        links: [
          { label: 'Delegados', href: '#use-cases' },
          { label: 'Organizadores', href: '#use-cases' },
          { label: 'Clubes', href: '#use-cases' },
          { label: 'Escolas', href: '#use-cases' },
        ],
      },
      {
        heading: 'Empresa',
        links: [
          { label: 'GitHub', href: 'https://github.com/ORg1405/munconnect' },
          { label: 'Changelog', href: '#' },
          { label: 'Status', href: '#' },
          { label: 'Contato', href: '#' },
        ],
      },
    ],
    legal: '© 2026 MUNConnect. Não afiliado às Nações Unidas.',
  },
};
