type Props = {
  count?: number;
  variant?: 'hero' | 'light' | 'cta';
  className?: string;
};

/** Floating tea-steam bubbles for landing page sections. */
export default function LandingBubbles({ count = 14, variant = 'hero', className = '' }: Props) {
  const bubbles = Array.from({ length: count }, (_, i) => {
    const size = 6 + (i % 5) * 5 + (i % 3) * 3;
    const left = ((i * 17 + 7) % 94) + 3;
    const delay = (i * 0.65) % 8;
    const duration = 9 + (i % 6) * 2.5;
    const drift = i % 2 === 0 ? 1 : -1;

    return (
      <span
        key={i}
        className={`landing-bubble landing-bubble--${variant}`}
        style={{
          width: size,
          height: size,
          left: `${left}%`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          ['--bubble-drift' as string]: `${drift * (12 + (i % 4) * 6)}px`,
        }}
      />
    );
  });

  return (
    <div className={`landing-bubbles landing-bubbles--${variant} ${className}`.trim()} aria-hidden>
      {bubbles}
    </div>
  );
}
