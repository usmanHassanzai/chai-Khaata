import type { CSSProperties } from 'react';
import { TEA_GALLERY } from '../data/teaGallery';

export default function AuthTeaPanel() {
  return (
    <aside className="auth-tea-panel animate-slide-left" aria-hidden>
      <div className="auth-tea-panel-bg" />
      <div className="auth-tea-panel-content">
        <div className="auth-tea-panel-badge animate-scale-in">
          <span>🍵</span>
          <div>
            <strong>Chai Khata</strong>
            <small>Tea Shop Ledger</small>
          </div>
        </div>

        <h2 className="auth-tea-panel-title">
          Manage your
          <span> tea dukaan </span>
          with style
        </h2>
        <p className="auth-tea-panel-desc">
          Sales, stock, customer dues & cloud sync — beautifully simple.
        </p>

        <div className="auth-tea-carousel">
          {TEA_GALLERY.map((tea, i) => (
            <figure
              key={tea.id}
              className={`auth-tea-slide stagger-${i + 2}${i === 0 ? ' is-featured' : ''}`}
              style={{ '--tea-accent': tea.accent } as CSSProperties}
            >
              <img src={tea.image} alt={tea.name} />
              <figcaption>
                <strong>{tea.name}</strong>
                <span>{tea.nameUr}</span>
              </figcaption>
              <div className="auth-tea-steam">
                <span className="steam-puff" />
                <span className="steam-puff delay-1" />
              </div>
            </figure>
          ))}
        </div>
      </div>

      <div className="floating-leaves" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`floating-leaf leaf-${i + 1}`}>🍃</span>
        ))}
      </div>
    </aside>
  );
}
