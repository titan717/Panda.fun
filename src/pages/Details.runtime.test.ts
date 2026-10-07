import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Details runtime dependencies', () => {
  it('imports ChevronRight because the episode rail hint renders it', () => {
    const source = readFileSync(new URL('./Details.tsx', import.meta.url), 'utf8');
    const lucideImport = source.match(/import \{([^}]*)\} from ['"]lucide-react['"]/)?.[1] || '';
    expect(lucideImport.split(',').map(value => value.trim())).toContain('ChevronRight');
  });
});
