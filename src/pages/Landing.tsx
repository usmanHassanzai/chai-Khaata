import { Link, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppLoading from '../components/AppLoading';
import PaymentInstructions from '../components/PaymentInstructions';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAYMENT_CONFIG, DEMO_PLAN, LANDING_PLANS, SUBSCRIPTION_PRICES, normalizePaymentConfig } from '../data/paymentPlans';
import { TEA_GALLERY } from '../data/teaGallery';
import { Label } from '../i18n/useLabel';
import { authApi, type PaymentConfig } from '../services/authApi';

const FEATURES = [
  {
    icon: '🏪',
    title: 'Dukaan — Sales',
    titleUr: 'دکان — فروخت',
    desc: 'Record every sale with tea name, kg, price, profit & customer. Filter by today, month or year.',
  },
  {
    icon: '📦',
    title: 'Godaam — Warehouse',
    titleUr: 'گودام — خریداری',
    desc: 'Track dealer purchases, bags, miss weight, net kg, payments and dealer dues in one place.',
  },
  {
    icon: '👥',
    title: 'Customers & Dues',
    titleUr: 'گاہک اور باقیات',
    desc: 'Customer IDs, total maal, amount received, pending dues, and full sales ledger per customer.',
  },
  {
    icon: '📋',
    title: 'Stock Ledger',
    titleUr: 'اسٹاک کھاتہ',
    desc: 'Live stock per tea blend — received, sold, current kg, average cost and low-stock alerts.',
  },
  {
    icon: '📊',
    title: 'Dashboard',
    titleUr: 'ڈیش بورڈ',
    desc: 'Today, month & year sales, profit, stock value, customer & dealer dues at a glance.',
  },
  {
    icon: '📄',
    title: 'PDF & CSV Export',
    titleUr: 'PDF اور CSV',
    desc: 'Download or print sales, stock, customer dues and reports from every screen.',
  },
  {
    icon: '☁️',
    title: 'Cloud Sync',
    titleUr: 'کلاؤڈ سنک',
    desc: 'Same data on phone, tablet & laptop — works on any Wi‑Fi or mobile data network.',
  },
  {
    icon: '🔐',
    title: 'Secure Accounts',
    titleUr: 'محفوظ اکاؤنٹ',
    desc: 'Admin approval, subscription plans, OTP login & payment proof for shop owners.',
  },
] as const;

const STEPS = [
  { n: '1', title: 'Choose a plan', body: 'Monthly Rs 500 or Yearly Rs 5000. You get a unique Payment ID (PAT-XXXXXX).' },
  { n: '2', title: 'Pay & send screenshot', body: 'Send via Easypaisa, UBL, Nayapay or JS Bank. WhatsApp screenshot with your Payment ID.' },
  { n: '3', title: 'Admin approves', body: 'Admin gets email, verifies payment, approves — then full access. New signups get a 7-day free preview while waiting.' },
] as const;

