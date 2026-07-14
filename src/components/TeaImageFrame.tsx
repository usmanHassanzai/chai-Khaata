type TeaImageFrameProps = {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  steam?: boolean;
  className?: string;
};

export default function TeaImageFrame({
  src,
  alt,
  size = 'md',
  steam = true,
  className = '',
}: TeaImageFrameProps) {
  return (
    <div className={`tea-image-frame tea-image-frame-${size} ${className}`.trim()}>
      <div className="tea-image-frame-ring" />
      <img src={src} alt={alt} className="tea-image-frame-img animate-float-slow" loading="lazy" />
      {steam && (
        <div className="tea-image-frame-steam" aria-hidden>
          <span className="steam-puff" />
          <span className="steam-puff delay-1" />
          <span className="steam-puff delay-2" />
        </div>
      )}
    </div>
  );
}
