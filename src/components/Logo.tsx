// The Dawakraft mark: an isometric carton whose top face is marigold (the box becomes the circular).

type MarkProps = { size?: number; className?: string };

export function LogoMark({ size = 36, className }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="15" fill="#0E5E4E" />
      <path d="M32 13 50 23 32 33 14 23Z" fill="#E9A23B" />
      <path d="M14 23 32 33v20L14 43Z" fill="#FFFFFF" />
      <path d="M50 23 32 33v20l18-10Z" fill="#FFFFFF" fillOpacity=".72" />
      <path d="M21 31.5 27 35" stroke="#0E5E4E" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M21 36.5 25 38.8" stroke="#0E5E4E" strokeWidth="2.4" strokeLinecap="round" strokeOpacity=".55" />
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
        {tagline && <small>Box to circular</small>}
      </span>
    </span>
  );
}
