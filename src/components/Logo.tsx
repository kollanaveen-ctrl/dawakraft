// A folded catalogue page forms the D: clear product information, kept together.

type MarkProps = { size?: number; className?: string };

export function LogoMark({ size = 36, className }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="17" fill="#0E5E4E" />
      <path d="M16 14h17c14 0 23 7 23 18S47 51 33 51H16V14Zm11 10v17h6c8 0 12-3 12-9s-4-8-12-8h-6Z" fill="#FBF8F0" fillRule="evenodd" />
      <path d="M16 14h12L16 26V14Z" fill="#E9A23B" />
      <path d="M30 29h9M30 35h6" stroke="#FBF8F0" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type LogoProps = { tagline?: boolean };

/** Mark plus two-tone wordmark. */
export function Logo({ tagline = true }: LogoProps) {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">
        <span>
          Dawa<span className="logo-kraft">kraft</span>
        </span>
        {tagline && <small>The pharma catalogue studio</small>}
      </span>
    </span>
  );
}
