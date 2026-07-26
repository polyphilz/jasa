import { cn } from "../lib/cn";

export const Spinner = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    className={cn("size-3.5 animate-spin motion-reduce:animate-none", className)}
  >
    <circle
      cx="8"
      cy="8"
      r="6.5"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.25"
      strokeWidth="2"
    />
    <path
      d="M8 1.5 A 6.5 6.5 0 0 1 14.5 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);
