import { describe, expect, it } from 'vitest';
import { getProfileStorageKey } from './profileScope';

describe('profile scope', () => {
  it('creates stable user/profile storage namespaces', () => {
    expect(getProfileStorageKey('u1', 'p1', 'kinoma_history')).toBe('kinoma_history__profile_u1_p1');
  });
});
