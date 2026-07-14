/** Build tel: href for mobile dialer (Pakistan-friendly). */
export function phoneTelHref(phone: string): string {
  const raw = String(phone).trim();
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (raw.startsWith('+')) return `tel:+${digits}`;
  if (digits.startsWith('92')) return `tel:+${digits}`;
  if (digits.startsWith('0')) return `tel:+92${digits.slice(1)}`;

  return `tel:${digits}`;
}

export function hasCallablePhone(phone?: string | null): boolean {
  return Boolean(phone?.trim() && phoneTelHref(phone));
}
