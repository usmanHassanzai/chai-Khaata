import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';
import { HERO_TEAS } from '../data/teaGallery';
import TeaImageFrame from './TeaImageFrame';

type TeaHeroProps = {
  todaySale?: string;
};

export default function TeaHero({ todaySale }: TeaHeroProps) {
  const { user } = useAuth();
  const heroTea = HERO_TEAS[0];

  return (
    <section className="dashboard-hero animate-fade-in-up dashboard-hero-premium">
      <div className="dashboard-hero-bg-photo" style={{ backgroundImage: `url(${heroTea.image})` }} aria-hidden />
      <div className="dashboard-hero-particles" aria-hidden>
        {['🍃', '☕', '🫖', '🌿'].map((p, i) => (
          <span key={i} className="hero-particle" style={{ animationDelay: `${i * 0.8}s` }}>{p}</span>
        ))}
      </div>

      <div className="dashboard-hero-content">
        <p className="dashboard-hero-greeting animate-slide-left">
          Welcome back{user?.shopName ? `, ${user.shopName}` : ''} 👋
        </p>
        <h2 className="dashboard-hero-title animate-slide-left stagger-1">
          <Label k="dashboard.title" variant="stacked" />
        </h2>
        <p className="dashboard-hero-sub animate-slide-left stagger-2">
          Pakistani tea shop khata — sales, stock & dues in one place.
        </p>
        {todaySale && (
          <div className="dashboard-hero-stat animate-scale-in stagger-3 hero-stat-glow">
            <span className="dashboard-hero-stat-label">Today&apos;s Sale</span>
            <span className="dashboard-hero-stat-value">{todaySale}</span>
          </div>
        )}
        <div className="dashboard-hero-actions animate-fade-in-up stagger-4">
          <Link to="/dukaan" className="btn primary hero-btn">+ New Sale</Link>
          <Link to="/godaam" className="btn hero-btn-secondary">+ Purchase</Link>
        </div>
      </div>

      <div className="dashboard-hero-visual animate-slide-right stagger-2">
        <TeaImageFrame src={heroTea.image} alt={heroTea.name} size="lg" />
        <div className="dashboard-hero-badge animate-scale-in stagger-5">
          <span>🇵🇰</span>
          <div>
            <strong>{heroTea.name}</strong>
            <small>{heroTea.nameUr}</small>
          </div>
        </div>
      </div>
    </section>
  );
}
