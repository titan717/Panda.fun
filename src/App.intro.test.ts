import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Panda launch intro', () => {
  it('plays the packaged canvas animation automatically once on initial app load, including deep links', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const intro = readFileSync(new URL('./components/intro/PandaIntro.tsx', import.meta.url), 'utf8');
    const asset = readFileSync(new URL('../public/mypanda-intro.html', import.meta.url), 'utf8');
    expect(app).toContain("import { PandaIntro, shouldShowPandaIntro }");
    expect(app).toContain('useState(() => shouldShowPandaIntro())');
    expect(app).not.toContain("location === '/' && shouldShowPandaIntro()");
    expect(intro).toContain('src="/mypanda-intro.html"');
    expect(intro).toContain("event.data?.type === 'mypanda:intro-end'");
    expect(intro).toContain("sessionStorage.setItem(INTRO_KEY, '1')");
    expect(asset).toContain('rs();play();');
    expect(asset).toContain("type:'mypanda:intro-end'");
    expect(asset).not.toContain('Play intro');
  });

  it('keeps the intro full-screen, responsive and reduced-motion aware', () => {
    const styles = readFileSync(new URL('./components/intro/panda-intro.css', import.meta.url), 'utf8');
    const asset = readFileSync(new URL('../public/mypanda-intro.html', import.meta.url), 'utf8');
    expect(styles).toContain('.panda-intro__asset-frame');
    expect(asset).toContain('viewport-fit=cover');
    expect(asset).toContain('prefers-reduced-motion:reduce');
  });
});
