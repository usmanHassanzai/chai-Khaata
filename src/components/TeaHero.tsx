import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';
import { HERO_TEAS } from '../data/teaGallery';

type TeaHeroProps = {
  todaySale?: string;
};

export default function TeaHero({ todaySale }: TeaHeroProps) {
  const { user } = useAuth();
  const heroTea = HERO_TEAS[0];

  return (
    <section className="dashboard-hero animate-fade-in-up">
      <div className="dashboard-hero-content">
        <p className="dashboard-hero-greeting">
          Welcome back{user?.shopName ? `, ${user.shopName}` : ''} 👋
        </p>
        <h2 className="dashboard-hero-title">
          <Label k="dashboard.title" variant="stacked" />
        </h2>
        <p className="dashboard-hero-sub">
          Track sales, stock & dues — all in one beautiful khata.
        </p>
        {todaySale && (
          <div className="dashboard-hero-stat animate-scale-in stagger-3">
            <span className="dashboard-hero-stat-label">Today&apos;s Sale</span>
            <span className="dashboard-hero-stat-value">{todaySale}</span>
          </div>
        )}
        <div className="dashboard-hero-actions">
          <Link to="/dukaan" className="btn primary hero-btn">+ New Sale</Link>
          <Link to="/godaam" className="btn hero-btn-secondary">+ Purchase</Link>
        </div>
      </div>

      <div className="dashboard-hero-visual animate-slide-right stagger-2">
        <div className="dashboard-hero-image-ring" />
        <img
          src={heroTea.image}
          alt={heroTea.name}
          className="dashboard-hero-image animate-float-slow"
        />
        <div className="dashboard-hero-steam" aria-hidden>
          <span className="steam-puff" />
          <span className="steam-puff delay-1" />
          <span className="steam-puff delay-2" />
        </div>
        <div className="dashboard-hero-badge">
          <span>🍵</span>
          <div>
            <strong>{heroTea.name}</strong>
            <small>{heroTea.nameUr}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
