import { describe, expect, it } from 'vitest';
import { hasAdminClaim, hasAdminMarker } from './adminAccess';

describe('admin access', () => {
  it('accepts the legacy Firebase admin claim', () => {
    expect(hasAdminClaim({ admin: true })).toBe(true);
    expect(hasAdminClaim({ admin: false })).toBe(false);
  });

  it('accepts a console-managed admin marker document', () => {
    expect(hasAdminMarker({ role: 'admin' })).toBe(true);
    expect(hasAdminMarker({ role: 'admin', active: true })).toBe(true);
    expect(hasAdminMarker({ role: 'admin', active: false })).toBe(false);
    expect(hasAdminMarker({ role: 'member' })).toBe(false);
    expect(hasAdminMarker(undefined)).toBe(false);
  });
});
