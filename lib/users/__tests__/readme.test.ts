import {
  README_MAX_CHARS,
  README_MAX_LINES,
  README_TEMPLATE,
  normalizeReadme,
  readmeLines,
  readmeProblem,
  readmeSchema,
} from '../readme';

describe('limites do README', () => {
  it('breve: 1.200 caracteres e 30 linhas', () => {
    expect(README_MAX_CHARS).toBe(1200);
    expect(README_MAX_LINES).toBe(30);
  });

  it('dentro do limite passa; acima, a mensagem diz quanto tem', () => {
    expect(readmeProblem('a'.repeat(1200))).toBeNull();
    expect(readmeProblem('a'.repeat(1201))).toBe('Use no máximo 1.200 caracteres (tem 1.201).');
    expect(readmeProblem(Array(30).fill('linha').join('\n'))).toBeNull();
    expect(readmeProblem(Array(31).fill('linha').join('\n'))).toBe(
      'Use no máximo 30 linhas (tem 31).',
    );
  });

  it('conta depois de limpar: quebras do Windows, espaços no fim e nas pontas', () => {
    expect(normalizeReadme('  \r\n### Oi   \r\ntexto\t\r\n\r\n')).toBe('### Oi\ntexto');
    expect(readmeLines('')).toBe(0);
    expect(readmeLines('a\nb')).toBe(2);
    // 31 linhas, mas as vazias das pontas somem.
    expect(readmeProblem(`\n${Array(30).fill('x').join('\n')}\n`)).toBeNull();
  });

  it('o modelo de partida cabe no limite', () => {
    expect(readmeProblem(README_TEMPLATE)).toBeNull();
  });
});

describe('readmeSchema', () => {
  it('limpa o texto e aceita vazio (sem README)', () => {
    expect(readmeSchema.parse('  oi  ')).toBe('oi');
    expect(readmeSchema.parse('')).toBe('');
  });

  it('recusa acima do limite com a mensagem de quanto tem', () => {
    const result = readmeSchema.safeParse('x'.repeat(1300));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/1\.200 caracteres \(tem 1\.300\)/);
  });
});
