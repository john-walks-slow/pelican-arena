/** Pelican-on-a-wheel mark: a wheel, the bird's body and its long pouch bill. */
export function PelicanMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="9" cy="23" r="5.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="23" cy="23" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M11.91 18.34L14 15h7l.67 2.66M14 15c-1.5-3 0-6.5 3.5-6.5 2 0 3 1 3.5 2.5l8 1.5c-1.5 2-5 2.6-8 1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
