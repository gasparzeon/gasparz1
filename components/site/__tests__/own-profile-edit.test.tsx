/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { COOKIES } from '@/lib/auth/config';

import { OwnProfileEdit } from '../own-profile-edit';

const fetchMock = jest.fn();

function signedInAs(username: string | null) {
  document.cookie = `${COOKIES.hint}=1; path=/`;
  fetchMock.mockResolvedValue(
    username
      ? { ok: true, json: async () => ({ profile: { username } }) }
      : { ok: false, json: async () => ({}) },
  );
}

beforeEach(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
});

afterEach(() => {
  document.cookie = `${COOKIES.hint}=; path=/; max-age=0`;
});

describe('<OwnProfileEdit />', () => {
  it('visitante: não pergunta ao servidor e não mostra nada', async () => {
    const { container } = render(<OwnProfileEdit username="gaspar" hasReadme />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('na própria página: atalho para editar o README', async () => {
    signedInAs('Gaspar');
    render(<OwnProfileEdit username="gaspar" hasReadme />);
    expect(await screen.findByRole('link', { name: 'Editar meu README' })).toHaveAttribute(
      'href',
      '/admin/perfil#readme',
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/me', expect.anything());
  });

  it('sem README ainda: convite para escrever', async () => {
    signedInAs('gaspar');
    render(<OwnProfileEdit username="gaspar" hasReadme={false} />);
    expect(await screen.findByRole('link', { name: 'Escrever meu README' })).toBeInTheDocument();
    expect(screen.getByText(/Esta é a sua página de autor/)).toBeInTheDocument();
  });

  it('falha de rede ou resposta sem usuário: nada aparece (e nada quebra)', async () => {
    document.cookie = `${COOKIES.hint}=1; path=/`;
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const offline = render(<OwnProfileEdit username="gaspar" hasReadme />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(offline.container).toBeEmptyDOMElement();
    offline.unmount();

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ profile: { id: 'u1' } }) });
    const odd = render(<OwnProfileEdit username="gaspar" hasReadme />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(odd.container).toBeEmptyDOMElement();
  });

  it('logado como outra pessoa (ou sessão expirada): nada aparece', async () => {
    signedInAs('ana');
    const { container, unmount } = render(<OwnProfileEdit username="gaspar" hasReadme />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
    unmount();

    signedInAs(null);
    const other = render(<OwnProfileEdit username="gaspar" hasReadme />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(other.container).toBeEmptyDOMElement();
  });
});
