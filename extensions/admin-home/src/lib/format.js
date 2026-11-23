const nf = new Intl.NumberFormat('en-ZA');

/** @param {number | null | undefined} n */
export const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—');

/** @param {number} used @param {number} allowed */
export function pct(used, allowed) {
  if (!allowed) return 0;
  return Math.min(100, Math.round((used / allowed) * 100));
}

/** Tone for a usage badge: fine below 75 %, warning to 90 %, critical above. */
export function usageTone(p) {
  if (p >= 90) return 'critical';
  if (p >= 75) return 'warning';
  return 'success';
}

/** The first day of next month, e.g. "1 December". */
export function nextResetLabel(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d.toLocaleDateString('en-ZA', {day: 'numeric', month: 'long'});
}

export function monthLabel(now = new Date()) {
  return now.toLocaleDateString('en-ZA', {month: 'long', year: 'numeric'});
}
