import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Panda launch intro', () => {
  it('loads the full-screen intro asset immediately on the first root visit and remembers completion', () => {
    const app = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    const intro = readFileSync(new URL('./components/intro/PandaIntro.tsx', import.meta.url), 'utf8');
    const asset = readFileSync(new URL('../public/intro/panda-intro.html', import.meta.url), 'utf8');
    expect(app).toContain("import { PandaIntro, shouldShowPandaIntro }");
    expect(app).toContain("location === '/' && shouldShowPandaIntro()");
    expect(intro).toContain('src="/intro/panda-intro.html"');
    expect(intro).toContain("sessionStorage.setItem(INTRO_KEY, '1')");
    expect(intro).toContain("event.data?.type === 'panda-intro-end'");
    expect(asset).toContain('rs();play();');
    expect(asset).toContain("type:'panda-intro-end'");
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
