/** @jest-environment jsdom */
import '@/test/helpers/browser';
import { render } from '@testing-library/react';

import { Highlight, StarMarks, hexDump } from '../text';

describe('<Highlight />', () => {
  it('destaca a palavra dentro do título', () => {
    const { container } = render(
      <h1>
        <Highlight text="Um arquivo vivo da internet moderna." accent="vivo" />
      </h1>,
    );
    expect(container.querySelector('mark')).toHaveTextContent('vivo');
    expect(container).toHaveTextContent('Um arquivo vivo da internet moderna.');
  });

  it('se o destaque não está no título, entra depois dele', () => {
    const { container } = render(
      <h1>
        <Highlight text="Gaspar" accent="Labs" />
      </h1>,
    );
    expect(container).toHaveTextContent('Gaspar Labs');
    expect(container.querySelector('mark')).toHaveTextContent('Labs');
  });

  it('sem destaque, só o texto', () => {
    const { container } = render(
      <h1>
        <Highlight text="Arquivo" accent="  " />
      </h1>,
    );
    expect(container.querySelector('mark')).toBeNull();
    expect(container).toHaveTextContent('Arquivo');
  });
});

describe('<StarMarks />', () => {
  it('*palavra* vira destaque, o resto fica igual', () => {
    const { container } = render(
      <p>
        <StarMarks text="Um blog que *arquiva* a internet e *investiga* o resto." />
      </p>,
    );
    const marks = Array.from(container.querySelectorAll('mark')).map((mark) => mark.textContent);
    expect(marks).toEqual(['arquiva', 'investiga']);
    expect(container).toHaveTextContent('Um blog que arquiva a internet e investiga o resto.');
  });
});

describe('hexDump', () => {
  it('linhas de 8 bytes com deslocamento, hex e ASCII (acentos em UTF-8)', () => {
    const rows = hexDump('urnas é', 2);
    expect(rows).toEqual([
      { offset: '00000000', hex: '75 72 6e 61 73 20 c3 a9', ascii: 'urnas ..' },
    ]);
  });

  it('limita ao número de linhas pedido', () => {
    expect(hexDump('a'.repeat(100), 3)).toHaveLength(3);
    expect(hexDump('a'.repeat(100), 3)[2].offset).toBe('00000010');
  });
});
