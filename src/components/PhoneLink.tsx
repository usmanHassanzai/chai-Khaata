import { phoneTelHref } from '../utils/phoneLink';

type Props = {
  phone?: string | null;
  className?: string;
  empty?: string;
};

/** Clickable phone number — opens dialer on mobile. */
export default function PhoneLink({ phone, className, empty = '—' }: Props) {
  const value = phone?.trim();
  if (!value) return <span className={className}>{empty}</span>;

  const href = phoneTelHref(value);
  if (!href) return <span className={className}>{value}</span>;

  return (
    <a
      href={href}
      className={`phone-link${className ? ` ${className}` : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}
