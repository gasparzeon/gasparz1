import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Camada de movimento do site (GSAP + ScrollTrigger). Tudo é declarativo: o
// HTML marca elementos com data-gz-* e initMotion(root) liga as animações.
// Regras de acessibilidade:
// - nada pisca nem roda sozinho por mais de 5 s (o letreiro tem pausa);
// - o texto final é sempre o do HTML; leitores de tela recebem o texto real;
// - "reduzir movimento" do sistema ou data-motion="off" no <html> deixam só o
//   que é funcional (barra de leitura, parte atual do índice, botão de topo).

gsap.registerPlugin(ScrollTrigger);

const GLYPHS = '#%&*+=<>/\\[]{}_-01';

type Marquee = { el: HTMLElement; loop: gsap.core.Tween; user: boolean; hover: boolean };
let marquees: Marquee[] = [];

const all = <T extends Element = HTMLElement>(root: ParentNode, selector: string) =>
  Array.from(root.querySelectorAll<T & Element>(selector)) as T[];

const num = (value: string | null, fallback: number) => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isNaN(parsed) ? fallback : parsed;
};

const fmt = (value: number, decimals: number) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const scopeOf = (el: Element) => el.closest('[data-gz-scope]') ?? el.parentElement ?? el;

export function motionAllowed() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return (
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    document.documentElement.dataset.motion !== 'off'
  );
}

function textNodes(el: Element, { skipHidden = false } = {}) {
  const out: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    // Partes escondidas dentro do elemento (o "#" das âncoras) ficam como estão.
    const hidden = skipHidden ? node.parentElement?.closest('[aria-hidden="true"]') : null;
    if (hidden && hidden !== el && el.contains(hidden)) continue;
    out.push(node as Text);
  }
  return out;
}

// Texto de um elemento como pares (nó, texto final), para animar e restaurar.
function textParts(el: Element, options?: { skipHidden?: boolean }) {
  return textNodes(el, options).map((node) => ({ node, final: node.nodeValue ?? '' }));
}

const restoreParts = (parts: { node: Text; final: string }[]) =>
  parts.forEach((part) => {
    part.node.nodeValue = part.final;
  });

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

// Durante o efeito, quem tem nome (link, botão, título) recebe o texto real em
// aria-label: o leitor de tela nunca ouve os símbolos.
const NAMED = 'a, button, h1, h2, h3, h4, h5, h6';

function labelWhileScrambling(el: HTMLElement) {
  if (el.closest('[aria-hidden="true"]')) return () => {};
  const host = el.closest<HTMLElement>(NAMED) ?? el;
  if (host.hasAttribute('aria-label')) return () => {};
  // O próprio elemento: só o texto visível (sem o "#" das âncoras). Um link em
  // volta (cartão anterior/próximo): o texto como aparece, com os espaços entre blocos.
  const text =
    host === el
      ? textParts(el, { skipHidden: true })
          .map((part) => part.final)
          .join('')
      : (host.innerText ?? host.textContent ?? '');
  host.setAttribute('aria-label', squash(text));
  return () => host.removeAttribute('aria-label');
}

const running = new Map<HTMLElement, gsap.core.Tween>();

// Letras viram símbolos e se resolvem da esquerda para a direita. Um elemento
// por vez: se o efeito já está rodando nele, não recomeça.
export function scramble(el: HTMLElement, { delay = 0, fast = false } = {}) {
  if (running.has(el) || !el.isConnected) return null;
  const parts = textParts(el, { skipHidden: true });
  if (!parts.length) return null;
  const total = parts.reduce((sum, part) => sum + part.final.length, 0);
  const unlabel = labelWhileScrambling(el);

  const done = () => {
    restoreParts(parts);
    unlabel();
    running.delete(el);
  };

  const state = { p: 0 };
  let tick = -1;
  const tween = gsap.to(state, {
    p: 1,
    delay,
    ease: 'power2.out',
    duration: fast ? Math.min(0.6, 0.25 + total * 0.006) : Math.min(1.3, 0.4 + total * 0.016),
    onUpdate() {
      const frame = Math.floor(state.p * 36);
      if (frame === tick) return;
      tick = frame;
      const shown = Math.floor(state.p * total);
      let pos = 0;
      for (const part of parts) {
        let out = '';
        for (const ch of part.final) {
          out +=
            pos < shown || /\s/.test(ch)
              ? ch
              : GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
          pos += 1;
        }
        part.node.nodeValue = out;
      }
    },
    onComplete: done,
    onInterrupt: done,
  });
  running.set(el, tween);
  return tween;
}

// Termina na hora (texto final no lugar) tudo o que ainda está decodificando.
function finishScrambles() {
  running.forEach((tween) => tween.progress(1).kill());
  running.clear();
}

