'use client';

import { useId, useState } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  max?: number;
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
}

export function TagInput({ value, onChange, suggestions, max = 20 }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const listId = useId();

  const add = (raw: string) => {
    const tags = raw.split(',').map(normalizeTag).filter(Boolean);
    const next = Array.from(new Set([...value, ...tags])).slice(0, max);
    if (next.length !== value.length) onChange(next);
    setDraft('');
  };

  const query = normalizeTag(draft);
  const matches = suggestions
    .filter((tag) => !value.includes(tag) && (!query || tag.includes(query)))
    .slice(0, 6);

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 transition-colors dark:bg-input/30',
          focused && 'border-ring ring-[3px] ring-ring/50',
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remover tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            if (next.includes(',')) add(next);
            else setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (draft.trim()) add(draft);
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) add(draft);
          }}
          placeholder={value.length ? '' : 'Adicionar tag…'}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
          aria-autocomplete="list"
          aria-controls={listId}
        />
      </div>

      {focused && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {matches.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(tag);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
