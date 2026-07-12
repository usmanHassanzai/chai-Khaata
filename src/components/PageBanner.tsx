import { Label } from '../i18n/useLabel';

type PageBannerProps = {
  titleKey: string;
  subtitle?: string;
  icon?: string;
  accent?: 'green' | 'gold' | 'blue' | 'brown';
};

const ACCENTS = {
  green: 'page-banner-green',
  gold: 'page-banner-gold',
  blue: 'page-banner-blue',
  brown: 'page-banner-brown',
};

export default function PageBanner({
  titleKey,
  subtitle,
  icon = '🍵',
  accent = 'green',
}: PageBannerProps) {
  return (
    <header className={`page-banner ${ACCENTS[accent]} animate-fade-in-up`}>
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
      </div>
    </header>
  );
}