// Terminal: cada linha é digitada; comandos mais devagar, saída rápida.
function typer(box: HTMLElement) {
  const lines = all(box, '[data-gz-tline]');
  if (!lines.length) return null;
  const timeline = gsap.timeline({ paused: true });
  const restores: (() => void)[] = [];

  lines.forEach((line) => {
    const parts = textParts(line);
    const total = parts.reduce((sum, part) => sum + part.final.length, 0);
    parts.forEach((part) => {
      part.node.nodeValue = '';
    });
    line.style.visibility = 'visible';
    restores.push(() => restoreParts(parts));
    const state = { p: 0 };
    const isCommand = line.hasAttribute('data-gz-cmd');
    timeline.to(
      state,
      {
        p: 1,
        ease: 'none',
        duration: Math.max(0.12, total * (isCommand ? 0.04 : 0.007)),
        onUpdate() {
          const shown = Math.round(state.p * total);
          let pos = 0;
          for (const part of parts) {
            part.node.nodeValue = part.final.slice(
              0,
              Math.max(0, Math.min(part.final.length, shown - pos)),
            );
            pos += part.final.length;
          }
        },
      },
      isCommand ? '+=0.25' : '+=0.05',
    );
  });

  return {
    timeline,
    restore() {
      timeline.kill();
      restores.forEach((restore) => restore());
    },
  };
}

