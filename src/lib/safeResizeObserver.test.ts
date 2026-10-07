import { describe, expect, it, vi } from 'vitest';
import { createEpisodeRailObserver } from './safeResizeObserver';

describe('episode rail resize observation', () => {
  it('does not let an observer failure escape the series page', () => {
    const observe = vi.fn(() => {
      throw new Error('ResizeObserver target failure');
    });
    const disconnect = vi.fn();
    const Observer = vi.fn(() => ({ observe, disconnect })) as any;
    const rail = {} as Element;

    expect(() => createEpisodeRailObserver(Observer, rail, vi.fn())).not.toThrow();
    expect(observe).toHaveBeenCalledWith(rail);
    expect(disconnect).toHaveBeenCalled();
  });
});
