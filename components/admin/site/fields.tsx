'use client';

import { useId, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Campos dos formulários de configuração do site e das páginas.

export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="gz-panel p-5 sm:p-6">
      <h3 id={id} className="font-sans text-base font-semibold tracking-normal">
        {title}
      </h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'url' | 'email';
  className?: string;
};

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  maxLength,
  multiline,
  rows = 3,
  type = 'text',
  className,
}: TextFieldProps) {
  const id = useId();
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {maxLength && value.length > maxLength * 0.8 && (
          <span
            className={cn(
              'text-xs tabular-nums',
              value.length > maxLength ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-28"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-ring dark:bg-input/30"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-popover">
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ImageField({
  label,
  value,
  onChange,
  onPick,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onPick: () => void;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-black/30">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <Input
          id={id}
          value={value}
          placeholder="/uploads/... ou https://..."
          onChange={(event) => onChange(event.target.value)}
        />
        <Button type="button" variant="outline" size="sm" onClick={onPick}>
          Escolher
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Lista editável com adicionar, remover e reordenar (menu, redes, cartões).
export function ListEditor<T>({
  items,
  onChange,
  renderItem,
  createItem,
  addLabel,
  max,
  emptyText,
  itemLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  createItem: () => T;
  addLabel: string;
  max: number;
  emptyText: string;
  itemLabel: (item: T, index: number) => string;
}) {
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-start gap-2 rounded-sm border border-border bg-background/40 p-3"
        >
          <div className="min-w-0 flex-1">
            {renderItem(
              item,
              (patch) =>
                onChange(
                  items.map((current, i) => (i === index ? { ...current, ...patch } : current)),
                ),
              index,
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
              aria-label={`Subir ${itemLabel(item, index)}`}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={index === items.length - 1}
              onClick={() => move(index, index + 1)}
              aria-label={`Descer ${itemLabel(item, index)}`}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Remover ${itemLabel(item, index)}`}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={items.length >= max}
        onClick={() => onChange([...items, createItem()])}
      >
        <Plus /> {addLabel}
      </Button>
    </div>
  );
}
