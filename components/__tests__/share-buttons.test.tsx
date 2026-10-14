/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { ShareButtons } from '../share-buttons';

const URL = 'https://gaspar.dev/posts/el-nino';

function mockClipboard(writeText: jest.Mock) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
  jest.useRealTimers();
});

describe('<ShareButtons />', () => {
  it('copia o endereço do post e avisa leitores de tela', async () => {
    jest.useFakeTimers();
    const writeText = jest.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<ShareButtons title="El Niño" url={URL} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    });
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(screen.getByRole('button', { name: 'Link copiado' })).toBeInTheDocument();
    expect(screen.getByText('Link do post copiado.')).toHaveAttribute('aria-live', 'polite');

    act(() => {
      jest.advanceTimersByTime(2600);
    });
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
  });

  it('sem permissão de área de transferência, não finge que copiou', async () => {
    mockClipboard(jest.fn().mockRejectedValue(new Error('denied')));
    render(<ShareButtons title="El Niño" url={URL} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }));
    });
    expect(screen.queryByText('Link copiado')).not.toBeInTheDocument();
  });

  it('links das redes com endereço e título codificados, abrindo em nova aba', () => {
    render(<ShareButtons title="El Niño & ENOS" url={URL} />);
    const x = screen.getByRole('link', { name: 'Compartilhar no X' });
    expect(x).toHaveAttribute(
      'href',
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(URL)}&text=${encodeURIComponent('El Niño & ENOS')}`,
    );
    expect(x).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Compartilhar no LinkedIn' })).toHaveAttribute(
      'target',
      '_blank',
    );
  });

  it('só mostra as redes ligadas no painel', () => {
    render(<ShareButtons title="El Niño" url={URL} networks={{ x: false, linkedin: true }} />);
    expect(screen.queryByRole('link', { name: 'Compartilhar no X' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compartilhar no LinkedIn' })).toBeInTheDocument();
  });
});
