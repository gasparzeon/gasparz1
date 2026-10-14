'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  MailPlus,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminFetch } from '@/lib/admin/client';
import {
  assignableRoles,
  canManageUser,
  roleInfo,
  type Actor,
  type Role,
} from '@/lib/auth/permissions';
import { formatDate } from '@/lib/format';
import { AuthorAvatar } from '@/components/author-avatar';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export type ManagedUserView = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  avatarUrl: string;
  role: Role;
  status: 'pending' | 'invited' | 'active' | 'suspended' | 'rejected';
  requestNote: string;
  createdAt: string;
  requestedAt: string;
  reviewedAt: string | null;
  // Username de quem aprovou ou recusou por último.
  reviewedBy: string | null;
  lastLoginAt: string | null;
  postCount: number;
};

type Tab = ManagedUserView['status'];

export function eligibleHeirs(users: ManagedUserView[], excludeId: string): ManagedUserView[] {
  // Herdeiro precisa escrever no painel: leitor não serve (o servidor recusa).
  return users.filter(
    (user) => user.status === 'active' && user.id !== excludeId && user.role !== 'reader',
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pedidos' },
  { id: 'active', label: 'Ativos' },
  { id: 'invited', label: 'Convidados' },
  { id: 'suspended', label: 'Suspensos' },
  { id: 'rejected', label: 'Recusados' },
];

const by = (username: string | null) => (username ? ` por @${username}` : '');

function RoleSelect({
  id,
  value,
  roles,
  onChange,
  disabled,
  className,
}: {
  id?: string;
  value: Role;
  roles: Role[];
  onChange: (role: Role) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Role)}
      className={cn(
        'h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus:border-ring disabled:opacity-60 dark:bg-input/30',
        className,
      )}
      aria-label="Papel"
    >
      {roles.map((role) => (
        <option key={role} value={role} className="bg-popover">
          {roleInfo(role).label}
        </option>
      ))}
    </select>
  );
}

