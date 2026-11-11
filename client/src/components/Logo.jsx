/** Brand mark. Colours come from CSS variables, so it follows the light/dark theme. */
export default function Logo({ size }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
      <defs>
        <linearGradient id="vlx-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="var(--surface)" stroke="var(--line)" />
      <path d="M8 10l8 13 8-13" fill="none" stroke="url(#vlx-g)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
