import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Mobile featured carousel accessibility', () => {
  it('exposes each featured slide as a labelled, operable pagination control', () => {
    const source = readFileSync(new URL('./MobileHome.tsx', import.meta.url), 'utf8');

    expect(source).toMatch(/<button[^>]*aria-label=\{\`Show featured title \$\{index \+ 1\} of \$\{featuredItems\.length\}: \$\{item\.title\}\`\}/);
    expect(source).toMatch(/aria-current=\{index === activeIndex \? 'true' : undefined\}/);
    expect(source).toMatch(/scrollIntoView\(\{ behavior: prefersReducedMotion \? 'auto' : 'smooth', block: 'nearest', inline: 'center' \}\)/);
  });
});
