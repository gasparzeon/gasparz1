'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { ApiError, adminFetch } from '@/lib/admin/client';
import type { MediaMode } from '@/lib/cms/media-types';
import {
  SOCIAL_LABELS,
  SOCIAL_NETWORKS,
  siteSettingsSchema,
  type SiteSettings,
  type SocialNetwork,
} from '@/lib/site/schema';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { MediaDialog } from '../media-dialog';
import { TagInput } from '../tag-input';
import {
  FieldGroup,
  ImageField,
  ListEditor,
  NumberField,
  SelectField,
  TextField,
  ToggleField,
} from './fields';

const SOCIAL_OPTIONS = SOCIAL_NETWORKS.map((network) => ({
  value: network,
  label: new Map(Object.entries(SOCIAL_LABELS)).get(network) ?? network,
}));

const SECTION_LABELS = new Map<string, string>([
  ['general', 'Geral'],
  ['navigation', 'Menu'],
  ['home', 'Página inicial'],
  ['postsPage', 'Página inicial'],
  ['footer', 'Rodapé e redes'],
  ['social', 'Rodapé e redes'],
  ['integrations', 'Integrações'],
  ['notFound', 'Página 404'],
]);

type SiteSettingsFormProps = {
  initial: SiteSettings;
  updatedAt: string | null;
  mediaMode: MediaMode;
};

