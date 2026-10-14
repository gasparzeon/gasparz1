// Preferência de animações do leitor: "on" (padrão) ou "off". Guardada no
// navegador e aplicada como data-motion no <html>, que o CSS e o GSAP leem.
// "Reduzir movimento" do sistema operacional sempre vence.

export type MotionPref = 'on' | 'off';

export const MOTION_STORAGE_KEY = 'gz-motion';
export const MOTION_EVENT = 'gz:motion';

export function readMotionPref(): MotionPref {
  if (typeof document === 'undefined') return 'on';
  return document.documentElement.dataset.motion === 'off' ? 'off' : 'on';
}

export function writeMotionPref(value: MotionPref) {
  try {
    localStorage.setItem(MOTION_STORAGE_KEY, value);
  } catch {
    // Modo privado ou armazenamento bloqueado: vale só para esta visita.
  }
  const root = document.documentElement;
  if (value === 'off') root.dataset.motion = 'off';
  else delete root.dataset.motion;
  window.dispatchEvent(new Event(MOTION_EVENT));
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Roda antes da página aparecer (no <body>): aplica a preferência salva e,
// se houver animação, marca o <html> com gz-js para o CSS esconder o que vai
// entrar animado. Sem JavaScript, nada fica escondido.
export const MOTION_BOOT_SCRIPT = `(function(){try{var d=document.documentElement;if(localStorage.getItem('${MOTION_STORAGE_KEY}')==='off'){d.setAttribute('data-motion','off')}else if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('gz-js')}}catch(e){}})();`;
