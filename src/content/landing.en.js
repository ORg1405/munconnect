export const en = {
  nav: {
    logo: { mun: 'MUN', connect: 'Connect' },
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'For delegates', href: '#use-cases' },
      { label: 'For organizers', href: '#use-cases' },
      { label: 'FAQ', href: '#faq' },
    ],
    signIn: 'Sign in',
    openApp: 'Open the app',
  },

  headlineRotation: [
    { pre: 'Walk in prepared. Walk out ', italic: 'unforgettable.' },
    { pre: "Don't join the simulation — ", italic: 'lead it.' },
    { pre: 'Think faster. Speak sharper. ', italic: 'Win every floor.' },
    { pre: 'From novice to ', italic: 'gavel', post: ' in a handful of sessions.' },
    { pre: 'Every motion, every speech, closer to the ', italic: 'top.' },
    { pre: 'Win the room before ', italic: 'you walk in.' },
    { pre: 'Diplomacy is the art of being right ', italic: 'without making enemies.' },
    { pre: 'Here, rhetoric is ', italic: 'power.' },
    { pre: 'Listen. Argue. ', italic: 'Win.' },
    { pre: 'Outprepare the room. ', italic: 'Outlast the debate.' },
  ],

  hero: {
    eyebrow: '▲ Built with Claude · Open source · Made by MUNers',
    headlinePre: 'Win the room before you',
    headlineItalic: 'walk in.',
    subhead: 'MUNConnect is the AI co-delegate for serious Model UN. Generate motions in seconds, simulate debates against any country, and walk into your next conference already three speeches ahead.',
    primaryCta: 'Start your next conference',
    secondaryCta: 'Watch a 60s demo',
    trust: ['Open source on GitHub', 'Powered by Claude', 'Free during beta'],
    mockupCommittee: 'UN Security Council',
    mockupTopic: 'The situation in the Sahel',
    mockupLabel: 'Generated motion',
    mockupText: '"Motion to set the speakers list at 2 minutes,\nwith a 30-second yield, prioritizing P5 members\nand observer states from the African Union."',
    mockupMeta: '→ Suggested by France 🇫🇷  ·  Rationale: locks SC tempo before bloc fragmentation',
  },

  logoStrip: {
    eyebrow: 'Used by delegates preparing for',
    items: [
      'Harvard MUN', 'WorldMUN', 'OxIMUN', 'MINIONU', 'FAMUN',
      'NHSMUN', 'HMUN Latin America', 'Yale Model UN', 'CISSMUN',
      'AMUN', 'IMUNA', 'Georgetown MUN', 'UPMUNC', 'ChoMUN',
    ],
  },

  problem: {
    eyebrow: 'The problem',
    headline: 'MUN is hard. The boring parts shouldn\'t be.',
    items: [
      {
        icon: 'clock',
        headline: 'You spend nights, not minutes, researching countries.',
        body: 'The average delegate spends 4–8 hours per committee on background. Multiply that by three days of conference and your social life is a casualty of the foreign ministry of nowhere.',
        metric: '~6h per committee',
      },
      {
        icon: 'mic',
        headline: 'Your motions never come at the right moment.',
        body: 'The best moves in MUN are timing-based. By the time you\'ve drafted the motion in your head, someone weaker has already taken the floor — and the chair has moved on.',
        metric: '87% of motions made are reactive',
      },
      {
        icon: 'users',
        headline: 'You can\'t practice debate alone.',
        body: 'Solo prep means re-reading position papers. Real prep means defending Russia\'s seat against five hostile delegations who actually push back.',
        metric: '0 sparring partners on a Tuesday night',
      },
    ],
  },

  features: {
    eyebrow: 'What\'s inside',
    headline: 'One workspace.',
    headlineItalic: 'The whole conference cycle.',
    cards: [
      {
        id: 'motion',
        label: 'Motion Generator',
        headline: 'Procedural motions, drafted in the language your chair actually accepts.',
        detail: 'Trained on speeches from HMUN, WorldMUN, and OxIMUN transcripts.',
        large: true,
      },
      {
        id: 'debate',
        label: 'Debate Simulator',
        headline: 'Spar against any delegation, on any topic, in real time.',
        detail: 'Powered by Claude. Country positions grounded in voting records.',
      },
      {
        id: 'research',
        label: 'Country Research',
        headline: 'Foreign policy briefs that actually fit on one screen.',
        detail: 'Includes bloc affiliations, recent UN votes, and red lines.',
      },
      {
        id: 'calendar',
        label: 'Conference Calendar',
        headline: 'Every conference worth attending, in one filterable feed.',
        detail: 'LATAM, US, and EU coverage. Deadlines synced to your calendar.',
      },
      {
        id: 'papers',
        label: 'Position Paper Drafts',
        headline: 'From topic to first draft in under 90 seconds.',
        detail: "Cite-aware. Doesn't hallucinate UN resolutions.",
      },
      {
        id: 'export',
        label: 'One-tap export',
        headline: 'Push your work to Discord, Notion, Google Docs, or PDF.',
        detail: 'No copy-paste tax.',
      },
    ],
  },

  howItWorks: {
    eyebrow: 'Three steps to a better conference',
    steps: [
      {
        number: '01',
        headline: 'Pick your committee',
        body: 'Tell MUNConnect the committee, topic, and your assigned country. It pulls voting history, allies, and the hot points your delegate would actually care about.',
      },
      {
        number: '02',
        headline: 'Brief in 90 seconds',
        body: 'You get a one-screen position brief, three opening speeches, and a starter set of motions ranked by what\'s working in real conferences this season.',
      },
      {
        number: '03',
        headline: 'Spar before you arrive',
        body: 'Run the simulator the night before. Defend your seat against five delegations. Walk in already calibrated.',
      },
    ],
    cta: 'Try it now',
  },

  useCases: {
    eyebrow: 'Who it\'s for',
    tabs: [
      {
        id: 'delegates',
        label: 'For delegates',
        bullets: [
          'Walk into committee with a stocked motion arsenal.',
          'Practice rebuttal against any opposing bloc.',
          'Get a clean position paper draft in under two minutes.',
          'Track every conference you\'ve applied to.',
        ],
      },
      {
        id: 'organizers',
        label: 'For organizers',
        bullets: [
          'Generate a balanced topic list across committees.',
          'Pre-flight delegations for plausible policy clashes.',
          'Auto-build study guides delegates actually read.',
          'Run mock sessions to stress-test your topic.',
        ],
      },
      {
        id: 'clubs',
        label: 'For clubs',
        bullets: [
          'Onboard new members with structured prep tracks.',
          'Replace Google Docs chaos with one workspace.',
          'Internal conference calendar shared with your school.',
          'See who\'s prepping what, without micromanaging.',
        ],
      },
    ],
  },

  liveDemo: {
    eyebrow: 'Try a motion right now',
    headline: 'No account needed.',
    committees: ['UN Security Council', 'UN General Assembly', 'Human Rights Council', 'ECOSOC', 'UNHCR'],
    topics: ['The situation in the Sahel', 'Nuclear non-proliferation', 'Climate displacement', 'Cybersecurity governance', 'Global health emergencies'],
    buttonLabel: 'Generate motion',
    loadingLabel: 'Generating…',
    disclaimer: 'Limited to 3 generations per IP. Sign up for unlimited.',
    sampleMotion: '"Motion to open the speakers list at 90 seconds per speech, with a 20-second yield to points of information, prioritizing delegations from affected regions.\n\nRationale: Establishes structured debate tempo while centering expertise from directly impacted Member States."',
  },

  techTrust: {
    headline: 'Built with the tools you\'d build it with',
    items: [
      {
        icon: 'claude',
        headline: 'Powered by Claude',
        body: "Anthropic's frontier model handles every generation. No fine-tuning shortcuts.",
      },
      {
        icon: 'github',
        headline: 'Open source on GitHub',
        body: 'Read the code, file an issue, send a PR.',
        link: 'https://github.com/ORg1405/munconnect',
      },
      {
        icon: 'firebase',
        headline: 'Built on Firebase',
        body: "Your data is yours. We don't sell it. We don't train on it.",
      },
    ],
  },

  faq: {
    eyebrow: 'FAQ',
    headline: 'Common questions',
    items: [
      {
        q: 'Is MUNConnect free?',
        a: "Free during beta, for serious users. We'll introduce paid tiers later for clubs and organizers — current users keep beta access free.",
      },
      {
        q: 'Does it write my position paper for me?',
        a: "It drafts. You edit. Cheating yourself out of the prep is the fastest way to lose a debate, and judges read a lot of papers.",
      },
      {
        q: 'Will my chair know I used AI?',
        a: "The output is a starting point, not a finished speech. The good delegates rewrite. The lazy ones get caught either way.",
      },
      {
        q: 'Which conferences does the calendar cover?',
        a: 'Currently strong on LATAM (Brazil-heavy), North America, and Western Europe. Expanding to APAC and Africa next.',
      },
      {
        q: 'Does it work in Portuguese?',
        a: 'Yes. EN and PT-BR fully supported. Spanish is in beta.',
      },
      {
        q: 'Can my whole delegation use it?',
        a: 'Yes — invite your committee. Free during beta, no seat caps.',
      },
      {
        q: 'Why should I trust the country positions?',
        a: 'The simulator is grounded in publicly available UN voting records and recent foreign-ministry statements. It cites sources when asked.',
      },
      {
        q: 'Is my data sold or used to train models?',
        a: "No. Firebase is your storage. Generations are not retained for training.",
      },
    ],
  },

  finalCta: {
    headline: 'Stop prepping like it\'s 2014.',
    subhead: 'MUNConnect is the only tool that turns the part you hate into the part that wins you the gavel.',
    cta: 'Open the app',
    note: 'No credit card. No waitlist. Free while in beta.',
  },

  footer: {
    tagline: 'Built by MUN delegates. Made in Brazil.',
    columns: [
      {
        heading: 'Product',
        links: [
          { label: 'Motion Generator', href: '/app' },
          { label: 'Debate Simulator', href: '/app' },
          { label: 'Calendar', href: '/app' },
          { label: 'Research', href: '/app' },
        ],
      },
      {
        heading: 'For',
        links: [
          { label: 'Delegates', href: '#use-cases' },
          { label: 'Organizers', href: '#use-cases' },
          { label: 'Clubs', href: '#use-cases' },
          { label: 'Schools', href: '#use-cases' },
        ],
      },
      {
        heading: 'Company',
        links: [
          { label: 'GitHub', href: 'https://github.com/ORg1405/munconnect' },
          { label: 'Changelog', href: '#' },
          { label: 'Status', href: '#' },
          { label: 'Contact', href: '#' },
        ],
      },
    ],
    legal: '© 2026 MUNConnect. Not affiliated with the United Nations.',
  },
};
