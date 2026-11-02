interface PelicanRideProps {
  className?: string;
  viewBox?: string;
  road?: boolean;
  dust?: boolean;
}

/**
 * The Pelican-on-a-bicycle mark with spoked wheels, so CSS can visibly turn
 * them. The boot screen adds a road and dust; the shell brand uses the bike on
 * its own.
 */
export function PelicanRide({
  className,
  viewBox = "0 2.5 32 32",
  road = false,
  dust = false,
}: PelicanRideProps) {
  return (
    <svg viewBox={viewBox} fill="none" className={className} aria-hidden="true">
      {road && (
        <line
          className="ride-road"
          x1="1.5"
          y1="29.5"
          x2="30.5"
          y2="29.5"
          strokeWidth="1.6"
          strokeDasharray="3.5 4"
          strokeLinecap="round"
        />
      )}

      {dust && (
        <g className="ride-dust" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <line x1="2.2" y1="26.6" x2="4" y2="26.6" />
          <line x1="1.4" y1="27.9" x2="3.2" y2="27.9" />
        </g>
      )}

      <g className="pelican-ride-body">
        <Wheel className="pelican-ride-wheel-rear" cx={9} />
        <Wheel className="pelican-ride-wheel-front" cx={23} />

        <path
          d="M9 23l5-8h7l2 8M14 15c-1.5-3 0-6.5 3.5-6.5 2 0 3 1 3.5 2.5l8 1.5c-1.5 2-5 2.9-8 2.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

function Wheel({ className, cx }: { className: string; cx: number }) {
  return (
    <g className={`pelican-ride-wheel ${className}`}>
      <circle cx={cx} cy="23" r="5.5" stroke="currentColor" strokeWidth="2" />
      <line x1={cx} y1="18.6" x2={cx} y2="27.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1={cx - 3.81} y1="20.8" x2={cx + 3.81} y2="25.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1={cx - 3.81} y1="25.2" x2={cx + 3.81} y2="20.8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx={cx} cy="23" r="1.15" fill="currentColor" />
    </g>
  );
}
