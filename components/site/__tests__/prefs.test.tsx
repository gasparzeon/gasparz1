/** @jest-environment jsdom */
import '@/test/helpers/browser';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';

import { Prefs } from '../prefs';

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <Prefs />
    </ThemeProvider>
  );
}

const root = document.documentElement;

afterEach(() => {
  localStorage.clear();
  root.className = '';
  root.removeAttribute('style');
  delete root.dataset.motion;
  document.body.innerHTML = '';
});

describe('<Prefs />', () => {
  // Regressão: com o tema claro salvo, o HTML do servidor (que não sabe o tema)
  // e a primeira renderização do cliente tinham aria-pressed diferentes.
  it('hidrata sem divergência com o tema claro salvo e depois marca o tema real', async () => {
    const html = renderToString(<App />);
    expect(html).not.toMatch(/aria-pressed="(true|false)"[^>]*>(Escuro|Claro)</);

    localStorage.setItem('theme', 'light');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <App />);
    });

    const logged = errors.mock.calls.flat().map(String).join('\n');
    expect(logged).not.toMatch(/hydrat|didn't match/i);

    const theme = within(container).getByRole('group', { name: 'Tema' });
    expect(within(theme).getByRole('button', { name: 'Claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(theme).getByRole('button', { name: 'Escuro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('troca o tema e as animações, com o estado em aria-pressed', () => {
    render(<App />);
    const theme = screen.getByRole('group', { name: 'Tema' });
    const motion = screen.getByRole('group', { name: 'Animações' });

    expect(within(theme).getByRole('button', { name: 'Escuro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(theme).getByRole('button', { name: 'Claro' }));
    expect(root).toHaveClass('light');
    expect(localStorage.getItem('theme')).toBe('light');
    expect(within(theme).getByRole('button', { name: 'Claro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(within(motion).getByRole('button', { name: 'Desligadas' }));
    expect(root.dataset.motion).toBe('off');
    expect(within(motion).getByRole('button', { name: 'Ligadas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
