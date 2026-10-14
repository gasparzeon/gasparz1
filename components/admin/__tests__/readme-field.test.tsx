/** @jest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { adminFetch } from '@/lib/admin/client';
import { README_TEMPLATE, readmeProblem } from '@/lib/users/readme';

import { ReadmeField } from '../readme-field';

jest.mock('@/lib/admin/client', () => ({ adminFetch: jest.fn() }));

const mockFetch = adminFetch as jest.Mock;

// O campo é controlado pelo formulário do perfil; aqui, um pai mínimo.
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <ReadmeField value={value} onChange={setValue} error={readmeProblem(value)} />;
}

const textarea = () => screen.getByLabelText('README em Markdown') as HTMLTextAreaElement;
const openTab = (name: string) =>
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

beforeEach(() => {
  mockFetch.mockReset();
});

describe('<ReadmeField />', () => {
  it('explica o que é, o limite e mostra o contador ligado ao campo', () => {
    render(<Harness initial={'### Oi\nTexto'} />);
    expect(screen.getByRole('region', { name: 'README' })).toHaveAttribute('id', 'readme');
    expect(textarea()).toHaveAttribute('maxLength', '1200');
    expect(textarea()).toHaveAccessibleDescription(/até 1\.200 caracteres e 30 linhas/);
    expect(textarea()).toHaveAccessibleDescription(/12 \/ 1\.200 caracteres · 2 \/ 30 linhas/);
  });

  it('vazio: oferece um modelo de partida', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar um modelo' }));
    expect(textarea().value).toBe(README_TEMPLATE);
    expect(screen.queryByRole('button', { name: 'Usar um modelo' })).not.toBeInTheDocument();
  });

  it('avisa leitores de tela só ao chegar perto do limite', () => {
    const { container } = render(<Harness />);
    const live = container.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent('');

    fireEvent.change(textarea(), { target: { value: 'x'.repeat(1120) } });
    expect(live).toHaveTextContent('Faltam menos de 100 caracteres no README.');
    fireEvent.change(textarea(), { target: { value: 'x'.repeat(1200) } });
    expect(live).toHaveTextContent('Limite de caracteres do README atingido.');
  });

  it('linhas demais: erro ligado ao campo', () => {
    render(<Harness />);
    fireEvent.change(textarea(), { target: { value: Array(31).fill('linha').join('\n') } });
    expect(textarea()).toHaveAttribute('aria-invalid', 'true');
    expect(textarea()).toHaveAccessibleDescription(/Use no máximo 30 linhas \(tem 31\)\./);
  });

  it('"Visualizar" mostra a prévia montada pelo servidor (Markdown do README)', async () => {
    mockFetch.mockResolvedValue({
      tree: {
        type: 'root',
        children: [
          {
            type: 'element',
            tagName: 'h3',
            properties: {},
            children: [{ type: 'text', value: 'Sobre mim' }],
          },
        ],
      },
    });
    render(<Harness initial="# Sobre mim" />);
    openTab('Visualizar');

    const heading = await screen.findByRole('heading', { level: 3, name: 'Sobre mim' });
    expect(
      within(heading.closest('.gz-readme') as HTMLElement).getByText('README.md'),
    ).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/preview', {
      method: 'POST',
      body: JSON.stringify({ content: '# Sobre mim', kind: 'readme' }),
    });
  });

  it('prévia sem nada escrito avisa; voltar para "Escrever" mantém o texto', async () => {
    mockFetch.mockResolvedValue({ tree: { type: 'root', children: [] } });
    render(<Harness />);
    openTab('Visualizar');
    expect(await screen.findByText('Nada escrito ainda.')).toBeInTheDocument();

    openTab('Escrever');
    fireEvent.change(textarea(), { target: { value: 'oi' } });
    openTab('Visualizar');
    openTab('Escrever');
    expect(textarea().value).toBe('oi');
  });

  it('erro na prévia aparece no lugar dela', async () => {
    mockFetch.mockRejectedValue(new Error('Sessão expirada.'));
    render(<Harness initial="oi" />);
    openTab('Visualizar');
    await waitFor(() => expect(screen.getByText('Sessão expirada.')).toBeInTheDocument());
  });
});
