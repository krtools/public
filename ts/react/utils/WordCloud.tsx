import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WordInput {
  text: string;
  /** Relative importance — raw frequency, score, etc. Scale doesn't matter. */
  weight: number;
}

export interface WordCloudOptions {
  /**
   * Min/max font size in px. Defaults to [12, 64].
   * Weight-to-size mapping is linear across this range.
   */
  fontSizeRange?: [number, number];
  /**
   * Padding (px) around each word bounding box before collision checks.
   * Larger values = more breathing room between words.
   */
  padding?: number;
  /**
   * Spiral step — lower = tighter packing, higher = faster (less dense).
   * Good range: 0.05–0.15. Defaults to 0.08.
   */
  spiralStep?: number;
  /** Color palette. Cycles through words in placement order. */
  colors?: string[];
  /**
   * Opacity range [min, max] mapped from lowest → highest weight word.
   * Defaults to [0.5, 1.0].
   */
  opacityRange?: [number, number];
}

export interface PlacedWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: 400 | 500 | 700;
  color: string;
  opacity: number;
  /** Normalised weight [0, 1] — useful for custom styling. */
  t: number;
}

// ─── Layout function ──────────────────────────────────────────────────────────

const DEFAULT_COLORS_LIGHT = [
  "#534AB7", "#D85A30", "#0F6E56", "#993556",
  "#185FA5", "#854F0B", "#3B6D11", "#A32D2D",
];

const DEFAULT_COLORS_DARK = [
  "#AFA9EC", "#F0997B", "#5DCAA5", "#ED93B1",
  "#85B7EB", "#FAC775", "#C0DD97", "#F09595",
];

/**
 * Computes word positions using an Archimedean spiral with AABB collision
 * detection. Words are sorted by weight descending so the most important
 * ones always land closest to the centre. Returns only the words that
 * could be placed — if the canvas is too small some may be dropped.
 *
 * Text measurement requires a CanvasRenderingContext2D. Pass one in from
 * an offscreen canvas, or let the WordCloud component handle it for you.
 */
export function computeWordCloudLayout(
  words: WordInput[],
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  options: WordCloudOptions = {}
): PlacedWord[] {
  const {
    fontSizeRange = [12, 64],
    padding = 6,
    spiralStep = 0.08,
    colors = DEFAULT_COLORS_LIGHT,
    opacityRange = [0.5, 1.0],
  } = options;

  const [minFont, maxFont] = fontSizeRange;
  const [minOpacity, maxOpacity] = opacityRange;
  const cx = width / 2;
  const cy = height / 2;

  const sorted = [...words].sort((a, b) => b.weight - a.weight);
  const maxW = sorted[0]?.weight ?? 1;
  const minW = sorted[sorted.length - 1]?.weight ?? 0;
  const weightRange = maxW - minW || 1;

  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const result: PlacedWord[] = [];

  sorted.forEach((word, i) => {
    const t = (word.weight - minW) / weightRange;

    const fontSize = Math.round(minFont + t * (maxFont - minFont));
    const fontWeight: 400 | 500 | 700 = t > 0.72 ? 700 : t > 0.38 ? 500 : 400;

    ctx.font = `${fontWeight} ${fontSize}px sans-serif`;
    const measured = ctx.measureText(word.text);
    const tw = measured.width;
    const th = fontSize * 1.2; // approximate cap height

    const boxW = tw + padding * 2;
    const boxH = th + padding * 2;

    // Archimedean spiral: r = a·θ, with slight y-compression for elliptical feel
    let foundPos: { x: number; y: number } | null = null;

    for (let angle = 0; angle < 200 * Math.PI; angle += spiralStep) {
      const r = 3.5 * angle;
      const x = cx + r * Math.cos(angle) - tw / 2;
      const y = cy + r * Math.sin(angle * 0.85) - th / 2;

      // Keep within canvas bounds (with a small edge margin)
      if (x < 4 || x + tw > width - 4 || y < 4 || y + th > height - 4) continue;

      const bx = x - padding;
      const by = y - padding;

      const collides = placed.some(
        (p) =>
          bx < p.x + p.w &&
          bx + boxW > p.x &&
          by < p.y + p.h &&
          by + boxH > p.y
      );

      if (!collides) {
        foundPos = { x, y };
        placed.push({ x: bx, y: by, w: boxW, h: boxH });
        break;
      }
    }

    if (!foundPos) return; // couldn't place this word — skip it

    result.push({
      text: word.text,
      x: foundPos.x,
      y: foundPos.y,
      width: tw,
      height: th,
      fontSize,
      fontWeight,
      color: colors[i % colors.length],
      opacity: minOpacity + t * (maxOpacity - minOpacity),
      t,
    });
  });

  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface WordCloudProps {
  words: WordInput[];
  width?: number;
  height?: number;
  options?: WordCloudOptions;
  /** Called when a word is hovered, or null on mouse-leave. */
  onWordHover?: (word: PlacedWord | null) => void;
  /** Called when a word is clicked. */
  onWordClick?: (word: PlacedWord) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function WordCloud({
  words,
  width,
  height = 480,
  options,
  onWordHover,
  onWordClick,
  className,
  style,
}: WordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));
  const [containerWidth, setContainerWidth] = useState(width ?? 0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [placed, setPlaced] = useState<PlacedWord[]>([]);

  // Detect dark mode — re-run layout if it changes so colours swap
  const prefersDark = useMemo(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    []
  );

  // Observe container width when no explicit width is passed
  useEffect(() => {
    if (width) { setContainerWidth(width); return; }
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [width]);

  // Derive merged options with dark-mode colour swap
  const resolvedOptions = useMemo<WordCloudOptions>(() => ({
    colors: prefersDark ? DEFAULT_COLORS_DARK : DEFAULT_COLORS_LIGHT,
    ...options,
  }), [options, prefersDark]);

  // Re-run layout whenever words, dimensions, or options change
  useEffect(() => {
    if (!containerWidth) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const result = computeWordCloudLayout(
      words,
      containerWidth,
      height,
      ctx,
      resolvedOptions
    );
    setPlaced(result);
    setHoveredIndex(null);
  }, [words, containerWidth, height, resolvedOptions]);

  const handleMouseEnter = useCallback((word: PlacedWord, index: number) => {
    setHoveredIndex(index);
    onWordHover?.(word);
  }, [onWordHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    onWordHover?.(null);
  }, [onWordHover]);

  const isAnyHovered = hoveredIndex !== null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: width ? `${width}px` : "100%",
        height: `${height}px`,
        overflow: "hidden",
        ...style,
      }}
    >
      {placed.map((word, i) => {
        const dimmed = isAnyHovered && i !== hoveredIndex;
        const highlighted = i === hoveredIndex;

        return (
          <span
            key={`${word.text}-${i}`}
            onMouseEnter={() => handleMouseEnter(word, i)}
            onMouseLeave={handleMouseLeave}
            onClick={() => onWordClick?.(word)}
            style={{
              position: "absolute",
              left: word.x,
              top: word.y,
              fontSize: word.fontSize,
              fontWeight: word.fontWeight,
              color: word.color,
              lineHeight: 1,
              whiteSpace: "nowrap",
              cursor: onWordClick ? "pointer" : "default",
              userSelect: "none",
              opacity: dimmed ? 0.07 : word.opacity,
              transform: highlighted ? "scale(1.12)" : "scale(1)",
              transformOrigin: "center center",
              transition: "opacity 0.2s ease, transform 0.18s ease",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}
