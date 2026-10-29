// The Khoebo mark: a chat bubble holding three rising bars, the last one
// green. Drawn inline with the theme colours, so it follows the palette.
// public/brand/ has the same drawing as files, for icons and profile pictures.

export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <circle cx="32" cy="32" r="32" className="fill-flag-blue" />
      <path
        d="M19 14h26a8 8 0 0 1 8 8v17a8 8 0 0 1-8 8H30l-10 7v-7h-1a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z"
        className="fill-surface"
      />
      <rect x="19" y="31" width="7" height="9" rx="2" className="fill-flag-blue" />
      <rect x="28.5" y="26" width="7" height="14" rx="2" className="fill-flag-blue" />
      <rect x="38" y="20" width="7" height="20" rx="2" className="fill-flag-green" />
    </svg>
  );
}
