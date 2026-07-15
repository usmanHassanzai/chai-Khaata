import { Link, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import AppLoading from '../components/AppLoading';
import LandingBubbles from '../components/LandingBubbles';
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

const HERO_TRUST_PILLS = [
  { icon: '📱', label: 'Mobile & desktop' },
  { icon: '🇵🇰', label: 'Urdu + English' },
  { icon: '📄', label: 'PDF & CSV export' },
  { icon: '☁️', label: 'Cloud sync' },
] as const;

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#modules', label: 'Modules' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#payment', label: 'Payment' },
  { href: '#how', label: 'How it works' },
] as const;

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal-on-scroll');
    if (!els.length) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);

  return value;
}

export default function Landing() {
  const { user, loading } = useAuth();
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [navScrolled, setNavScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [trustVisible, setTrustVisible] = useState(false);
  const trustRef = useRef<HTMLElement>(null);

  const modulesCount = useCountUp(5, trustVisible);
  const offlineCount = useCountUp(100, trustVisible);

  useScrollReveal();

  useEffect(() => {
    document.body.classList.remove('scroll-lock');
    return () => document.body.classList.remove('scroll-lock');
  }, []);

  useEffect(() => {
    authApi.config().then((c) => { if (c.payment) setPayment(normalizePaymentConfig(c.payment)); }).catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const el = trustRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setTrustVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.remove('scroll-lock');
    if (menuOpen) {
      document.body.classList.add('scroll-lock');
    }
    return () => document.body.classList.remove('scroll-lock');
  }, [menuOpen]);

  const scrollToSection = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (loading) return <AppLoading />;

  if (user && (user.status === 'approved' || user.role === 'admin' || (user.status === 'pending' && user.trialActive))) {
    return <Navigate to="/dashboard" replace />;
  }

  const heroTea = TEA_GALLERY[4];

  return (
    <div className="landing-page">
      <LandingBubbles count={10} variant="light" className="landing-bubbles--page" />

      <header className={`landing-nav${navScrolled ? ' is-scrolled' : ''}${menuOpen ? ' menu-open' : ''}`}>
        <Link to="/" className="landing-logo" onClick={() => setMenuOpen(false)}>
          <span className="landing-logo-icon">🍵</span>
          <span>
            <strong>Patiwala</strong>
            <small>Chai Khata</small>
          </span>
        </Link>

        <nav className="landing-nav-links" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href.slice(1))}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="landing-nav-actions">
          <Link to="/login" className="btn landing-btn-ghost">Log in</Link>
          <Link to="/register" className="btn primary landing-btn-cta landing-btn-shine">Get started</Link>
          <button
            type="button"
            className="landing-nav-toggle"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`landing-nav-mobile${menuOpen ? ' is-open' : ''}`} aria-hidden={!menuOpen}>
          <nav className="landing-nav-mobile-links">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href.slice(1))}
              >
                {link.label}
              </a>
            ))}
            <Link to="/login" className="landing-nav-mobile-login" onClick={() => setMenuOpen(false)}>
              Log in
            </Link>
            <Link to="/register" className="btn primary landing-btn-shine" onClick={() => setMenuOpen(false)}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <LandingBubbles count={18} variant="hero" />
        <div className="landing-hero-bg landing-hero-parallax" style={{ backgroundImage: `url(${heroTea.image})` }} aria-hidden />
        <div className="landing-hero-overlay" aria-hidden />
        <div className="landing-hero-glow landing-hero-glow-a" aria-hidden />
        <div className="landing-hero-glow landing-hero-glow-b" aria-hidden />

        <div className="landing-hero-decor" aria-hidden>
          <span className="floating-leaf leaf-1">🍃</span>
          <span className="floating-leaf leaf-2">🌿</span>
          <span className="floating-leaf leaf-3">☘️</span>
          <span className="floating-leaf leaf-4">🍃</span>
          <span className="landing-hero-orb landing-hero-orb-a">🍵</span>
          <span className="landing-hero-orb landing-hero-orb-b">🫖</span>
        </div>

        <div className="landing-hero-inner">
          <div className="landing-hero-copy animate-zoom-in">
            <span className="landing-eyebrow landing-eyebrow-glow">🇵🇰 Made for Pakistani tea shops</span>
            <h1>
              <span className="landing-hero-ur urdu-text landing-gradient-text" dir="rtl">چائے کی دکان کا smart کھاتہ</span>
              <span className="landing-hero-en">
                The <span className="landing-gradient-text">smart ledger</span> for your <span className="landing-gradient-text">chai dhaba</span>
              </span>
            </h1>
            <p className="landing-hero-lead">
              Patiwala (Chai Khata) helps you manage <strong>sales</strong>, <strong>warehouse stock</strong>,
              <strong> customer dues</strong>, and <strong>dealer payments</strong> — online or offline,
              with cloud backup on any network.
            </p>
            <div className="landing-hero-actions">
              <Link to="/register" className="btn primary landing-btn-lg landing-btn-shine landing-btn-pulse">Start free signup</Link>
              <Link to="/login" className="btn landing-btn-lg landing-btn-outline landing-btn-glass">Log in to your shop</Link>
            </div>
            <div className="landing-hero-trust">
              {HERO_TRUST_PILLS.map((pill, i) => (
                <span key={pill.label} className={`landing-trust-pill animate-fade-in-up stagger-${i + 1}`}>
                  <span aria-hidden>{pill.icon}</span>
                  {pill.label}
                </span>
              ))}
            </div>
          </div>

          <div className="landing-hero-visual animate-zoom-in stagger-3">
            <div className="landing-hero-card landing-hero-card-pro">
              <div className="landing-hero-steam" aria-hidden>
                <span className="steam-puff" />
                <span className="steam-puff delay-1" />
                <span className="steam-puff delay-2" />
              </div>
              <img src={heroTea.image} alt="Pakistani dhaba chai" />
              <div className="landing-hero-card-caption">
                <strong>{heroTea.name}</strong>
                <span className="urdu-text" dir="rtl">{heroTea.nameUr}</span>
              </div>
            </div>
            <div className="landing-float-stat landing-float-a landing-stat-glass">
              <span>Today&apos;s sale</span>
              <strong>Rs 12,450</strong>
            </div>
            <div className="landing-float-stat landing-float-b landing-stat-glass">
              <span>Stock</span>
              <strong>248 kg</strong>
            </div>
          </div>
        </div>
      </section>

      <section ref={trustRef} className="landing-trust reveal-on-scroll reveal-zoom">
        <div className="landing-trust-inner">
          <div className="landing-trust-stat">
            <strong>{modulesCount}</strong>
            <span>Core modules</span>
          </div>
          <div className="landing-trust-stat">
            <strong>{offlineCount}%</strong>
            <span>Offline-ready</span>
          </div>
          <div className="landing-trust-stat">
            <strong className="landing-trust-word">Cloud</strong>
            <span>Any network sync</span>
          </div>
          <div className="landing-trust-stat">
            <strong className="landing-trust-word">PKR</strong>
            <span>Local pricing</span>
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-section-head reveal-on-scroll reveal-zoom">
          <span className="landing-section-badge">Features</span>
          <h2>Everything your tea shop needs</h2>
          <p className="urdu-text" dir="rtl">آپ کی چائے کی دکان کے لیے ہر چیز ایک جگہ</p>
        </div>
        <div className="landing-features-grid">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              className={`landing-feature-card reveal-on-scroll reveal-zoom reveal-delay-${(i % 4) + 1}`}
            >
              <span className="landing-feature-icon-ring">
                <span className="landing-feature-icon">{f.icon}</span>
              </span>
              <h3>{f.title}</h3>
              <p className="landing-feature-ur urdu-text" dir="rtl">{f.titleUr}</p>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="modules" className="landing-section landing-section-alt">
        <div className="landing-modules">
          <div className="landing-modules-copy reveal-on-scroll reveal-zoom-left">
            <span className="landing-section-badge">Modules</span>
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
            <Link to="/register" className="btn primary landing-btn-shine">Create your shop account</Link>
          </div>
          <div className="landing-tea-grid reveal-on-scroll reveal-zoom-right reveal-delay-2">
            {TEA_GALLERY.slice(0, 4).map((tea, i) => (
              <figure key={tea.id} className={`landing-tea-tile reveal-on-scroll reveal-delay-${i + 1}`}>
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

      <section className="landing-section landing-sync-banner reveal-on-scroll reveal-zoom">
        <LandingBubbles count={12} variant="cta" />
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
        <div className="landing-section-head reveal-on-scroll reveal-zoom">
          <span className="landing-section-badge">Pricing</span>
          <h2>Plans & payment</h2>
          <p className="urdu-text" dir="rtl">ماہانہ Rs {SUBSCRIPTION_PRICES.monthly} · سالانہ Rs {SUBSCRIPTION_PRICES.yearly}</p>
        </div>
        <div className="landing-pricing-grid landing-pricing-three">
          <article className="landing-price-card landing-demo-card reveal-on-scroll reveal-zoom reveal-delay-1">
            <span className="landing-price-badge demo">Demo</span>
            <h3>{DEMO_PLAN.name}</h3>
            <p className="landing-price">{DEMO_PLAN.price}</p>
            <p className="landing-demo-disclaimer">{DEMO_PLAN.note}</p>
            <Link to="/register" className="btn">Try signup flow</Link>
          </article>
          {LANDING_PLANS.map((plan, i) => (
            <article
              key={plan.id}
              className={`landing-price-card landing-price-card-pro reveal-on-scroll reveal-zoom reveal-delay-${i + 2}${plan.badge ? ' featured' : ''}`}
            >
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
              <Link to="/register" className="btn primary landing-btn-shine">Sign up — {plan.name}</Link>
            </article>
          ))}
        </div>

        <div id="payment" className="landing-payment-block reveal-on-scroll">
          <PaymentInstructions payment={payment} showDemoNote showAllPlanPrices />
        </div>
      </section>

      <section id="how" className="landing-section landing-section-alt">
        <div className="landing-section-head reveal-on-scroll reveal-zoom">
          <span className="landing-section-badge">Onboarding</span>
          <h2>How it works</h2>
        </div>
        <ol className="landing-steps">
          {STEPS.map((step, i) => (
            <li key={step.n} className={`reveal-on-scroll reveal-zoom reveal-delay-${i + 1}`}>
              <span className="landing-step-num">{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-cta reveal-on-scroll reveal-zoom">
        <LandingBubbles count={16} variant="cta" />
        <div className="landing-cta-inner animate-zoom-in">
          <h2>Ready to digitize your chai khata?</h2>
          <p className="urdu-text" dir="rtl">اپنا کھاتہ آج ہی digital بنائیں</p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn primary landing-btn-lg landing-btn-shine landing-btn-pulse">Get started — Patiwala</Link>
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
