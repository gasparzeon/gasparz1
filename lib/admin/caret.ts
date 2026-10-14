// Posição (em px, relativa ao textarea) de um índice do texto, usando um
// div espelho com o mesmo estilo. Usado para abrir o menu "/" no cursor.

const MIRRORED = [
  'boxSizing',
  'width',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
] as const;

export function caretCoordinates(element: HTMLTextAreaElement, position: number) {
  const computed = window.getComputedStyle(element);
  const mirror = document.createElement('div');
  const style = mirror.style;

  for (const property of MIRRORED) {
    // eslint-disable-next-line security/detect-object-injection -- propriedades CSS de uma lista constante (MIRRORED)
    style[property] = computed[property];
  }
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.top = '0';
  style.left = '-9999px';
  style.whiteSpace = 'pre-wrap';
  style.overflowWrap = 'break-word';
  style.overflow = 'hidden';

  mirror.textContent = element.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = element.value.slice(position) || '.';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5;
  const coordinates = {
    top: marker.offsetTop - element.scrollTop,
    left: marker.offsetLeft - element.scrollLeft,
    lineHeight,
  };
  document.body.removeChild(mirror);

  return coordinates;
}
