interface AkashvaniLogoProps {
  className?: string;
}

/**
 * Custom monochromatic Akashvani broadcast mark — machined graphite emblem
 * with alabaster antenna mast and concentric silver radio waves.
 */
export function AkashvaniLogo({ className = 'w-8 h-8' }: AkashvaniLogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#2B3039" stroke="#4D5462" strokeWidth="1.5" />
      <rect x="4.5" y="4.5" width="31" height="31" rx="7.5" stroke="#3A404D" strokeWidth="1" />
      {/* Outer broadcast wave arcs (brushed silver) */}
      <path
        d="M11.2 11.8C7.6 15.6 7.6 21.8 11.2 25.6M28.8 11.8C32.4 15.6 32.4 21.8 28.8 25.6"
        stroke="#949CA9"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Inner broadcast wave arcs (crisp alabaster) */}
      <path
        d="M14.8 14.8C12.7 17.1 12.7 20.3 14.8 22.6M25.2 14.8C27.3 17.1 27.3 20.3 25.2 22.6"
        stroke="#F3F5F8"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Central transmitter node & mast */}
      <circle cx="20" cy="18.7" r="2.9" fill="#F3F5F8" />
      <path
        d="M20 21.6V30.5M15.2 30.5H24.8"
        stroke="#F3F5F8"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