export function initMotion(root: HTMLElement) {
  const mm = gsap.matchMedia();

  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      wide: '(min-width: 1024px)',
      fine: '(hover: hover) and (pointer: fine)',
    },
    (context) => {
      const conditions = context.conditions as { motion: boolean; wide: boolean; fine: boolean };
      const undo: (() => void)[] = [];

      // ---- Funcionais (rodam sempre) ----
      all(root, '[data-gz-progress]').forEach((bar) => {
        const selector = bar.getAttribute('data-gz-progress');
        const target = (selector && root.querySelector(selector)) || root;
        gsap.fromTo(
          bar,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            transformOrigin: '0 50%',
            scrollTrigger: { trigger: target, start: 'top top', end: 'bottom bottom', scrub: true },
          },
        );
      });

      const parts = all(root, '[data-gz-part]');
      all(root, '[data-gz-spy]').forEach((section, index) => {
        const link = root.querySelector(`[data-gz-toc="${CSS.escape(section.id)}"]`);
        ScrollTrigger.create({
          trigger: section,
          start: 'top 40%',
          end: 'bottom 40%',
          onToggle(self) {
            if (link) {
              link.classList.toggle('is-active', self.isActive);
              if (self.isActive) link.setAttribute('aria-current', 'location');
              else link.removeAttribute('aria-current');
            }
            if (self.isActive) {
              parts.forEach((part) => {
                if (part.firstChild) part.firstChild.nodeValue = String(index + 1);
              });
            }
          },
        });
      });

      all(root, '[data-gz-remaining]').forEach((el) => {
        const node = el.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) return;
        const first = node.nodeValue;
        let last = first;
        const total = num(el.getAttribute('data-gz-total'), 1);
        const selector = el.getAttribute('data-gz-remaining');
        const target = (selector && root.querySelector(selector)) || root;
        ScrollTrigger.create({
          trigger: target,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate(self) {
            const value = String(Math.max(1, Math.ceil(total * (1 - self.progress))));
            if (value !== last) {
              last = value;
              node.nodeValue = value;
            }
          },
        });
        undo.push(() => {
          node.nodeValue = first;
        });
      });

      all(root, '[data-gz-totop]').forEach((button) => {
        ScrollTrigger.create({
          start: 900,
          end: 'max',
          toggleClass: { targets: button, className: 'is-visible' },
        });
      });

      if (!conditions.motion || document.documentElement.dataset.motion === 'off') {
        return () => undo.forEach((fn) => fn());
      }

      // ---- Entrada ----
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      const introParts = all(root, '[data-gz-intro]');
      if (introParts.length) {
        intro.fromTo(
          introParts,
          { autoAlpha: 0, y: 22 },
          { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07 },
          0.05,
        );
      }
      const pops = all(root, '[data-gz-pop]');
      if (pops.length) {
        intro.fromTo(
          pops,
          { autoAlpha: 0, y: 60, scale: 0.7, rotation: (i: number) => (i % 2 ? 14 : -12) },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 1,
            stagger: 0.08,
            ease: 'back.out(1.5)',
          },
          0.2,
        );
      }

      undo.push(finishScrambles);
      all(root, '[data-gz-scramble="intro"]').forEach((el) => {
        scramble(el, { delay: 0.15 });
      });

      // ---- Títulos que decodificam ao entrar na tela ----
      // Os marcados com data-gz-scramble e, no texto dos posts (data-gz-decode),
      // cada parte (h2/h3 do Markdown). Vários de uma vez entram em sequência.
      const decoders = [
        ...all(root, '[data-gz-scramble]:not([data-gz-scramble="intro"])'),
        ...all(root, '[data-gz-decode] :is(h2, h3):not(.sr-only)').filter(
          (el) => !el.querySelector('.katex'),
        ),
      ];
      if (decoders.length) {
        ScrollTrigger.batch(decoders, {
          start: 'top 88%',
          once: true,
          onEnter(batch) {
            batch.forEach((el, index) => {
              scramble(el as HTMLElement, { delay: index * 0.08 });
            });
          },
        });
      }

      // ---- Títulos de posts decodificam de novo ao passar o mouse ----
      if (conditions.fine) {
        all(root, '[data-gz-scramble="hover"]').forEach((el) => {
          const host = el.closest<HTMLElement>('a') ?? el;
          const replay = () => {
            scramble(el, { fast: true });
          };
          host.addEventListener('pointerenter', replay);
          undo.push(() => host.removeEventListener('pointerenter', replay));
        });
      }

      // ---- Terminal que digita quando aparece ----
      all(root, '[data-gz-type]').forEach((box) => {
        const typed = typer(box);
        if (!typed) return;
        undo.push(typed.restore);
        ScrollTrigger.create({
          trigger: box,
          start: 'top 90%',
          once: true,
          onEnter: () => {
            typed.timeline.delay(0.5).play();
          },
        });
      });

      // ---- Linha de varredura: uma passada quando o bloco aparece ----
      all(root, '[data-gz-scan]').forEach((line) => {
        const host = line.parentElement;
        if (!host) return;
        ScrollTrigger.create({
          trigger: host,
          start: 'top 85%',
          once: true,
          onEnter() {
            gsap
              .timeline()
              .fromTo(
                line,
                { top: '0%', autoAlpha: 1 },
                { top: '100%', duration: 1.25, ease: 'power2.inOut' },
              )
              .to(line, { autoAlpha: 0, duration: 0.3 });
          },
        });
      });

      // ---- Revelar ao rolar (só o que ainda está abaixo da tela) ----
      const fold = window.innerHeight * 0.92;
      const reveal = all(root, '[data-gz-reveal]').filter(
        (el) => el.getBoundingClientRect().top > fold,
      );
      if (reveal.length) {
        gsap.set(reveal, { autoAlpha: 0, y: 24 });
        const show = (batch: Element[]) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.07,
            ease: 'power2.out',
            overwrite: true,
          });
        ScrollTrigger.batch(reveal, { start: 'top 92%', once: true, onEnter: show });
        ScrollTrigger.batch(reveal, {
          start: 'top 92%',
          end: 'bottom top',
          once: true,
          onLeave: show,
          onEnterBack: show,
        });
      }

      // ---- Paralaxe na rolagem (com giro opcional) ----
      all(root, '[data-gz-speed]').forEach((el) => {
        const range = (conditions.wide ? 150 : 70) * num(el.getAttribute('data-gz-speed'), 0.3);
        const rotate = num(el.getAttribute('data-gz-rotate'), 0);
        gsap.fromTo(
          el,
          { y: range, rotation: -rotate / 2 },
          {
            y: -range,
            rotation: rotate / 2,
            ease: 'none',
            scrollTrigger: {
              trigger: scopeOf(el),
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });

      // ---- Linhas de texto de fundo deslizam para lados opostos ----
      all(root, '[data-gz-drift]').forEach((row) => {
        const direction = num(row.getAttribute('data-gz-drift'), 1);
        const amount = 16 * Math.abs(direction);
        gsap.fromTo(
          row,
          { xPercent: direction > 0 ? -amount : 0 },
          {
            xPercent: direction > 0 ? 0 : -amount,
            ease: 'none',
            scrollTrigger: {
              trigger: scopeOf(row),
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });

      // ---- Contadores ----
      all(root, '[data-gz-count]').forEach((el) => {
        const node = el.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) return;
        const final = node.nodeValue;
        const target = num(el.getAttribute('data-gz-count'), 0);
        const decimals = num(el.getAttribute('data-gz-dec'), 0);
        const state = { v: 0 };
        gsap.to(state, {
          v: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          onUpdate() {
            node.nodeValue = fmt(state.v, decimals);
          },
          onComplete() {
            node.nodeValue = final;
          },
        });
        undo.push(() => {
          node.nodeValue = final;
        });
      });

      // ---- Letreiro: acelera com a rolagem, inverte ao subir, pausa no mouse/foco ----
      all(root, '[data-gz-marquee]').forEach((el) => {
        const track = el.querySelector('[data-gz-track]');
        if (!track) return;
        const loop = gsap.to(track, {
          xPercent: -50,
          ease: 'none',
          repeat: -1,
          duration: num(el.getAttribute('data-gz-dur'), 40),
        });
        loop.totalTime(loop.duration() * 50);
        const marquee: Marquee = {
          el,
          loop,
          user: el.getAttribute('data-gz-paused') === 'true',
          hover: false,
        };
        if (marquee.user) loop.pause();
        marquees.push(marquee);

        const host = el.closest<HTMLElement>('[data-gz-ticker]') ?? el;
        const hold = () => {
          marquee.hover = true;
          loop.pause();
        };
        const free = () => {
          marquee.hover = false;
          if (!marquee.user) loop.play();
        };
        host.addEventListener('pointerenter', hold);
        host.addEventListener('pointerleave', free);
        host.addEventListener('focusin', hold);
        host.addEventListener('focusout', free);

        ScrollTrigger.create({
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate(self) {
            if (marquee.user || marquee.hover) return;
            const direction = self.direction;
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 6);
            gsap.to(loop, {
              timeScale: direction * boost,
              duration: 0.18,
              overwrite: true,
              onComplete: () => {
                gsap.to(loop, {
                  timeScale: direction,
                  duration: 1.1,
                  ease: 'power3.out',
                  overwrite: true,
                });
              },
            });
          },
        });

        undo.push(() => {
          host.removeEventListener('pointerenter', hold);
          host.removeEventListener('pointerleave', free);
          host.removeEventListener('focusin', hold);
          host.removeEventListener('focusout', free);
          marquees = marquees.filter((item) => item !== marquee);
        });
      });

      // ---- Camadas que seguem o mouse (desktop) ----
      if (conditions.wide && conditions.fine) {
        all(root, '[data-gz-tilt]').forEach((zone) => {
          const layers = all(zone, '[data-gz-depth]').map((el) => ({
            depth: num(el.getAttribute('data-gz-depth'), 1),
            x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' }),
            y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' }),
          }));
          const move = (event: PointerEvent) => {
            const rect = zone.getBoundingClientRect();
            const nx = (event.clientX - rect.left) / rect.width - 0.5;
            const ny = (event.clientY - rect.top) / rect.height - 0.5;
            layers.forEach((layer) => {
              layer.x(nx * 34 * layer.depth);
              layer.y(ny * 26 * layer.depth);
            });
          };
          const leave = () =>
            layers.forEach((layer) => {
              layer.x(0);
              layer.y(0);
            });

          zone.addEventListener('pointermove', move);
          zone.addEventListener('pointerleave', leave);
          undo.push(() => {
            zone.removeEventListener('pointermove', move);
            zone.removeEventListener('pointerleave', leave);
          });
        });
      }

      return () => undo.forEach((fn) => fn());
    },
  );

  const refresh = window.setTimeout(() => ScrollTrigger.refresh(), 700);
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    window.clearTimeout(refresh);
    mm.revert();
  };
}

