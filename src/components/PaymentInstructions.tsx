import { Link } from 'react-router-dom';
import { getPaymentLogo } from '../data/paymentLogos';
import { SUBSCRIPTION_PRICES } from '../data/paymentPlans';
import type { PaymentConfig } from '../services/authApi';

type Props = {
  payment: PaymentConfig;
  paymentRefId?: string;
  planPrice?: number;
  planLabel?: string;
  showAllPlanPrices?: boolean;
  showDemoNote?: boolean;
  compact?: boolean;
};

const ACCOUNT_ICONS: Record<string, string> = {
  easypaisa: '💚',
  ubl: '🏦',
  nayapay: '💜',
  jsbank: '🔵',
};

function PaymentAccountLogo({ accountId }: { accountId: string }) {
  const logo = getPaymentLogo(accountId);
  if (logo) {
    return (
      <img
        src={logo.src}
        alt={logo.alt}
        className={`payment-account-logo${accountId === 'easypaisa' ? ' payment-account-logo--easypaisa' : ''}`}
        width={accountId === 'easypaisa' ? 72 : 48}
        height={48}
        loading="lazy"
      />
    );
  }
  return <span className="payment-account-icon">{ACCOUNT_ICONS[accountId] ?? '💳'}</span>;
}

function formatNumber(num: string) {
  const digits = num.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('03')) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return num;
}

export default function PaymentInstructions({
  payment,
  paymentRefId,
  planPrice,
  planLabel,
  showAllPlanPrices = false,
  showDemoNote = true,
  compact = false,
}: Props) {
  const waLink = payment.whatsappLink || `https://wa.me/${payment.whatsapp}`;
  const accounts = payment.accounts?.length ? payment.accounts : [];

  return (
    <div className={`payment-instructions${compact ? ' compact' : ''}`}>
      {showDemoNote && (
        <div className="payment-demo-note">
          <strong>7-day demo</strong> — shown on website only. Full access starts after admin verifies your payment.
        </div>
      )}

      {paymentRefId && (
        <div className="payment-ref-box">
          <span className="payment-ref-label">Your Payment ID</span>
          <code className="payment-ref-id">{paymentRefId}</code>
          <p className="payment-ref-hint">Write this in WhatsApp message with your payment screenshot</p>
        </div>
      )}

      {showAllPlanPrices ? (
        <p className="payment-amount-due">
          Monthly: <strong>Rs {SUBSCRIPTION_PRICES.monthly.toLocaleString()}</strong>
          {' · '}
          Yearly: <strong>Rs {SUBSCRIPTION_PRICES.yearly.toLocaleString()}</strong>
        </p>
      ) : planLabel && planPrice != null ? (
        <p className="payment-amount-due">
          Amount to send: <strong>Rs {planPrice.toLocaleString()}</strong> ({planLabel})
        </p>
      ) : null}

      <div className="payment-accounts-grid">
        {accounts.map((acc) => (
          <div key={acc.id} className={`payment-account-card${acc.id === 'ubl' ? ' wide' : ''}`}>
            <PaymentAccountLogo accountId={acc.id} />
            <div>
              <strong>{acc.label}</strong>
              <span className="payment-account-name">{acc.accountName}</span>
              <code>{formatNumber(acc.number)}</code>
            </div>
          </div>
        ))}
      </div>

      <div className="payment-whatsapp-row">
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn primary payment-wa-btn">
          📱 WhatsApp screenshot — {payment.whatsappDisplay}
        </a>
        <p className="payment-wa-steps">
          1. Send payment to Easypaisa, UBL, Nayapay or JS Bank above<br />
          2. Screenshot the receipt<br />
          3. WhatsApp it with your <strong>Payment ID</strong>
          {paymentRefId ? `: ${paymentRefId}` : ''}
        </p>
      </div>

      {!compact && (
        <p className="payment-footer-note">
          After login, pending users get a <strong>1-day preview</strong> while admin reviews payment.
          Already registered? <Link to="/login">Log in</Link>
        </p>
      )}
    </div>
  );
}
