import type { ReactNode } from 'react';
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
        <div className={`auth-card animate-scale-in${wide ? ' auth-card-wide' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
