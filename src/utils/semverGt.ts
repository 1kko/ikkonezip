/**
 * Returns true iff `remote` is a strictly higher semver than `local`.
 * Tolerates a leading "v" prefix on either side. On malformed input,
 * returns false (safe default — never falsely advertise an update).
 */
export function semverGt(remote: string, local: string): boolean {
  const r = parse(remote);
  const l = parse(local);
  if (!r || !l) return false;
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true;
    if (r[i] < l[i]) return false;
  }
  return false;
}

function parse(v: string): [number, number, number] | null {
  const stripped = v.replace(/^v/, '');
  const parts = stripped.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
}
