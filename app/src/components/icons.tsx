type IconProps = { className?: string };

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const XIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const TrashIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M2.5 4.5h11M6.5 2.5h3M5.5 4.5l.5 9h4l.5-9" />
  </svg>
);

export const CopyIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 8.5l3.5 3.5L13 4.5" />
  </svg>
);

export const RefreshIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6" />
  </svg>
);

export const StopIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
);
