import { useEffect, useState } from 'react';
import { TEA_GALLERY } from '../data/teaGallery';

const LEAVES = ['🍃', '☘️', '🌿', '🍵'];

export default function AppInterior() {
  const [teaIndex, setTeaIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTeaIndex((i) => (i + 1) % TEA_GALLERY.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  const featured = TEA_GALLERY[teaIndex];

  return (
    <div className="app-interior" aria-hidden>
      <div className="app-interior-pattern" />
      <div className="app-interior-glow app-interior-glow-a" />
      <div className="app-interior-glow app-interior-glow-b" />

      {LEAVES.map((leaf, i) => (
        <span
          key={i}
          className="floating-leaf"
          style={{
            left: `${8 + i * 22}%`,
            animationDelay: `${i * 1.4}s`,
            animationDuration: `${7 + i * 1.2}s`,
          }}
        >
          {leaf}
        </span>
      ))}

      <div className="app-interior-featured animate-fade-in" key={featured.id}>
        <img src={featured.image} alt="" loading="lazy" />
        <div className="app-interior-featured-label">
          <strong>{featured.name}</strong>
          <span>{featured.nameUr}</span>
        </div>
      </div>
    </div>
  );
}
