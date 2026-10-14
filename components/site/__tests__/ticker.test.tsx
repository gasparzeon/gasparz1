/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { setMarqueePaused } from '@/lib/motion/gz-motion';

import { Ticker } from '../ticker';

jest.mock('@/lib/motion/gz-motion', () => ({ setMarqueePaused: jest.fn() }));

const ITEMS = [
  { id: 'a', number: '#014', title: 'H4CK34NDO AS URNAS!', section: 'investigacoes' as const },
  { id: 'b', number: '#013', title: 'O Superguia do El Niño', section: 'pesquisas' as const },
];

describe('<Ticker />', () => {
  it('tem botão de pausa (WCAG 2.2.2) que para e retoma o letreiro', () => {
    const { container } = render(<Ticker items={ITEMS} />);
    const button = screen.getByRole('button', { name: 'Pausar letreiro de últimos posts' });
    const view = container.querySelector('[data-gz-marquee]');

    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(view).toHaveAttribute('data-gz-paused', 'true');
    expect(setMarqueePaused).toHaveBeenLastCalledWith(container.firstChild, true);

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(setMarqueePaused).toHaveBeenLastCalledWith(container.firstChild, false);
  });

  it('o texto que passa é decorativo (escondido de leitores de tela) e repetido', () => {
    const { container } = render(<Ticker items={ITEMS} />);
    const track = container.querySelector('[data-gz-track]');
    expect(track).toHaveAttribute('aria-hidden', 'true');
    expect(track?.querySelectorAll('.gz-tk')).toHaveLength(ITEMS.length * 2);
    const copies = screen.getAllByText('H4CK34NDO AS URNAS!');
    expect(copies).toHaveLength(2);
    copies.forEach((copy) => expect(track).toContainElement(copy));
  });
});
