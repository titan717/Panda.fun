import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('ModernCard accessibility contract', () => {
  const source = readFileSync(new URL('./ModernCard.tsx', import.meta.url), 'utf8');

  it('uses a real link for title navigation instead of a clickable generic container', () => {
    expect(source).toContain('<Link');
    expect(source).toContain('href={detailHref}');
    expect(source).not.toContain('role="link"');
    expect(source).toContain('aria-label={`Open ${title}`}');
  });

  it('keeps removal as a separate, keyboard-reachable button', () => {
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-label={`Remove ${title} from Library`}');
    expect(source).toContain('group-focus-within:opacity-100');
  });
});
