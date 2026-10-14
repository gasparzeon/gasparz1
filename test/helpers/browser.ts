import { TextEncoder } from 'node:util';

// APIs do navegador que o jsdom não tem: matchMedia (o ScrollTrigger consulta
// já ao ser registrado, então este módulo é importado antes de gz-motion),
// scrollTo (chamado a cada ScrollTrigger.refresh), TextEncoder e, para a
// busca (cmdk), ResizeObserver e scrollIntoView. Cada teste pode trocar o que
// o "sistema" prefere chamando mockMedia de novo.
export function mockMedia({ reduce = false, wide = true, fine = true } = {}) {
  window.matchMedia = jest.fn((query: string) => {
    const matches = query.includes('no-preference')
      ? !reduce
      : query.includes(': reduce')
        ? reduce
        : query.includes('min-width')
          ? wide
          : query.includes('hover')
            ? fine
            : false;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as MediaQueryList;
  });
}

mockMedia();
window.scrollTo = jest.fn() as unknown as typeof window.scrollTo;
globalThis.TextEncoder ??= TextEncoder as typeof globalThis.TextEncoder;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
