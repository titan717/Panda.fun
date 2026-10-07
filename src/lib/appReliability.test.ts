import { describe, expect, it } from 'vitest';
import { isRecoverableChunkLoadError, shouldResetErrorBoundary } from './appReliability';

describe('app navigation reliability', () => {
  it('recognizes lazy chunk loading failures as recoverable', () => {
    expect(isRecoverableChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/Details-abc.js'))).toBe(true);
    expect(isRecoverableChunkLoadError(new Error('Importing a module script failed'))).toBe(true);
    expect(isRecoverableChunkLoadError(new Error('Unexpected render failure'))).toBe(false);
  });

  it('resets a route error boundary when navigation changes', () => {
    expect(shouldResetErrorBoundary('/details/a', '/details/b', true)).toBe(true);
    expect(shouldResetErrorBoundary('/details/a', '/details/a', true)).toBe(false);
    expect(shouldResetErrorBoundary('/details/a', '/details/b', false)).toBe(false);
  });
});
