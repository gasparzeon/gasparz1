/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';

import { initMotion } from '@/lib/motion/gz-motion';
import { writeMotionPref } from '@/lib/motion/preference';

import { MotionRoot } from '../motion-root';

const cleanup = jest.fn();
let pathname = '/';

jest.mock('next/navigation', () => ({ usePathname: () => pathname }));
jest.mock('@/lib/motion/gz-motion', () => ({ initMotion: jest.fn() }));

beforeEach(() => {
  jest.mocked(initMotion).mockReturnValue(cleanup);
});

afterEach(() => {
  delete document.documentElement.dataset.motion;
  localStorage.clear();
});

describe('<MotionRoot />', () => {
  it('liga as animações no site e limpa ao sair', () => {
    pathname = '/posts';
    const { unmount } = render(<MotionRoot />);
    expect(initMotion).toHaveBeenCalledWith(document.body);
    unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  it('cada escopo só age na sua área (site fora do /admin, painel dentro)', () => {
    pathname = '/admin/posts';
    render(<MotionRoot />);
    expect(initMotion).not.toHaveBeenCalled();

    render(<MotionRoot scope="admin" />);
    expect(initMotion).toHaveBeenCalledTimes(1);
  });

  it('religa quando a página muda e quando o leitor liga/desliga as animações', () => {
    pathname = '/';
    const { rerender } = render(<MotionRoot />);
    expect(initMotion).toHaveBeenCalledTimes(1);

    pathname = '/posts';
    rerender(<MotionRoot />);
    expect(initMotion).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);

    act(() => writeMotionPref('off'));
    expect(initMotion).toHaveBeenCalledTimes(3);
  });
});
