'use client';

import { useId, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';

import { MOTION_EVENT, readMotionPref, writeMotionPref } from '@/lib/motion/preference';

const subscribeMotion = (onChange: () => void) => {
  window.addEventListener(MOTION_EVENT, onChange);
  return () => window.removeEventListener(MOTION_EVENT, onChange);
};

export function useMotionPref() {
  return useSyncExternalStore(subscribeMotion, readMotionPref, () => 'on' as const);
}

// false no servidor e durante a hidratação, true depois: o que depende do
// navegador (tema salvo) só aparece quando não há mais HTML do servidor a casar.
const noopSubscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

// Preferências de leitura: tema (escuro é o padrão) e animações. Ficam no
// rodapé e no menu; botões com aria-pressed, rótulo visível e alvo de 44 px.
export function Prefs() {
  const id = useId();
  const { resolvedTheme, setTheme } = useTheme();
  const motion = useMotionPref();
  const hydrated = useHydrated();
  // O servidor não sabe o tema salvo no navegador: até hidratar, nenhum botão
  // marcado (igual ao HTML do servidor); depois, o tema real.
  const isLight = resolvedTheme === 'light';
  const known = hydrated && resolvedTheme !== undefined;

  return (
    <>
      <div className="gz-pref" role="group" aria-labelledby={`${id}-tema`}>
        <span id={`${id}-tema`} className="gz-pref-name">
          Tema
        </span>
        <div className="gz-seg">
          <button
            type="button"
            aria-pressed={known ? !isLight : undefined}
            onClick={() => setTheme('dark')}
          >
            Escuro
          </button>
          <button
            type="button"
            aria-pressed={known ? isLight : undefined}
            onClick={() => setTheme('light')}
          >
            Claro
          </button>
        </div>
      </div>
      <div className="gz-pref" role="group" aria-labelledby={`${id}-anim`}>
        <span id={`${id}-anim`} className="gz-pref-name">
          Animações
        </span>
        <div className="gz-seg">
          <button
            type="button"
            aria-pressed={motion === 'on'}
            onClick={() => writeMotionPref('on')}
          >
            Ligadas
          </button>
          <button
            type="button"
            aria-pressed={motion === 'off'}
            onClick={() => writeMotionPref('off')}
          >
            Desligadas
          </button>
        </div>
      </div>
    </>
  );
}
