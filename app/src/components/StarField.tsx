import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { cn } from "../lib/cn";

/** Twinkle cycle ported from glance's welcome screen: dim dots swell through
 * a + into a bright * and settle back. Char and intensity travel together. */
const FRAMES = [
  { char: ".", className: "text-ink/15" },
  { char: ".", className: "text-ink/15" },
  { char: ".", className: "text-ink/25" },
  { char: "+", className: "text-ink/25" },
  { char: "*", className: "text-ink/45" },
  { char: "+", className: "text-ink/25" },
  { char: ".", className: "text-ink/25" },
  { char: ".", className: "text-ink/15" },
];

const FRAME_MS = 150;
/** One star per this many square pixels of container. */
const STAR_DENSITY = 22000;
/** Clearance kept around the avoided element, in px. */
const AVOID_PADDING = 32;

const fract = (value: number) => value - Math.floor(value);
/** Deterministic pseudo-random in [0, 1): the field stays put across renders
 * and resizes instead of reshuffling. */
const hash = (seed: number) => fract(Math.sin(seed * 12.9898 + 78.233) * 43758.5453);

type Star = { x: number; y: number; offset: number; speed: number };
type Rect = { top: number; left: number; right: number; bottom: number };
type Box = { width: number; height: number; avoid: Rect | null };

const generateStars = ({ width, height, avoid }: Box): Star[] => {
  const target = Math.max(12, Math.round((width * height) / STAR_DENSITY));
  const stars: Star[] = [];
  const cells = new Set<string>();
  for (let attempt = 1; attempt <= target * 20 && stars.length < target; attempt++) {
    const x = Math.floor(hash(width + attempt * 1.93) * width);
    const y = Math.floor(hash(height + attempt * 4.67) * height);
    // Snap candidates to a coarse grid so stars never clump together.
    const cell = `${Math.round(x / 28)}:${Math.round(y / 28)}`;
    const avoided =
      avoid !== null && x >= avoid.left && x <= avoid.right && y >= avoid.top && y <= avoid.bottom;
    if (avoided || cells.has(cell)) {
      continue;
    }
    cells.add(cell);
    stars.push({
      x,
      y,
      offset: Math.floor(hash(attempt * 7.17) * (FRAMES.length * 3)),
      speed: 1 + Math.floor(hash(attempt * 9.91) * 3),
    });
  }
  return stars;
};

/**
 * Subtle animated field of ., + and * characters, ported from glance's
 * welcome screen. Fills its nearest positioned ancestor and leaves a hole
 * around `avoidRef` so text placed there stays readable.
 */
export const StarField = ({ avoidRef }: { avoidRef?: RefObject<HTMLElement | null> }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const measure = () => {
      const rect = container.getBoundingClientRect();
      const avoidRect = avoidRef?.current?.getBoundingClientRect();
      const next: Box = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        avoid: avoidRect
          ? {
              top: Math.round(avoidRect.top - rect.top - AVOID_PADDING),
              left: Math.round(avoidRect.left - rect.left - AVOID_PADDING),
              right: Math.round(avoidRect.right - rect.left + AVOID_PADDING),
              bottom: Math.round(avoidRect.bottom - rect.top + AVOID_PADDING),
            }
          : null,
      };
      setBox((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (avoidRef?.current) {
      observer.observe(avoidRef.current);
    }
    return () => observer.disconnect();
  }, [avoidRef]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = window.setInterval(() => setTick((value) => value + 1), FRAME_MS);
    return () => window.clearInterval(timer);
  }, []);

  const stars = useMemo(() => (box ? generateStars(box) : []), [box]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden font-mono text-xs select-none"
    >
      {stars.map((star, index) => {
        const frame = FRAMES[Math.floor((tick + star.offset) / star.speed) % FRAMES.length];
        return (
          <span
            key={index}
            className={cn("absolute", frame.className)}
            style={{ left: star.x, top: star.y }}
          >
            {frame.char}
          </span>
        );
      })}
    </div>
  );
};
