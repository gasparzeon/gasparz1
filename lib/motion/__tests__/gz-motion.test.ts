/** @jest-environment jsdom */
import { mockMedia } from '@/test/helpers/browser';
import { gsap } from 'gsap';

import { countBetween, initMotion, motionAllowed, scramble, staggerIn } from '../gz-motion';

// Termina na hora todas as animações em andamento.
const finishAll = () =>
  gsap.globalTimeline.getChildren(true, true, false).forEach((tween) => tween.progress(1));

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;

beforeEach(() => mockMedia());

afterEach(() => {
  finishAll();
  document.body.innerHTML = '';
  delete document.documentElement.dataset.motion;
});

describe('scramble (decodificação do texto)', () => {
  it('troca letras por símbolos, mantém os espaços e volta ao texto original', () => {
    document.body.innerHTML =
      '<h2 id="p">Anatomia <code>da</code> urna<a class="heading-anchor" aria-hidden="true" href="#p">#</a></h2>';
    const heading = $('h2');

    const tween = scramble(heading)!;
    tween.progress(0.01);
    const text = heading.textContent!;
    expect(text).not.toBe('Anatomia da urna#');
    expect(text).toHaveLength('Anatomia da urna#'.length);
    expect(text.charAt(8)).toBe(' ');
    expect(text.charAt(11)).toBe(' ');
    // A âncora (aria-hidden) não entra no efeito.
    expect($('a').textContent).toBe('#');

    tween.progress(1);
    expect(heading.textContent).toBe('Anatomia da urna#');
  });

  it('durante o efeito o título tem o texto real em aria-label (sem o "#" da âncora)', () => {
    document.body.innerHTML =
      '<h2 id="p">Anatomia da urna<a aria-hidden="true" href="#p">#</a></h2>';
    const heading = $('h2');

    const tween = scramble(heading)!;
    expect(heading).toHaveAttribute('aria-label', 'Anatomia da urna');
    tween.progress(1);
    expect(heading).not.toHaveAttribute('aria-label');
  });

  it('num trecho dentro de um link, quem recebe o nome é o link inteiro', () => {
    document.body.innerHTML =
      '<a href="/posts/el-nino"><span>Post anterior</span> <span class="t">O Superguia do El Niño</span></a>';
    const link = $('a');

    const tween = scramble($('.t'))!;
    expect(link).toHaveAttribute('aria-label', 'Post anterior O Superguia do El Niño');
    tween.progress(1);
    expect(link).not.toHaveAttribute('aria-label');
    expect(link.textContent).toBe('Post anterior O Superguia do El Niño');
  });

  it('não mexe em aria-label que já existia nem rotula o que é decorativo', () => {
    document.body.innerHTML =
      '<h1 aria-label="Nome fixo">Arquivo</h1><p aria-hidden="true"><span class="w">Gaspar</span></p>';

    scramble($('h1'))!.progress(1);
    expect($('h1')).toHaveAttribute('aria-label', 'Nome fixo');

    scramble($('.w'))!.progress(1);
    expect($('.w')).not.toHaveAttribute('aria-label');
    expect($('p')).not.toHaveAttribute('aria-label');
  });

  it('não recomeça enquanto o mesmo elemento ainda está decodificando', () => {
    document.body.innerHTML = '<h1>Arquivo</h1>';
    const first = scramble($('h1'));
    expect(first).not.toBeNull();
    expect(scramble($('h1'))).toBeNull();
    first!.progress(1);
    expect(scramble($('h1'))).not.toBeNull();
  });

  it('ignora elementos sem texto ou fora da página', () => {
    document.body.innerHTML = '<h1> </h1>';
    expect(scramble($('h1'))).toBeNull();
    expect(scramble(document.createElement('h2'))).toBeNull();
  });
});

describe('motionAllowed', () => {
  it('respeita o "reduzir movimento" do sistema e a escolha do leitor', () => {
    expect(motionAllowed()).toBe(true);

    document.documentElement.dataset.motion = 'off';
    expect(motionAllowed()).toBe(false);

    delete document.documentElement.dataset.motion;
    mockMedia({ reduce: true });
    expect(motionAllowed()).toBe(false);
  });
});