export function setMarqueePaused(root: Element, paused: boolean) {
  marquees.forEach((marquee) => {
    if (!root.contains(marquee.el)) return;
    marquee.user = paused;
    if (paused) marquee.loop.pause();
    else if (!marquee.hover) marquee.loop.play();
  });
}

// Lista refiltrada entra em cascata curta, com os títulos decodificando.
export function staggerIn(elements: Element[]) {
  if (!elements.length) return;
  if (!motionAllowed()) {
    gsap.set(elements, { clearProps: 'opacity,visibility,transform' });
  } else {
    gsap.fromTo(
      elements,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.03, ease: 'power2.out', overwrite: true },
    );
    elements.slice(0, 12).forEach((row, index) => {
      all(row, '[data-gz-scramble]').forEach((el) => {
        scramble(el, { delay: index * 0.03, fast: true });
      });
    });
  }
  ScrollTrigger.refresh();
}

// Número que rola de um valor ao outro (o React já escreveu o valor final).
export function countBetween(el: Element | null, from: number, to: number, pad = 2) {
  const node = el?.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const format = (value: number) => String(Math.round(value)).padStart(pad, '0');
  const final = format(to);
  if (!motionAllowed() || from === to) {
    node.nodeValue = final;
    return;
  }
  const state = { v: from };
  gsap.to(state, {
    v: to,
    duration: 0.5,
    ease: 'power2.out',
    overwrite: true,
    onUpdate() {
      node.nodeValue = format(state.v);
    },
    onComplete() {
      node.nodeValue = final;
    },
  });
}
