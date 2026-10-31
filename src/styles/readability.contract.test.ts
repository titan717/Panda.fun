import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('readability and viewport contract', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./readability.css', import.meta.url), 'utf8');
  const appCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

  it('lets users zoom and enables safe-area insets', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';
    expect(viewport).toContain('viewport-fit=cover');
    expect(viewport).not.toContain('user-scalable=no');
    expect(viewport).not.toContain('maximum-scale');
  });

  it('keeps mobile inputs at 16px so iOS does not zoom on focus', () => {
    expect(css).toContain('font-size: 16px !important');
  });

  it('keeps Settings secondary copy and focus rings readable', () => {
    expect(appCss).toContain('.panda-settings-card__copy small { color: rgba(255,255,255,.76)');
    expect(appCss).toContain('.panda-settings-footer p { color: rgba(255,255,255,.74)');
    expect(appCss).toContain('.panda-settings-card:focus-visible { outline: 3px solid #fff');
  });

  it('keeps Search filters and retry controls readable and large enough to operate', () => {
    expect(appCss).toContain('.kinoma-search-filters button {');
    expect(appCss).toContain('min-height: 44px;');
    expect(appCss).toContain('.kinoma-search-empty p {');
    expect(appCss).toContain('color: rgba(246,242,238,.76)');
  });

  it('loads the readability layer after the other stylesheets', () => {
    expect(main.indexOf("./styles/readability.css")).toBeGreaterThan(main.indexOf("./index.css"));
  });
});
