import { Label } from '../i18n/useLabel';

type Props = {
  icon?: string;
  titleKey?: string;
  title?: string;
  subtitleKey?: string;
  subtitle?: string;
  badge?: string;
};

/** Consistent branded header for all auth screens. */
export default function AuthPageHeader({
  icon = '🍵',
  titleKey,
  title,
  subtitleKey,
  subtitle,
  badge,
}: Props) {
  return (
    <header className="auth-page-header">
      <div className="auth-logo-ring">
        <div className="auth-logo">{icon}</div>
      </div>
      {badge && <span className="auth-page-badge">{badge}</span>}
      <h1 className="auth-page-title">
        {titleKey ? <Label k={titleKey} variant="stacked" /> : title}
      </h1>
      {(subtitleKey || subtitle) && (
        <p className="auth-tagline auth-page-subtitle">
          {subtitleKey ? <Label k={subtitleKey} variant="compact" /> : subtitle}
        </p>
      )}
    </header>
  );
}
