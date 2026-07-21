import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';
import { HERO_TEAS } from '../data/teaGallery';
import TeaImageFrame from './TeaImageFrame';

type TeaHeroProps = {
  todaySale?: string;
  monthSale?: string;
  monthProfit?: string;
  showProfit?: boolean;
};

export default function TeaHero({
  todaySale,
  monthSale,
  monthProfit,
  showProfit = true,
}: TeaHeroProps) {
  const { user } = useAuth();
  const heroTea = HERO_TEAS[0];
  const shopName = user?.shopName?.trim();

  return (
    <section className="dashboard-hero dashboard-hero-pro animate-fade-in-up">
      <div
        className="dashboard-hero-bg-photo"
        style={{ backgroundImage: `url(${heroTea.image})` }}
        aria-hidden
      />
      <div className="dashboard-hero-veil" aria-hidden />

      <div className="dashboard-hero-content">
        <p className="dashboard-hero-kicker">Patiwala · Chai Khata</p>
        <p className="dashboard-hero-greeting">
          {shopName ? `Welcome back, ${shopName}` : 'Welcome back'}
        </p>
        <h2 className="dashboard-hero-title">
          <Label k="dashboard.title" variant="stacked" />
        </h2>
        <p className="dashboard-hero-sub">
          Sales, stock, and dues — your shop ledger at a glance.
        </p>

        {(todaySale || monthSale) && (
          <div className="dashboard-hero-metrics">
            {todaySale && (
              <div className="dashboard-hero-metric is-primary">
                <span className="dashboard-hero-metric-label">Today&apos;s sale</span>
                <span className="dashboard-hero-metric-value">{todaySale}</span>
              </div>
            )}
            {monthSale && (
              <div className="dashboard-hero-metric">
                <span className="dashboard-hero-metric-label">This month</span>
                <span className="dashboard-hero-metric-value">{monthSale}</span>
              </div>
            )}
            {showProfit && monthProfit && (
              <div className="dashboard-hero-metric">
                <span className="dashboard-hero-metric-label">Month profit</span>
                <span className="dashboard-hero-metric-value">{monthProfit}</span>
              </div>
            )}
          </div>
        )}

        <div className="dashboard-hero-actions">
          <Link to="/dukaan" className="btn primary hero-btn">
            New sale
          </Link>
          <Link to="/godaam" className="btn hero-btn-secondary">
            Add purchase
          </Link>
        </div>
      </div>

      <div className="dashboard-hero-visual">
        <TeaImageFrame src={heroTea.image} alt={heroTea.name} size="lg" />
        <div className="dashboard-hero-badge">
          <div>
            <strong>{heroTea.name}</strong>
            <small>{heroTea.nameUr}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
