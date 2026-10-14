import type { PageInput } from './pages-schema';

// Conteúdo inicial das páginas que antes eram fixas no código (app/about e
// app/support). Entram no banco uma única vez; depois, só pelo painel.
export const DEFAULT_PAGES: PageInput[] = [
  {
    slug: 'about',
    title: 'Sobre',
    description: 'Sobre o Gaspar e o que você vai encontrar aqui.',
    showBackLink: false,
    blocks: [
      {
        id: 'sobre-texto',
        type: 'markdown',
        boxed: false,
        content: [
          'Este é um espaço para pensar em voz alta sobre o craft de construir e entender sistemas. Escrevo sobre arquitetura, ferramentas e as decisões que tomamos no dia a dia do desenvolvimento, unindo a precisão técnica à paixão por documentar processos.',
          '',
          '## O que você vai encontrar aqui',
          '',
          '- **Reflexões técnicas** — análises sobre decisões arquiteturais, trade-offs e as lições aprendidas na prática de quem vive no terminal.',
          '- **Tutoriais práticos** — guias hands-on sobre ferramentas, automação e técnicas que utilizo para resolver problemas e otimizar o trabalho.',
          '- **Pensamentos aleatórios** — textos sobre o que me move fora das telas: a estratégia do UFC, a rotina santista e perspectivas sobre o mundo sob uma ótica pessoal.',
          '- **Opiniões** — insights sobre a indústria, tendências e o futuro do desenvolvimento de software.',
        ].join('\n'),
      },
      {
        id: 'sobre-contato',
        type: 'social',
        title: 'Contato',
        text: 'Você pode me encontrar nas redes sociais ou enviar um e-mail:',
      },
    ],
  },
  {
    slug: 'support',
    title: 'Apoie',
    description:
      'Apoie o Gaspar Labs e ajude a manter pesquisa independente, sem anúncios e sem rastreio.',
    showBackLink: true,
    blocks: [
      {
        id: 'apoie-abertura',
        type: 'hero',
        kicker: 'Apoie',
        title: 'Sustente pesquisa independente.',
        lead: 'O Gaspar Labs é um laboratório editorial independente sobre tecnologia, internet, cybersecurity, sistemas, cultura digital e pensamento crítico. Sem anúncios, sem rastreio, sem ruído. Só análise, pesquisa e arquivo.',
      },
      {
        id: 'apoie-por-que',
        type: 'markdown',
        boxed: true,
        content:
          '## Por que existimos\n\nA internet moderna vive um paradoxo: boa parte do conteúdo é financiado por plataformas, anúncios, rastreadores e incentivos que distorcem a atenção. O Gaspar Labs escolhe outro caminho: uma publicação enxuta, autoral e independente, sustentada por quem acredita em conhecimento livre, análise profunda e uma web menos poluída.',
      },
      {
        id: 'apoie-sustenta',
        type: 'features',
        title: 'O que o seu apoio sustenta',
        items: [
          {
            icon: 'shield',
            title: 'Independência editorial',
            text: 'Zero anúncios, zero pressão comercial e liberdade para investigar temas sem depender de algoritmos ou patrocinadores invasivos.',
          },
          {
            icon: 'eye-off',
            title: 'Privacidade dos leitores',
            text: 'Sem cookies de rastreio, sem anúncios comportamentais e sem scripts de terceiros desnecessários para capturar sua atenção.',
          },
          {
            icon: 'book-open',
            title: 'Textos longos e profundos',
            text: 'Artigos, investigações, manifestos e análises que não precisam caber em formatos curtos, rápidos ou otimizados para clickbait.',
          },
          {
            icon: 'heart',
            title: 'Arquivo vivo da web',
            text: 'Manutenção do blog, domínio, infraestrutura, pesquisa, curadoria e continuidade de um espaço independente na internet.',
          },
        ],
      },
      {
        id: 'apoie-como',
        type: 'cta',
        title: 'Como apoiar',
        text: 'Seja como leitor, parceiro, empresa ou patrono independente, entre em contato descrevendo seu interesse. Toda mensagem será respondida pessoalmente.',
        label: 'h4xcats@gmail.com',
        href: 'mailto:h4xcats@gmail.com',
      },
    ],
  },
];
