import { describe, expect, it } from 'vitest';
import { orderBasesByHealth } from './api';

describe('MovieApi base failover ordering', () => {
  const bases = ['https://primary.example', 'https://fallback.example'];
  it('keeps configured order when every base is healthy', () => {
    expect(orderBasesByHealth(bases, new Map(), 1_000)).toEqual(bases);
  });
  it('tries the fallback first while the primary is cooling down', () => {
    expect(orderBasesByHealth(bases, new Map([[bases[0], 5_000]]), 1_000)).toEqual([bases[1], bases[0]]);
  });
  it('restores the primary once its cooldown expires', () => {
    expect(orderBasesByHealth(bases, new Map([[bases[0], 900]]), 1_000)).toEqual(bases);
  });
});
