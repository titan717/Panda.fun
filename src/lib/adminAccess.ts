export function hasAdminClaim(claims: Record<string, unknown>): boolean {
  return claims.admin === true;
}

export function hasAdminMarker(data: Record<string, unknown> | undefined): boolean {
  return !!data && data.role === 'admin' && data.active !== false;
}
