/** @jest-environment jsdom */
import { mockMedia } from '@/test/helpers/browser';

import {
  MOTION_BOOT_SCRIPT,
  MOTION_EVENT,
  MOTION_STORAGE_KEY,
  readMotionPref,
  writeMotionPref,
} from '../preference';

const root = document.documentElement;

// Roda o script de inicialização como o navegador rodaria no <body>.
function boot() {
  const script = document.createElement('script');
  script.textContent = MOTION_BOOT_SCRIPT;
  document.body.appendChild(script);
  script.remove();
}

beforeEach(() => mockMedia());

afterEach(() => {
  delete root.dataset.motion;
  root.classList.remove('gz-js');
  localStorage.clear();
});

describe('preferência de animações', () => {
  it('padrão é "on"; data-motion="off" no <html> vira "off"', () => {
    expect(readMotionPref()).toBe('on');
    root.dataset.motion = 'off';
    expect(readMotionPref()).toBe('off');
  });

  it('salvar marca o <html>, guarda no navegador e avisa quem escuta', () => {
    const listener = jest.fn();
    window.addEventListener(MOTION_EVENT, listener);

    writeMotionPref('off');
    expect(root.dataset.motion).toBe('off');
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('off');

    writeMotionPref('on');
    expect(root.dataset.motion).toBeUndefined();
    expect(localStorage.getItem(MOTION_STORAGE_KEY)).toBe('on');
    expect(listener).toHaveBeenCalledTimes(2);

    window.removeEventListener(MOTION_EVENT, listener);
  });

  it('sem armazenamento (modo privado) ainda vale para a visita', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    writeMotionPref('off');
    expect(root.dataset.motion).toBe('off');
  });
});

describe('script de inicialização (antes da pintura)', () => {
  it('com animações, marca gz-js para o CSS esconder o que vai entrar animado', () => {
    boot();
    expect(root).toHaveClass('gz-js');
    expect(root.dataset.motion).toBeUndefined();
  });

  it('aplica a escolha salva de desligar as animações', () => {
    localStorage.setItem(MOTION_STORAGE_KEY, 'off');
    boot();
    expect(root.dataset.motion).toBe('off');
    expect(root).not.toHaveClass('gz-js');
  });

  it('com "reduzir movimento" no sistema, nada fica escondido', () => {
    mockMedia({ reduce: true });
    boot();
    expect(root).not.toHaveClass('gz-js');
  });
});
