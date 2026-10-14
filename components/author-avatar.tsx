import { cn } from '@/lib/utils';

type AuthorLike = { name: string; avatarUrl?: string | null };

// Foto do autor ou, sem foto, as iniciais.
export function AuthorAvatar({
  author,
  size = 24,
  className,
}: {
  author: AuthorLike;
  size?: number;
  className?: string;
}) {
  const initials = author.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return author.avatarUrl ? (
    <img
      src={author.avatarUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={cn('shrink-0 rounded-full border border-border object-cover', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border border-border bg-secondary font-semibold text-muted-foreground',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.4) }}
    >
      {initials || '?'}
    </span>
  );
}
