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

  it('keeps removal as a separate, keyboard-reachable 44px button', () => {
    expect(source).toContain('type="button"');
    expect(source).toContain('aria-label={`Remove ${title} from Library`}');
    expect(source).toContain('h-11 w-11');
  });

  it('supports the wide 16:9 layout and optional clamped progress indicator', () => {
    expect(source).toContain("layout?: 'standard' | 'wide'");
    expect(source).toContain('progress?: number');
    expect(source).toContain('layout === \'wide\'');
    expect(source).toContain('aspect-video');
    expect(source).toContain('bg-[#b84d41]');
    expect(source).toContain('aria-valuenow={Math.round(safeProgress * 100)}');
    expect(source).toContain('Math.min(1, Math.max(0, progress))');
    expect(source).toContain('height: 3px');
  });
});
