import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Panda launch intro', () => {
  it('uses the existing intro animation and shows it once on initial app load, including deep links', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const intro = readFileSync(new URL('./components/intro/PandaIntro.tsx', import.meta.url), 'utf8');
    expect(app).toContain("import './components/intro/panda-intro.css'");
    expect(app).toContain('PandaIntro, shouldShowPandaIntro');
    expect(app).toContain('useState(() => shouldShowPandaIntro())');
    expect(intro).toContain("sessionStorage.setItem(INTRO_KEY, '1')");
    const asset = readFileSync(new URL('../public/intro/panda-intro.html', import.meta.url), 'utf8');
    expect(asset).toContain('rs();play();');
    expect(asset).toContain("type:'panda-intro-end'");
    expect(app).not.toContain("if (location !== '/') setShowIntro(false)");
  });
});
