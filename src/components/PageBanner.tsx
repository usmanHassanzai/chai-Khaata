import type { CSSProperties } from 'react';
import { Label } from '../i18n/useLabel';

type PageBannerProps = {
  titleKey: string;
  subtitle?: string;
  icon?: string;
  accent?: 'green' | 'gold' | 'blue' | 'brown';
  image?: string;
};

const ACCENTS = {
  green: 'page-banner-green',
  gold: 'page-banner-gold',
  blue: 'page-banner-blue',
  brown: 'page-banner-brown',
};

const DEFAULT_IMAGES = {
  green: '/images/tea/green-mint-chai.jpg',
  gold: '/images/tea/kashmiri-chai.jpg',
  blue: '/images/tea/sada-chai.jpg',
  brown: '/images/tea/karak-chai.jpg',
};

export default function PageBanner({
  titleKey,
  subtitle,
  icon = '🍵',
  accent = 'green',
  image,
}: PageBannerProps) {
  const bgImage = image ?? DEFAULT_IMAGES[accent];

  return (
    <header
      className={`page-banner ${ACCENTS[accent]} animate-fade-in-up page-banner-photo`}
      style={{ '--banner-image': `url(${bgImage})` } as CSSProperties}
    >
      <div className="page-banner-bg" aria-hidden />
      <div className="page-banner-overlay" aria-hidden />
      <div className="page-banner-icon animate-float-slow">{icon}</div>
      <div className="page-banner-text">
        <h2 className="page-banner-title">
          <Label k={titleKey} variant="stacked" />
        </h2>
        {subtitle && <p className="page-banner-sub">{subtitle}</p>}
      </div>
      <div className="page-banner-steam" aria-hidden>
        <span className="steam-puff" />
        <span className="steam-puff delay-1" />
        <span className="steam-puff delay-2" />
      </div>
      <div className="page-banner-shine" aria-hidden />
    </header>
  );
}
