import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AuthTeaPanel from './AuthTeaPanel';

type AuthLayoutProps = {
  children: ReactNode;
  wide?: boolean;
};

/** Split tea hero + glass card layout for all auth pages. */
export default function AuthLayout({ children, wide = false }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <AuthTeaPanel />
      <div className="auth-page-inner">
        <div className="auth-mobile-strip">
          <Link to="/" className="auth-mobile-brand">
            <span>🍵</span>
            <div>
              <strong>Patiwala</strong>
              <small>Chai Khata</small>
            </div>
          </Link>
          <Link to="/" className="auth-mobile-home">Home</Link>
        </div>
        <div className={`auth-card auth-card-pro animate-scale-in${wide ? ' auth-card-wide' : ''}`}>
          <div className="auth-card-accent" aria-hidden />
          {children}
          <footer className="auth-card-footer">
            <span>🇵🇰 Built for Pakistani tea shops</span>
            <Link to="/">patiwala.pk</Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
