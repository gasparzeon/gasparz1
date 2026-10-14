'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

import { adminFetch, redirectToLogin } from '@/lib/admin/client';
import { roleInfo, type Role } from '@/lib/auth/permissions';
import type { MediaMode } from '@/lib/cms/media-types';
import {
  PROFILE_NETWORKS,
  networkInfo,
  parseSocialInput,
  type ProfileNetwork,
  type ProfileSocial,
} from '@/lib/users/socials';
import { readmeProblem } from '@/lib/users/readme';
import { AuthorAvatar } from '@/components/author-avatar';
import { ProfileNetworkIcon } from '@/components/site/icons';
import { SocialConnections } from '@/components/site/social-connections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

import { MediaDialog } from './media-dialog';
import { ReadmeField } from './readme-field';

type Profile = {
  name: string;
  username: string;
  email: string | null;
  bio: string;
  avatarUrl: string;
  socials: ProfileSocial[];
  readme: string;
  role: Role;
};

type SocialRow = { network: ProfileNetwork; value: string; label: string };

// Uma linha por rede, na ordem fixa; o campo mostra o link oficial salvo.
const rowsFrom = (socials: ProfileSocial[]): SocialRow[] =>
  PROFILE_NETWORKS.map((network) => {
    const saved = socials.find((social) => social.network === network);
    return { network, value: saved?.url ?? '', label: saved?.label ?? '' };
  });

const problemOf = (row: SocialRow) => {
  if (!row.value.trim()) return null;
  const parsed = parseSocialInput(row.network, row.value);
  return parsed.ok ? null : parsed.error;
};

