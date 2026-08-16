interface IconProps {
  className?: string;
}

export const ChipIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="7" y="7" width="10" height="10" rx="1.5" />
    <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" strokeLinecap="round" />
  </svg>
);

export const BoltIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
  </svg>
);

export const BookmarkIcon = ({ className = 'w-5 h-5', filled = false }: IconProps & { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
  </svg>
);

export const ClipboardIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V4z" />
    <path d="M9 11h6M9 15h4" strokeLinecap="round" />
  </svg>
);

export const DownloadIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 3v12m0 0 4-4m-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
  </svg>
);

export const DicesIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const MapPinIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const BuildingIcon = ({ className = 'w-5 h-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M16 9h3a1 1 0 0 1 1 1v11M2 21h20" strokeLinecap="round" />
    <path d="M7.5 7h1M10.5 7h1M13.5 7h1M7.5 11h1M10.5 11h1M13.5 11h1M7.5 15h1M10.5 15h1" strokeLinecap="round" />
  </svg>
);

export const CheckIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <path d="m4.5 12.5 5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronIcon = ({ className = 'w-4 h-4', open = false }: IconProps & { open?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`${className} transition-transform ${open ? 'rotate-180' : ''}`}
  >
    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ArrowRightIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M5 12h14m0 0-5-5m5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrashIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const EyeIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);

export const FilterIcon = ({ className = 'w-4 h-4' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" strokeLinejoin="round" />
  </svg>
);