function LinkDialog({
  link,
  onClose,
}: {
  link: { url: string; purpose: 'invite' | 'reset'; name?: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {link?.purpose === 'invite' ? 'Link de convite' : 'Link para redefinir a senha'}
          </DialogTitle>
          <DialogDescription>
            Envie para {link?.name ?? 'a pessoa'} por um canal seguro. O link é de uso único e vale{' '}
            {link?.purpose === 'invite' ? '7 dias' : '24 horas'}. Ele não será mostrado de novo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={link?.url ?? ''} onFocus={(event) => event.target.select()} />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              if (!link) return;
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface UsersManagerProps {
  users: ManagedUserView[];
  signupEnabled: boolean;
  actor: Actor;
}

export function UsersManager({ users, signupEnabled, actor }: UsersManagerProps) {
  const router = useRouter();
  const pendingCount = users.filter((user) => user.status === 'pending').length;
  const [tab, setTab] = useState<Tab>(pendingCount > 0 ? 'pending' : 'active');
  const [busy, setBusy] = useState<string | null>(null);
  const [signup, setSignup] = useState(signupEnabled);
  const [approveRoles, setApproveRoles] = useState<Record<string, Role>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [link, setLink] = useState<{
    url: string;
    purpose: 'invite' | 'reset';
    name?: string;
  } | null>(null);
  const [removing, setRemoving] = useState<ManagedUserView | null>(null);
  const [transferTo, setTransferTo] = useState('');

  const roles = assignableRoles(actor.role) as Role[];
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const shown = users.filter((user) => user.status === tab);
  const heirs = eligibleHeirs(users, removing?.id ?? '');

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await action();
      if (success) toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const patch = (id: string, body: object) =>
    adminFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });

  const createLink = (user: ManagedUserView, purpose: 'invite' | 'reset') =>
    run(`link-${user.id}`, async () => {
      const { token } = await adminFetch<{ token: string }>(`/api/admin/users/${user.id}/link`, {
        method: 'POST',
        body: JSON.stringify({ purpose }),
      });
      setLink({
        url: `${origin}/admin/${purpose === 'invite' ? 'convite' : 'redefinir-senha'}/${token}`,
        purpose,
        name: user.name,
      });
    });

  return (
    <>
      <div className="gz-panel mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">Contas e pedidos</p>
          <p className="text-sm text-muted-foreground">
            {signup ? (
              <>
                Qualquer pessoa cria uma conta de{' '}
                <strong className="text-foreground">leitor</strong> em{' '}
                <code className="text-foreground">/admin/cadastro</code> e comenta na hora. Para
                escrever, troque o papel dela para colaborador (ou convide direto).
              </>
            ) : (
              'Fechado: novas contas só por convite.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={signup}
            disabled={busy === 'signup'}
            onCheckedChange={(checked) =>
              run('signup', async () => {
                await adminFetch('/api/admin/settings', {
                  method: 'PATCH',
                  body: JSON.stringify({ signupEnabled: checked }),
                });
                setSignup(checked);
              })
            }
            aria-label="Aceitar pedidos de acesso"
          />
          <Button onClick={() => setInviteOpen(true)}>
            <MailPlus />
            Convidar
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-lg border border-border p-1 sm:w-fit">
        {TABS.map((item) => {
          const total = users.filter((user) => user.status === item.id).length;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors',
                tab === item.id
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.label}
              <span
                className={cn(
                  'text-xs tabular-nums',
                  item.id === 'pending' && total > 0
                    ? 'text-sky-700 dark:text-sky-300'
                    : 'text-muted-foreground',
                )}
              >
                {total}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-sm border-2 border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
          {tab === 'pending' ? 'Nenhum pedido aguardando aprovação.' : 'Ninguém aqui.'}
        </div>
      ) : (
        <ul className="gz-panel divide-y divide-border p-0">
          {shown.map((user) => {
            const manageable = canManageUser(actor, user);
            const isMe = user.id === actor.id;

            return (
              <li
                key={user.id}
                className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <AuthorAvatar author={user} size={40} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {user.name}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      @{user.username}
                      {user.email && <> · {user.email}</>}
                    </p>
                    {(user.status === 'pending' || user.status === 'rejected') &&
                      user.requestNote && (
                        <p className="mt-2 rounded-md bg-secondary/60 px-3 py-2 text-sm text-foreground/90">
                          “{user.requestNote}”
                        </p>
                      )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.status === 'pending' && (
                        <>
                          Pediu acesso em {formatDate(user.requestedAt)}
                          {user.reviewedAt && (
                            <>
                              {' '}
                              · já foi recusado{by(user.reviewedBy)} em{' '}
                              {formatDate(user.reviewedAt)}
                            </>
                          )}
                        </>
                      )}
                      {user.status === 'rejected' && (
                        <>
                          Recusado{by(user.reviewedBy)} em {formatDate(user.reviewedAt)}
                        </>
                      )}
                      {user.status === 'invited' && <>Convidado em {formatDate(user.createdAt)}</>}
                      {(user.status === 'active' || user.status === 'suspended') && (
                        <>
                          {user.postCount} post{user.postCount === 1 ? '' : 's'}
                          {user.lastLoginAt && <> · último acesso {formatDate(user.lastLoginAt)}</>}
                          {user.reviewedAt && (
                            <>
                              {' '}
                              · aprovado{by(user.reviewedBy)} em {formatDate(user.reviewedAt)}
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {(user.status === 'pending' || user.status === 'rejected') && manageable && (
                  <div className="flex items-center gap-2">
                    <RoleSelect
                      value={approveRoles[user.id] ?? 'author'}
                      roles={roles}
                      onChange={(role) =>
                        setApproveRoles((current) => ({ ...current, [user.id]: role }))
                      }
                    />
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        run(
                          `approve-${user.id}`,
                          () =>
                            patch(user.id, {
                              action: 'approve',
                              role: approveRoles[user.id] ?? 'author',
                            }),
                          `${user.name} foi aprovado.`,
                        )
                      }
                    >
                      {busy === `approve-${user.id}` ? <Spinner /> : <Check />}
                      Aprovar
                    </Button>
                    {user.status === 'pending' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() =>
                          run(
                            `reject-${user.id}`,
                            () => patch(user.id, { action: 'reject' }),
                            `Pedido de ${user.name} recusado. A pessoa pode pedir de novo.`,
                          )
                        }
                        aria-label={`Recusar ${user.name}`}
                      >
                        {busy === `reject-${user.id}` ? <Spinner /> : <X />}
                        Recusar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => setRemoving(user)}
                        aria-label={`Apagar a conta de ${user.name}`}
                      >
                        <Trash2 />
                        Apagar
                      </Button>
                    )}
                  </div>
                )}

                {user.status !== 'pending' && user.status !== 'rejected' && (
                  <div className="flex items-center gap-2">
                    {manageable && user.status !== 'invited' ? (
                      <RoleSelect
                        value={user.role}
                        roles={roles.includes(user.role) ? roles : [user.role, ...roles]}
                        disabled={busy !== null}
                        onChange={(role) =>
                          run(
                            `role-${user.id}`,
                            () => patch(user.id, { action: 'role', role }),
                            'Papel atualizado.',
                          )
                        }
                      />
                    ) : (
                      <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                        {roleInfo(user.role).label}
                      </span>
                    )}

                    {manageable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ações para ${user.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {user.status === 'invited' ? (
                            <DropdownMenuItem onSelect={() => createLink(user, 'invite')}>
                              <Link2 /> Novo link de convite
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => createLink(user, 'reset')}>
                              <KeyRound /> Link para redefinir senha
                            </DropdownMenuItem>
                          )}
                          {user.status === 'active' && (
                            <DropdownMenuItem
                              onSelect={() =>
                                run(
                                  `status-${user.id}`,
                                  () => patch(user.id, { action: 'status', status: 'suspended' }),
                                  `${user.name} foi suspenso e desconectado.`,
                                )
                              }
                            >
                              <PauseCircle /> Suspender
                            </DropdownMenuItem>
                          )}
                          {user.status === 'suspended' && (
                            <DropdownMenuItem
                              onSelect={() =>
                                run(
                                  `status-${user.id}`,
                                  () => patch(user.id, { action: 'status', status: 'active' }),
                                  `${user.name} foi reativado.`,
                                )
                              }
                            >
                              <PlayCircle /> Reativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setRemoving(user)}
                          >
                            <Trash2 /> {user.status === 'invited' ? 'Cancelar convite' : 'Remover'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <InviteDialog
        open={inviteOpen}
        roles={roles}
        onClose={() => setInviteOpen(false)}
        onInvited={(token, name) => {
          setInviteOpen(false);
          setLink({ url: `${origin}/admin/convite/${token}`, purpose: 'invite', name });
          setTab('invited');
          router.refresh();
        }}
      />

      <LinkDialog link={link} onClose={() => setLink(null)} />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
            setTransferTo('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing?.status === 'rejected'
                ? `Apagar a conta de ${removing?.name}?`
                : removing?.status === 'invited'
                  ? `Cancelar o convite de ${removing?.name}?`
                  : `Remover ${removing?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              A conta é apagada e a pessoa perde o acesso na hora.
              {removing &&
                removing.postCount > 0 &&
                ` Os ${removing.postCount} post(s) dela serão transferidos para quem você escolher.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {removing && removing.postCount > 0 && (
            <div className="space-y-2">
              <Label htmlFor="transfer-to">Transferir posts para</Label>
              <select
                id="transfer-to"
                value={transferTo}
                onChange={(event) => setTransferTo(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-input/30"
              >
                <option value="" className="bg-popover">
                  Escolha alguém…
                </option>
                {heirs.map((heir) => (
                  <option key={heir.id} value={heir.id} className="bg-popover">
                    {heir.name} (@{heir.username})
                  </option>
                ))}
              </select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={busy !== null || (!!removing && removing.postCount > 0 && !transferTo)}
              onClick={() => {
                if (!removing) return;
                const target = removing;
                const query = transferTo ? `?transferTo=${encodeURIComponent(transferTo)}` : '';
                void run(
                  `remove-${target.id}`,
                  async () => {
                    await adminFetch(`/api/admin/users/${target.id}${query}`, { method: 'DELETE' });
                    setRemoving(null);
                    setTransferTo('');
                  },
                  target.status === 'pending' ? 'Pedido recusado.' : 'Usuário removido.',
                );
              }}
            >
              {busy?.startsWith('remove-') && <Spinner />}
              Confirmar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InviteDialog({
  open,
  roles,
  onClose,
  onInvited,
}: {
  open: boolean;
  roles: Role[];
  onClose: () => void;
  onInvited: (token: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('author');
  const [sending, setSending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !sending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar para escrever</DialogTitle>
          <DialogDescription>
            Você recebe um link para enviar à pessoa. Ela escolhe o nome de usuário e a senha.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSending(true);
            try {
              const { token } = await adminFetch<{ token: string }>('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({ name, email, role }),
              });
              onInvited(token, name);
              setName('');
              setEmail('');
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nome</Label>
            <Input
              id="invite-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail (opcional)</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Papel</Label>
            <RoleSelect
              id="invite-role"
              value={role}
              roles={roles}
              onChange={setRole}
              className="h-9 w-full"
            />
            <p className="text-xs text-muted-foreground">{roleInfo(role).description}</p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={sending || !name.trim()}>
              {sending ? <Spinner /> : <UserPlus />}
              Gerar convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