describe('initMotion', () => {
  const page = `
    <h1 data-gz-scramble="intro">Arquivo</h1>
    <article data-gz-article>
      <div class="prose" data-gz-decode>
        <h2 id="a">Primeira parte</h2>
        <h2 id="b" class="sr-only">Notas de rodapé</h2>
      </div>
    </article>
    <ul><li data-gz-row><h3><a href="/posts/a" data-gz-scramble="hover">Título do post</a></h3></li></ul>`;

  it('decodifica o título de entrada e as partes do texto do post', async () => {
    document.body.innerHTML = page;
    const cleanup = initMotion(document.body);

    expect($('h1')).toHaveAttribute('aria-label', 'Arquivo');
    // As partes entram em lote (ScrollTrigger.batch), num tique seguinte.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect($('#a').getAttribute('aria-label') ?? $('#a').textContent).toBe('Primeira parte');
    expect($('#b')).not.toHaveAttribute('aria-label');

    cleanup();
    expect($('h1').textContent).toBe('Arquivo');
    expect($('h1')).not.toHaveAttribute('aria-label');
    expect($('#a').textContent).toBe('Primeira parte');
  });

  it('título de post decodifica de novo ao passar o mouse, até a limpeza', () => {
    document.body.innerHTML = page;
    const cleanup = initMotion(document.body);
    finishAll();

    const link = $('a');
    link.dispatchEvent(new Event('pointerenter'));
    expect(link).toHaveAttribute('aria-label', 'Título do post');

    cleanup();
    expect(link.textContent).toBe('Título do post');
    expect(link).not.toHaveAttribute('aria-label');

    link.dispatchEvent(new Event('pointerenter'));
    expect(link).not.toHaveAttribute('aria-label');
  });

  it('com movimento reduzido nada decodifica', () => {
    mockMedia({ reduce: true });
    document.body.innerHTML = page;
    const cleanup = initMotion(document.body);

    expect($('h1')).not.toHaveAttribute('aria-label');
    $('a').dispatchEvent(new Event('pointerenter'));
    expect($('a')).not.toHaveAttribute('aria-label');
    cleanup();
  });

  it('com as animações desligadas pelo leitor, também não', () => {
    document.documentElement.dataset.motion = 'off';
    document.body.innerHTML = page;
    const cleanup = initMotion(document.body);

    expect($('h1')).not.toHaveAttribute('aria-label');
    expect($('h1').textContent).toBe('Arquivo');
    cleanup();
  });
});

describe('staggerIn (lista refiltrada)', () => {
  const rows = () => {
    document.body.innerHTML = `
      <ul>
        <li data-gz-row><a href="/a" data-gz-scramble="hover">Primeiro</a></li>
        <li data-gz-row><a href="/b" data-gz-scramble="hover">Segundo</a></li>
      </ul>`;
    return Array.from(document.querySelectorAll('[data-gz-row]'));
  };

  it('com movimento, as linhas entram e os títulos decodificam', () => {
    const items = rows();
    staggerIn(items);
    expect(items[0].querySelector('a')).toHaveAttribute('aria-label', 'Primeiro');
    finishAll();
    expect(items[1].querySelector('a')!.textContent).toBe('Segundo');
    expect(items[1].querySelector('a')).not.toHaveAttribute('aria-label');
  });

  it('sem movimento, só garante que tudo esteja visível', () => {
    document.documentElement.dataset.motion = 'off';
    const items = rows();
    staggerIn(items);
    expect(items[0].querySelector('a')).not.toHaveAttribute('aria-label');
    expect((items[0] as HTMLElement).style.opacity).toBe('');
  });
});

describe('countBetween', () => {
  it('escreve o valor final na hora quando não há animação', () => {
    document.body.innerHTML = '<b>07</b>';
    document.documentElement.dataset.motion = 'off';
    countBetween($('b'), 7, 3);
    expect($('b').textContent).toBe('03');
  });

  it('anima de um número ao outro e termina no valor final', () => {
    document.body.innerHTML = '<b>12</b>';
    countBetween($('b'), 12, 4, 3);
    finishAll();
    expect($('b').textContent).toBe('004');
  });
});
