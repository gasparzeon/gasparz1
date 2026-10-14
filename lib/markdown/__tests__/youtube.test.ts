import { isYouTubeUrl, parseYouTube } from '../youtube';

describe('parseYouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', { id: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ', { id: 'dQw4w9WgXcQ' }],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', { id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', { id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ?start=30', { id: 'dQw4w9WgXcQ', start: 30 }],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', { id: 'dQw4w9WgXcQ' }],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', { id: 'dQw4w9WgXcQ', start: 42 }],
    ['https://youtu.be/dQw4w9WgXcQ?t=1h2m3s', { id: 'dQw4w9WgXcQ', start: 3723 }],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', { id: 'dQw4w9WgXcQ' }],
    ['dQw4w9WgXcQ', { id: 'dQw4w9WgXcQ' }],
  ])('%s', (input, expected) => {
    expect(parseYouTube(input)).toEqual(expected);
  });

  it.each([
    'https://vimeo.com/123',
    'https://www.youtube.com/watch?v=curto',
    'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
    'javascript:alert("dQw4w9WgXcQ")',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="x',
    '',
    null,
  ])('recusa %p', (input) => {
    expect(parseYouTube(input)).toBeNull();
  });

  it('ignora tempos de início inválidos ou longos demais', () => {
    expect(parseYouTube('https://youtu.be/dQw4w9WgXcQ?t=abc')).toEqual({ id: 'dQw4w9WgXcQ' });
    expect(parseYouTube(`https://youtu.be/dQw4w9WgXcQ?t=${'1h'.repeat(20)}`)).toEqual({
      id: 'dQw4w9WgXcQ',
    });
  });
});

describe('isYouTubeUrl', () => {
  it('exige uma URL (o ID puro não conta)', () => {
    expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    expect(isYouTubeUrl('dQw4w9WgXcQ')).toBe(false);
  });
});
