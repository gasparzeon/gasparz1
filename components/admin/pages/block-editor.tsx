'use client';

import type { Ref } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

import type { MediaMode } from '@/lib/cms/media-types';
import { FEATURE_ICONS, type PageBlock, type PageBlockType } from '@/lib/site/pages-schema';
import { Button } from '@/components/ui/button';

import { MarkdownEditor, type MarkdownEditorHandle, type MediaRequest } from '../markdown-editor';
import { ListEditor, SelectField, TextField, ToggleField } from '../site/fields';

export const BLOCK_LABELS: Record<PageBlockType, { label: string; description: string }> = {
  hero: { label: 'Abertura', description: 'Chamada, título grande e texto de apoio.' },
  markdown: { label: 'Texto', description: 'Markdown com imagens, vídeos, listas e links.' },
  features: { label: 'Cartões', description: 'Grade de cartões com ícone, título e texto.' },
  cta: { label: 'Chamada', description: 'Caixa de destaque com um botão.' },
  social: { label: 'Contatos', description: 'Botões com as redes sociais do site.' },
};

export function blockLabel(type: PageBlockType) {
  return new Map(Object.entries(BLOCK_LABELS)).get(type)?.label ?? type;
}

const ICON_OPTIONS = FEATURE_ICONS.map((icon) => ({ value: icon, label: icon }));

type BlockEditorProps = {
  block: PageBlock;
  index: number;
  total: number;
  onChange: (block: PageBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  mediaMode: MediaMode;
  onRequestMedia: (kind: MediaRequest) => void;
  editorRef?: Ref<MarkdownEditorHandle>;
};

export function BlockEditor({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  mediaMode,
  onRequestMedia,
  editorRef,
}: BlockEditorProps) {
  const label = blockLabel(block.type);

  return (
    <section aria-label={`Bloco ${index + 1}: ${label}`} className="gz-panel p-0">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {index + 1}. {label}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Subir bloco ${label}`}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Descer bloco ${label}`}
          >
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={`Remover bloco ${label}`}
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {block.type === 'hero' && (
          <>
            <TextField
              label="Chamada (acima do título)"
              value={block.kicker}
              maxLength={60}
              onChange={(kicker) => onChange({ ...block, kicker })}
            />
            <TextField
              label="Título"
              value={block.title}
              maxLength={200}
              onChange={(title) => onChange({ ...block, title })}
            />
            <TextField
              label="Texto de apoio"
              value={block.lead}
              maxLength={1000}
              multiline
              onChange={(lead) => onChange({ ...block, lead })}
            />
          </>
        )}

        {block.type === 'markdown' && (
          <>
            <MarkdownEditor
              ref={editorRef}
              value={block.content}
              onChange={(content) => onChange({ ...block, content })}
              mediaMode={mediaMode}
              onRequestMedia={onRequestMedia}
              className="[&_textarea]:min-h-48"
            />
            <ToggleField
              label="Mostrar em cartão"
              description="Coloca o texto dentro de uma caixa com borda."
              checked={block.boxed}
              onChange={(boxed) => onChange({ ...block, boxed })}
            />
          </>
        )}

        {block.type === 'features' && (
          <>
            <TextField
              label="Título da seção"
              value={block.title}
              maxLength={120}
              onChange={(title) => onChange({ ...block, title })}
            />
            <ListEditor
              items={block.items}
              onChange={(items) => onChange({ ...block, items })}
              createItem={() => ({ icon: 'sparkles' as const, title: 'Novo cartão', text: '' })}
              addLabel="Adicionar cartão"
              max={12}
              emptyText="Nenhum cartão."
              itemLabel={(item) => item.title || 'cartão'}
              renderItem={(item, update) => (
                <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                  <SelectField
                    label="Ícone"
                    value={item.icon}
                    options={ICON_OPTIONS}
                    onChange={(icon) => update({ icon })}
                  />
                  <TextField
                    label="Título"
                    value={item.title}
                    onChange={(title) => update({ title })}
                  />
                  <TextField
                    label="Texto"
                    value={item.text}
                    multiline
                    rows={2}
                    className="sm:col-span-2"
                    onChange={(text) => update({ text })}
                  />
                </div>
              )}
            />
          </>
        )}

        {block.type === 'cta' && (
          <>
            <TextField
              label="Título"
              value={block.title}
              onChange={(title) => onChange({ ...block, title })}
            />
            <TextField
              label="Texto"
              value={block.text}
              multiline
              onChange={(text) => onChange({ ...block, text })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Texto do botão"
                value={block.label}
                onChange={(buttonLabel) => onChange({ ...block, label: buttonLabel })}
              />
              <TextField
                label="Link do botão"
                value={block.href}
                placeholder="/caminho, https://… ou mailto:…"
                onChange={(href) => onChange({ ...block, href })}
              />
            </div>
          </>
        )}

        {block.type === 'social' && (
          <>
            <TextField
              label="Título"
              value={block.title}
              onChange={(title) => onChange({ ...block, title })}
            />
            <TextField
              label="Texto"
              value={block.text}
              multiline
              rows={2}
              onChange={(text) => onChange({ ...block, text })}
            />
            <p className="text-xs text-muted-foreground">
              Os botões vêm de{' '}
              <Link href="/admin/site" className="underline">
                Site → Rodapé e redes
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </section>
  );
}
