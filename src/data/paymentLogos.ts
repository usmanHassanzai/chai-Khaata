/** Official brand logos for payment methods (public/images/payments/) */
export const PAYMENT_LOGOS: Record<string, { src: string; alt: string }> = {
  easypaisa: { src: '/images/payments/easypaisa.png', alt: 'Easypaisa' },
  ubl: { src: '/images/payments/ubl.png', alt: 'UBL Bank' },
  nayapay: { src: '/images/payments/nayapay.png', alt: 'Nayapay' },
  jsbank: { src: '/images/payments/jsbank.png', alt: 'JS Bank' },
};

export function getPaymentLogo(accountId: string) {
  return PAYMENT_LOGOS[accountId] ?? null;
}