export function ProfileForm({ profile, mediaMode }: { profile: Profile; mediaMode: MediaMode }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: profile.name,
    username: profile.username,
    email: profile.email ?? '',
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
  });
  const [socials, setSocials] = useState(() => rowsFrom(profile.socials));
  const [readme, setReadme] = useState(profile.readme);
  const readmeError = readmeProblem(readme);
  // Erro de uma rede aparece depois que a pessoa sai do campo (ou ao salvar).
  const [touched, setTouched] = useState<ProfileNetwork[]>([]);
  const socialsRef = useRef<HTMLFieldSetElement>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const setSocial = (network: ProfileNetwork, patch: Partial<SocialRow>) =>
    setSocials((rows) => rows.map((row) => (row.network === network ? { ...row, ...patch } : row)));
  const touch = (network: ProfileNetwork) =>
    setTouched((current) => (current.includes(network) ? current : [...current, network]));

  // Prévia com o mesmo visual do site (só as redes válidas).
  const preview = socials.flatMap((row): ProfileSocial[] => {
    const parsed = row.value.trim() ? parseSocialInput(row.network, row.value) : null;
    return parsed?.ok
      ? [{ network: row.network, handle: parsed.handle, url: parsed.url, label: row.label.trim() }]
      : [];
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form
        className="gz-panel space-y-6 p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (readmeError) {
            document.getElementById('profile-readme')?.focus();
            toast.error(readmeError);
            return;
          }
          const invalid = socials.find((row) => problemOf(row));
          if (invalid) {
            setTouched([...PROFILE_NETWORKS]);
            socialsRef.current
              ?.querySelector<HTMLInputElement>(`#social-${invalid.network}`)
              ?.focus();
            toast.error('Confira o link das redes sociais.');
            return;
          }
          setSaving(true);
          try {
            await adminFetch('/api/admin/me', {
              method: 'PATCH',
              body: JSON.stringify({ ...form, socials, readme }),
            });
            toast.success('Perfil atualizado.');
            router.refresh();
          } catch (error) {
            toast.error((error as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex items-center gap-4">
          <AuthorAvatar author={form} size={72} className="text-xl" />
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
              <ImagePlus /> Trocar foto
            </Button>
            {form.avatarUrl && (
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, avatarUrl: '' }))}
                className="text-left text-xs text-muted-foreground hover:text-foreground"
              >
                Remover foto
              </button>
            )}
          </div>
          <span className="ml-auto rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            {roleInfo(profile.role).label}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome</Label>
            <Input id="profile-name" required value={form.name} onChange={set('name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-username">Usuário</Label>
            <Input
              id="profile-username"
              required
              value={form.username}
              onChange={set('username')}
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">E-mail</Label>
          <Input id="profile-email" type="email" value={form.email} onChange={set('email')} />
          <p className="text-xs text-muted-foreground">Também serve para entrar no painel.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-bio">Bio</Label>
          <Textarea
            id="profile-bio"
            rows={4}
            maxLength={500}
            value={form.bio}
            onChange={set('bio')}
          />
          <p className="text-xs text-muted-foreground">
            Aparece na sua página de autor (/autores/{form.username || 'usuario'}).
          </p>
        </div>

        <ReadmeField value={readme} onChange={setReadme} error={readmeError} />

        <fieldset ref={socialsRef} className="space-y-4">
          <legend className="font-sans text-base font-semibold tracking-normal">
            Redes sociais
          </legend>
          <p className="text-sm text-muted-foreground">
            Aparecem na sua página de autor, em /creators e no fim dos seus posts, com o ícone e o
            nome da conta. Cole o link do perfil ou só o @usuário; deixe vazio para esconder.
          </p>

          {socials.map((row) => {
            const info = networkInfo(row.network);
            const id = `social-${row.network}`;
            const problem = touched.includes(row.network) ? problemOf(row) : null;
            return (
              <div key={row.network} className="grid gap-3 sm:grid-cols-[1fr_14rem]">
                <div className="space-y-2">
                  <Label htmlFor={id} className="flex items-center gap-2">
                    <ProfileNetworkIcon network={row.network} className="gz-brand h-4 w-4" />
                    {info.label}
                  </Label>
                  <Input
                    id={id}
                    value={row.value}
                    placeholder={info.placeholder}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={problem ? true : undefined}
                    aria-describedby={problem ? `${id}-erro` : undefined}
                    onChange={(event) => setSocial(row.network, { value: event.target.value })}
                    onBlur={() => touch(row.network)}
                  />
                  {problem && (
                    <p id={`${id}-erro`} className="text-xs font-semibold text-destructive">
                      {problem}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-nome`}>
                    Nome exibido <span className="sr-only">no {info.label}</span>
                    <span className="font-normal text-muted-foreground"> (opcional)</span>
                  </Label>
                  <Input
                    id={`${id}-nome`}
                    value={row.label}
                    maxLength={60}
                    placeholder="@usuário"
                    onChange={(event) => setSocial(row.network, { label: event.target.value })}
                  />
                </div>
              </div>
            );
          })}

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Prévia
              </p>
              <SocialConnections socials={preview} owner={form.name || 'você'} compact />
            </div>
          )}
        </fieldset>

        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          Salvar perfil
        </Button>
      </form>

      <form
        className="gz-panel h-fit space-y-4 p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          if (passwords.next !== passwords.confirm) {
            toast.error('A confirmação não confere com a nova senha.');
            return;
          }
          setChanging(true);
          try {
            await adminFetch('/api/admin/me/password', {
              method: 'POST',
              body: JSON.stringify({ current: passwords.current, next: passwords.next }),
            });
            toast.success('Senha alterada. Entre novamente.');
            window.setTimeout(redirectToLogin, 1200);
          } catch (error) {
            toast.error((error as Error).message);
          } finally {
            setChanging(false);
          }
        }}
      >
        <div>
          <h2 className="font-sans text-base font-semibold tracking-normal">Trocar senha</h2>
          <p className="text-sm text-muted-foreground">
            Todas as sessões abertas são encerradas, inclusive esta.
          </p>
        </div>
        {(['current', 'next', 'confirm'] as const).map((key) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`password-${key}`}>
              {key === 'current'
                ? 'Senha atual'
                : key === 'next'
                  ? 'Nova senha'
                  : 'Confirmar nova senha'}
            </Label>
            <Input
              id={`password-${key}`}
              type="password"
              required
              minLength={key === 'current' ? undefined : 12}
              autoComplete={key === 'current' ? 'current-password' : 'new-password'}
              // eslint-disable-next-line security/detect-object-injection -- chave de uma lista fixa
              value={passwords[key]}
              onChange={(event) =>
                setPasswords((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Mínimo de 12 caracteres. Frases longas são ótimas.
        </p>
        <Button type="submit" variant="secondary" disabled={changing}>
          {changing && <Spinner />}
          Trocar senha
        </Button>
      </form>

      <MediaDialog
        kind={picking ? 'cover' : null}
        mediaMode={mediaMode}
        onClose={() => setPicking(false)}
        onInsert={(media) => {
          setPicking(false);
          if (media.kind === 'image') setForm((current) => ({ ...current, avatarUrl: media.url }));
        }}
      />
    </div>
  );
}
