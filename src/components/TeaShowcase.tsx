import { useEffect, useState, type CSSProperties } from 'react';
import { TEA_GALLERY } from '../data/teaGallery';

export default function TeaShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % TEA_GALLERY.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="tea-showcase animate-fade-in-up stagger-2" aria-label="Tea varieties">
      <div className="tea-showcase-header">
        <h3 className="tea-showcase-title">Pakistani Tea Collection</h3>
        <p className="tea-showcase-sub">Kashmiri · Karak · Doodh Patti — premium blends</p>
      </div>

      <div className="tea-showcase-grid">
        {TEA_GALLERY.map((tea, index) => (
          <article
            key={tea.id}
            className={`tea-showcase-card${active === index ? ' is-active' : ''}`}
            style={{ '--tea-accent': tea.accent } as CSSProperties}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            tabIndex={0}
          >
            <div className="tea-showcase-img-wrap">
              <img src={tea.image} alt={tea.name} loading="lazy" />
              <div className="tea-showcase-steam" aria-hidden>
                <span className="steam-puff" />
                <span className="steam-puff delay-1" />
                <span className="steam-puff delay-2" />
              </div>
            </div>
            <div className="tea-showcase-body">
              <strong>{tea.name}</strong>
              <span className="tea-showcase-ur">{tea.nameUr}</span>
              <p>{tea.description}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="tea-marquee" aria-hidden>
        <div className="tea-marquee-track">
          {[...TEA_GALLERY, ...TEA_GALLERY].map((tea, i) => (
            <span key={`${tea.id}-${i}`} className="tea-marquee-item">
              <img src={tea.image} alt="" />
              {tea.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