export default function Landing() {
  const { user, loading } = useAuth();
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);

  useEffect(() => {
    authApi.config().then((c) => { if (c.payment) setPayment(normalizePaymentConfig(c.payment)); }).catch(() => {});
  }, []);

  if (loading) return <AppLoading />;

  if (user && (user.status === 'approved' || user.role === 'admin' || (user.status === 'pending' && user.trialActive))) {
    return <Navigate to="/dashboard" replace />;
  }

  const heroTea = TEA_GALLERY[4];

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="landing-logo">
          <span className="landing-logo-icon">🍵</span>
          <span>
            <strong>Patiwala</strong>
            <small>Chai Khata</small>
          </span>
        </Link>
        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#modules">Modules</a>
          <a href="#pricing">Pricing</a>
          <a href="#payment">Payment</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn landing-btn-ghost">Log in</Link>
          <Link to="/register" className="btn primary landing-btn-cta">Get started</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-bg" style={{ backgroundImage: `url(${heroTea.image})` }} aria-hidden />
        <div className="landing-hero-overlay" aria-hidden />
        <div className="landing-hero-inner">
          <div className="landing-hero-copy animate-fade-in-up">
            <span className="landing-eyebrow">🇵🇰 Made for Pakistani tea shops</span>
            <h1>
              <span className="landing-hero-ur urdu-text" dir="rtl">چائے کی دکان کا smart کھاتہ</span>
              <span className="landing-hero-en">The smart ledger for your chai dhaba</span>
            </h1>
            <p className="landing-hero-lead">
              Patiwala (Chai Khata) helps you manage <strong>sales</strong>, <strong>warehouse stock</strong>,
              <strong> customer dues</strong>, and <strong>dealer payments</strong> — online or offline,
              with cloud backup on any network.
            </p>
            <div className="landing-hero-actions">
              <Link to="/register" className="btn primary landing-btn-lg">Start free signup</Link>
              <Link to="/login" className="btn landing-btn-lg landing-btn-outline">Log in to your shop</Link>
            </div>
            <ul className="landing-hero-bullets">
              <li>✓ Works on mobile & desktop</li>
              <li>✓ Urdu + English interface</li>
              <li>✓ Export PDF, CSV & print</li>
            </ul>
          </div>
          <div className="landing-hero-visual animate-fade-in-up stagger-2">
            <div className="landing-hero-card">
              <img src={heroTea.image} alt="Pakistani dhaba chai" />
              <div className="landing-hero-card-caption">
                <strong>{heroTea.name}</strong>
                <span className="urdu-text" dir="rtl">{heroTea.nameUr}</span>
              </div>
            </div>
            <div className="landing-float-stat landing-float-a">
              <span>Today&apos;s sale</span>
              <strong>Rs 12,450</strong>
            </div>
            <div className="landing-float-stat landing-float-b">
              <span>Stock</span>
              <strong>248 kg</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-trust">
        <div className="landing-trust-inner">
          <div><strong>5</strong><span>Core modules</span></div>
          <div><strong>100%</strong><span>Offline-ready</span></div>
          <div><strong>Cloud</strong><span>Any network sync</span></div>
          <div><strong>PKR</strong><span>Local pricing</span></div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-section-head">
          <h2>Everything your tea shop needs</h2>
          <p className="urdu-text" dir="rtl">آپ کی چائے کی دکان کے لیے ہر چیز ایک جگہ</p>
        </div>
        <div className="landing-features-grid">
          {FEATURES.map((f, i) => (
            <article key={f.title} className={`landing-feature-card animate-fade-in-up stagger-${(i % 4) + 1}`}>
              <span className="landing-feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p className="landing-feature-ur urdu-text" dir="rtl">{f.titleUr}</p>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="modules" className="landing-section landing-section-alt">
        <div className="landing-modules">
          <div className="landing-modules-copy">
            <h2>Dukaan, Godaam, Customers & Stock</h2>
            <p>
              From morning karak sales to evening dealer payments — record every transaction with bill photos,
              profit per kg, and automatic stock calculations from your Godaam purchases.
            </p>
            <ul className="landing-checklist">
              <li>Sale profit calculated from weighted average purchase price</li>
              <li>Low-stock warnings on dashboard</li>
              <li>Customer ledger with dues & receiving amount</li>
              <li>Dealer summary with current balance</li>
              <li>Admin panel for user approvals & payments</li>
            </ul>
            <Link to="/register" className="btn primary">Create your shop account</Link>
          </div>
          <div className="landing-tea-grid">
            {TEA_GALLERY.slice(0, 4).map((tea) => (
              <figure key={tea.id} className="landing-tea-tile">
                <img src={tea.image} alt={tea.name} loading="lazy" />
                <figcaption>
                  <strong>{tea.name}</strong>
                  <span className="urdu-text" dir="rtl">{tea.nameUr}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-sync-banner">
        <div className="landing-sync-inner">
          <div>
            <h2>☁️ Use on any internet network</h2>
            <p>
              Data saves locally first — then syncs to the cloud when you&apos;re online.
              Open the same account on another phone on mobile data or different Wi‑Fi.
              Set your cloud URL to <strong>patiwala.pk</strong> in Settings.
            </p>
          </div>
          <div className="landing-sync-tags">
            <span>Wi‑Fi</span>
            <span>4G / 5G</span>
            <span>Offline mode</span>
            <span>Auto retry</span>
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-section landing-pricing-pro">
        <div className="landing-section-head">
          <h2>Plans & payment</h2>
          <p className="urdu-text" dir="rtl">ماہانہ Rs {SUBSCRIPTION_PRICES.monthly} · سالانہ Rs {SUBSCRIPTION_PRICES.yearly}</p>
        </div>
        <div className="landing-pricing-grid landing-pricing-three">
          <article className="landing-price-card landing-demo-card">
            <span className="landing-price-badge demo">Demo</span>
            <h3>{DEMO_PLAN.name}</h3>
            <p className="landing-price">{DEMO_PLAN.price}</p>
            <p className="landing-demo-disclaimer">{DEMO_PLAN.note}</p>
            <Link to="/register" className="btn">Try signup flow</Link>
          </article>
          {LANDING_PLANS.map((plan) => (
            <article key={plan.id} className={`landing-price-card${plan.badge ? ' featured' : ''}`}>
              {plan.badge && <span className="landing-price-badge">{plan.badge}</span>}
              <h3>{plan.name}</h3>
              <p className="landing-price">
                Rs {plan.price.toLocaleString()}
                <small>{plan.period}</small>
              </p>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link to="/register" className="btn primary">Sign up — {plan.name}</Link>
            </article>
          ))}
        </div>

        <div id="payment" className="landing-payment-block">
          <PaymentInstructions payment={payment} showDemoNote showAllPlanPrices />
        </div>
      </section>

      <section id="how" className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <h2>How it works</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="landing-step-num">{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-inner">
          <h2>Ready to digitize your chai khata?</h2>
          <p className="urdu-text" dir="rtl">اپنا کھاتہ آج ہی digital بنائیں</p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn primary landing-btn-lg">Get started — Patiwala</Link>
            <Link to="/login" className="btn landing-btn-lg landing-btn-outline-light">Already have an account?</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-icon">🍵</span>
            <div>
              <strong><Label k="appName" variant="compact" /></strong>
              <p>Patiwala · Pakistan · Tea shop ledger</p>
            </div>
          </div>
          <div className="landing-footer-links">
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
            <Link to="/forgot-password">Forgot password</Link>
          </div>
          <p className="landing-footer-copy">
            © {new Date().getFullYear()} Patiwala (Chai Khata). Built for dhabas, patiwalas & tea wholesalers.
          </p>
        </div>
      </footer>
    </div>
  );
}
