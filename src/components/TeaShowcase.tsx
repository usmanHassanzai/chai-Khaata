import { useEffect, useState, type CSSProperties } from 'react';
import { TEA_GALLERY } from '../data/teaGallery';

export default function TeaShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % TEA_GALLERY.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="tea-showcase tea-showcase-pro animate-fade-in-up" aria-label="Tea varieties">
      <div className="tea-showcase-header">
        <div>
          <h3 className="tea-showcase-title">Tea collection</h3>
          <p className="tea-showcase-sub">Signature blends stocked for your shop</p>
        </div>
      </div>

      <div className="tea-showcase-rail">
        {TEA_GALLERY.map((tea, index) => (
          <article
            key={tea.id}
            className={`tea-showcase-chip${active === index ? ' is-active' : ''}`}
            style={{ '--tea-accent': tea.accent } as CSSProperties}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            tabIndex={0}
          >
            <img src={tea.image} alt="" loading="lazy" />
            <div className="tea-showcase-chip-body">
              <strong>{tea.name}</strong>
              <span className="tea-showcase-ur">{tea.nameUr}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
