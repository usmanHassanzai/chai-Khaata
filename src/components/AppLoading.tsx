import { Label } from '../i18n/useLabel';

export default function AppLoading() {
  return (
    <div className="auth-loading app-loading-screen">
      <div className="app-loading-tea animate-float">🍵</div>
      <div className="app-loading-steam" aria-hidden>
        <span className="steam-puff" />
        <span className="steam-puff delay-1" />
        <span className="steam-puff delay-2" />
      </div>
      <p className="app-loading-title"><Label k="appName" variant="compact" /></p>
      <div className="auth-spinner" />
      <p className="app-loading-text">Brewing your khata…</p>
    </div>
  );
}