// Tudo o que antes era fixo no código do site público: identidade, menu,
// página inicial, rodapé, redes, integrações e a página 404.
export function SiteSettingsForm({ initial, updatedAt, mediaMode }: SiteSettingsFormProps) {
  const router = useRouter();
  const [saved, setSaved] = useState({ settings: initial, updatedAt });
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved.settings),
    [settings, saved.settings],
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Atualiza uma seção inteira (general, navigation, home…).
  const set = <K extends keyof SiteSettings>(section: K, patch: Partial<SiteSettings[K]>) =>
    // eslint-disable-next-line security/detect-object-injection -- seção tipada (chave do schema), não entrada externa
    setSettings((current) => ({ ...current, [section]: { ...current[section], ...patch } }));

  const save = async () => {
    const parsed = siteSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const section = SECTION_LABELS.get(String(issue.path[0])) ?? 'Configurações';
      toast.error(`${section}: ${issue.message}`);
      return;
    }

    setSaving(true);
    try {
      const result = await adminFetch<{ settings: SiteSettings; updatedAt: string }>(
        '/api/admin/site',
        {
          method: 'PUT',
          body: JSON.stringify({ settings: parsed.data, expectedUpdatedAt: saved.updatedAt }),
        },
      );
      setSaved(result);
      setSettings(result.settings);
      toast.success('Site atualizado.', {
        description: 'As páginas públicas são regeneradas em alguns segundos.',
        action: { label: 'Ver site', onClick: () => window.open('/', '_blank') },
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'conflict') {
        toast.error(error.message, {
          description: 'Recarregue para ver a versão mais nova antes de salvar.',
          action: { label: 'Recarregar', onClick: () => router.refresh() },
        });
      } else {
        toast.error((error as Error).message);
      }
    } finally {
      setSaving(false);
    }
  };

  const { general, navigation, home, postsPage, footer, social, integrations, notFound } = settings;

  return (
    <div className="pb-28">
      <Tabs defaultValue="geral">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="inicio">Página inicial</TabsTrigger>
          <TabsTrigger value="rodape">Rodapé e redes</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="404">Página 404</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          <FieldGroup
            title="Identidade"
            description="Nome e descrição aparecem no título das abas, no Google, no RSS e nas prévias de links."
          >
            <TextField
              label="Nome do site"
              value={general.name}
              maxLength={60}
              onChange={(name) => set('general', { name })}
            />
            <TextField
              label="Descrição"
              value={general.description}
              maxLength={300}
              multiline
              onChange={(description) => set('general', { description })}
            />
            <TextField
              label="Autor"
              value={general.author}
              maxLength={80}
              onChange={(author) => set('general', { author })}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Palavras-chave</p>
              <TagInput
                value={general.keywords}
                onChange={(keywords) => set('general', { keywords })}
                suggestions={[]}
                max={30}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Endereço e compartilhamento">
            <TextField
              label="Endereço público do site"
              type="url"
              value={general.url}
              placeholder="https://seu-dominio.com"
              hint="Usado no RSS, no sitemap e nas prévias de links. Vazio: usa NEXT_PUBLIC_SITE_URL."
              onChange={(url) => set('general', { url })}
            />
            <ImageField
              label="Imagem de compartilhamento"
              value={general.shareImage}
              hint="Aparece quando alguém compartilha a home ou uma página sem capa própria."
              onChange={(shareImage) => set('general', { shareImage })}
              onPick={() => setPicking(true)}
            />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="menu" className="space-y-6">
          <FieldGroup title="Logo">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Texto"
                value={navigation.logo.text}
                maxLength={40}
                onChange={(text) => set('navigation', { logo: { ...navigation.logo, text } })}
              />
              <TextField
                label="Complemento (em cinza)"
                value={navigation.logo.accent}
                maxLength={40}
                onChange={(accent) => set('navigation', { logo: { ...navigation.logo, accent } })}
              />
            </div>
          </FieldGroup>

          <FieldGroup
            title="Links do menu"
            description="Use caminhos do site (/posts, /about) ou endereços completos (https://…)."
          >
            <ListEditor
              items={navigation.links}
              onChange={(links) => set('navigation', { links })}
              createItem={() => ({ label: 'Novo link', href: '/' })}
              addLabel="Adicionar link"
              max={12}
              emptyText="Nenhum link no menu."
              itemLabel={(item) => item.label || 'link'}
              renderItem={(item, update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    label="Texto"
                    value={item.label}
                    onChange={(label) => update({ label })}
                  />
                  <TextField label="Link" value={item.href} onChange={(href) => update({ href })} />
                </div>
              )}
            />
          </FieldGroup>

          <FieldGroup title="Botões do cabeçalho">
            <ToggleField
              label="Busca"
              description="Ícone de busca e o atalho Ctrl+K."
              checked={navigation.showSearch}
              onChange={(showSearch) => set('navigation', { showSearch })}
            />
            <ToggleField
              label="Alternar tema claro/escuro"
              checked={navigation.showThemeToggle}
              onChange={(showThemeToggle) => set('navigation', { showThemeToggle })}
            />
            <ToggleField
              label="Entrar e Criar conta"
              description="Escondidos, o painel continua em /admin."
              checked={navigation.showAccountButtons}
              onChange={(showAccountButtons) => set('navigation', { showAccountButtons })}
            />
            <ToggleField
              label="Aba Creators"
              description="Link para /creators (quem escreve e as redes de cada pessoa) no fim do menu."
              checked={navigation.showCreators}
              onChange={(showCreators) => set('navigation', { showCreators })}
            />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="inicio" className="space-y-6">
          <FieldGroup title="Abertura">
            <TextField
              label="Chamada (acima do título)"
              value={home.kicker}
              maxLength={60}
              onChange={(kicker) => set('home', { kicker })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Título"
                value={home.title}
                maxLength={60}
                onChange={(title) => set('home', { title })}
              />
              <TextField
                label="Destaque do título (marcado em verde)"
                value={home.titleAccent}
                maxLength={60}
                onChange={(titleAccent) => set('home', { titleAccent })}
              />
            </div>
            <TextField
              label="Texto de apresentação"
              value={home.lead}
              maxLength={800}
              multiline
              rows={4}
              onChange={(lead) => set('home', { lead })}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Temas (abaixo do texto)</p>
              <TagInput
                value={home.topics}
                onChange={(topics) => set('home', { topics })}
                suggestions={[]}
                max={12}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Sobre (fim da página inicial)">
            <TextField
              label="Texto (use *palavra* para destacar)"
              value={home.about}
              maxLength={400}
              multiline
              rows={3}
              onChange={(about) => set('home', { about })}
            />
          </FieldGroup>

          <FieldGroup title="Posts recentes">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Chamada"
                value={home.recentKicker}
                onChange={(recentKicker) => set('home', { recentKicker })}
              />
              <TextField
                label="Título da seção"
                value={home.recentTitle}
                onChange={(recentTitle) => set('home', { recentTitle })}
              />
              <TextField
                label='Texto do link "ver todos"'
                value={home.viewAllLabel}
                onChange={(viewAllLabel) => set('home', { viewAllLabel })}
              />
              <NumberField
                label="Quantidade de posts"
                value={home.recentCount}
                min={1}
                max={20}
                onChange={(recentCount) => set('home', { recentCount })}
              />
            </div>
            <TextField
              label="Texto quando não há posts"
              value={home.emptyText}
              onChange={(emptyText) => set('home', { emptyText })}
            />
          </FieldGroup>

          <FieldGroup title="Página de posts (/posts)">
            <TextField
              label="Título"
              value={postsPage.title}
              onChange={(title) => set('postsPage', { title })}
            />
            <TextField
              label="Descrição (Google)"
              value={postsPage.description}
              onChange={(description) => set('postsPage', { description })}
            />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="rodape" className="space-y-6">
          <FieldGroup title="Rodapé">
            <TextField
              label="Copyright"
              value={footer.copyright}
              hint="{ano} vira o ano atual e {site}, o nome do site."
              onChange={(copyright) => set('footer', { copyright })}
            />
            <TextField
              label="Nota"
              value={footer.note}
              onChange={(note) => set('footer', { note })}
            />
            <ToggleField
              label="Link de destaque"
              description='Como o "Seja um apoiador".'
              checked={footer.cta.enabled}
              onChange={(enabled) => set('footer', { cta: { ...footer.cta, enabled } })}
            />
            {footer.cta.enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Texto do link"
                  value={footer.cta.label}
                  onChange={(label) => set('footer', { cta: { ...footer.cta, label } })}
                />
                <TextField
                  label="Link"
                  value={footer.cta.href}
                  onChange={(href) => set('footer', { cta: { ...footer.cta, href } })}
                />
              </div>
            )}
          </FieldGroup>

          <FieldGroup
            title="Redes sociais e contatos"
            description="Aparecem no bloco de contatos das páginas e, se marcado, como ícone no rodapé."
          >
            <ListEditor
              items={social}
              onChange={(next) => setSettings((current) => ({ ...current, social: next }))}
              createItem={() => ({
                network: 'website' as SocialNetwork,
                label: '',
                url: 'https://',
                footer: false,
              })}
              addLabel="Adicionar rede"
              max={20}
              emptyText="Nenhuma rede cadastrada."
              itemLabel={(item) => item.label || item.network}
              renderItem={(item, update) => (
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <SelectField
                    label="Rede"
                    value={item.network}
                    options={SOCIAL_OPTIONS}
                    onChange={(network) => update({ network })}
                  />
                  <TextField
                    label="Nome exibido"
                    value={item.label}
                    placeholder="@usuario"
                    onChange={(label) => update({ label })}
                  />
                  <TextField
                    label="Link"
                    value={item.url}
                    placeholder="https://… ou mailto:…"
                    className="sm:col-span-2"
                    onChange={(url) => update({ url })}
                  />
                  <div className="sm:col-span-2">
                    <ToggleField
                      label="Mostrar no rodapé"
                      checked={item.footer}
                      onChange={(footerFlag) => update({ footer: footerFlag })}
                    />
                  </div>
                </div>
              )}
            />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="integracoes" className="space-y-6">
          <FieldGroup
            title="Comentários"
            description="Comentários do próprio site: quem cria uma conta vira leitor e pode comentar. A moderação fica em Comentários no menu do painel."
          >
            <ToggleField
              label="Comentários nos posts"
              checked={integrations.comments.enabled}
              onChange={(enabled) =>
                set('integrations', { comments: { ...integrations.comments, enabled } })
              }
            />
            {integrations.comments.enabled && (
              <TextField
                label="Título da seção"
                value={integrations.comments.title}
                onChange={(title) =>
                  set('integrations', { comments: { ...integrations.comments, title } })
                }
              />
            )}
          </FieldGroup>

          <FieldGroup
            title="Estatísticas (Plausible)"
            description="Sem cookies. Funciona com o plausible.io ou com uma instalação própria."
          >
            <ToggleField
              label="Plausible"
              checked={integrations.plausible.enabled}
              onChange={(enabled) =>
                set('integrations', { plausible: { ...integrations.plausible, enabled } })
              }
            />
            {integrations.plausible.enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Domínio"
                  value={integrations.plausible.domain}
                  placeholder="seu-dominio.com"
                  onChange={(domain) =>
                    set('integrations', { plausible: { ...integrations.plausible, domain } })
                  }
                />
                <TextField
                  label="Endereço do script"
                  value={integrations.plausible.scriptUrl}
                  onChange={(scriptUrl) =>
                    set('integrations', { plausible: { ...integrations.plausible, scriptUrl } })
                  }
                />
              </div>
            )}
            <ToggleField
              label="Vercel Analytics"
              description="Só tem efeito em deploys na Vercel."
              checked={integrations.vercelAnalytics.enabled}
              onChange={(enabled) => set('integrations', { vercelAnalytics: { enabled } })}
            />
          </FieldGroup>

          <FieldGroup title="Botões de compartilhar (nos posts)">
            <ToggleField
              label="X (Twitter)"
              checked={integrations.share.x}
              onChange={(x) => set('integrations', { share: { ...integrations.share, x } })}
            />
            <ToggleField
              label="LinkedIn"
              checked={integrations.share.linkedin}
              onChange={(linkedin) =>
                set('integrations', { share: { ...integrations.share, linkedin } })
              }
            />
          </FieldGroup>
        </TabsContent>

        <TabsContent value="404" className="space-y-6">
          <FieldGroup title="Página não encontrada">
            <TextField
              label="Título"
              value={notFound.title}
              onChange={(title) => set('notFound', { title })}
            />
            <TextField
              label="Texto"
              value={notFound.text}
              multiline
              onChange={(text) => set('notFound', { text })}
            />
            <TextField
              label="Texto do botão"
              value={notFound.buttonLabel}
              onChange={(buttonLabel) => set('notFound', { buttonLabel })}
            />
          </FieldGroup>
        </TabsContent>
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="text-sm text-muted-foreground">
            {dirty ? 'Alterações não salvas' : 'Tudo salvo'}
          </span>
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Ver site <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || saving}
            onClick={() => setSettings(saved.settings)}
          >
            <RotateCcw /> Descartar
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={save}>
            {saving ? <Spinner /> : <Save />} Salvar alterações
          </Button>
        </div>
      </div>

      <MediaDialog
        kind={picking ? 'cover' : null}
        mediaMode={mediaMode}
        onClose={() => setPicking(false)}
        onInsert={(media) => {
          setPicking(false);
          if (media.kind === 'image') set('general', { shareImage: media.url });
        }}
      />
    </div>
  );
}
