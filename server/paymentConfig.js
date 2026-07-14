/** Public payment details shown on landing, register & payment screens. */
export function getPaymentConfig() {
  const whatsapp = String(process.env.PAYMENT_WHATSAPP || '923462204903').replace(/\D/g, '');
  return {
    accounts: [
      {
        id: 'easypaisa',
        label: 'Easypaisa',
        number: String(process.env.PAYMENT_EASYPAYSA || '03453395781'),
        accountName: String(process.env.PAYMENT_EASYPAYSA_NAME || 'Muzafar shah'),
      },
      {
        id: 'ubl',
        label: 'UBL Bank',
        number: String(process.env.PAYMENT_UBL_ACCOUNT || '0002346646607'),
        accountName: String(process.env.PAYMENT_UBL_TITLE || 'usman muzafar shah'),
      },
      {
        id: 'nayapay',
        label: 'Nayapay',
        number: String(process.env.PAYMENT_NAYAPAY || '03195145327'),
        accountName: String(process.env.PAYMENT_NAYAPAY_NAME || 'usman muzafar shah'),
      },
      {
        id: 'jsbank',
        label: 'JS Bank',
        number: String(process.env.PAYMENT_JSBANK || '03453395781'),
        accountName: String(process.env.PAYMENT_JSBANK_NAME || 'usman usman'),
      },
    ],
    whatsapp,
    whatsappDisplay: whatsapp.startsWith('92') ? `+${whatsapp}` : whatsapp,
    whatsappLink: `https://wa.me/${whatsapp}`,
    demoDaysMarketing: 7,
    pendingTrialHours: 24,
  };
}

/** @param {import('./store.js').UserRecord[]} users */
export function generatePaymentRefId(users = []) {
  const existing = new Set(users.map((u) => u.paymentRefId).filter(Boolean));
  for (let i = 0; i < 20; i++) {
    const num = Math.floor(100000 + Math.random() * 899999);
    const id = `PAT-${num}`;
    if (!existing.has(id)) return id;
  }
  return `PAT-${Date.now().toString().slice(-6)}`;
}
