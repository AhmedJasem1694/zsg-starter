/**
 * Zane brand assets - symbol + wordmark
 *
 * Symbol: Refined split-path routing icon.
 *   Three horizontal paths enter from the left.
 *   The top path routes DOWN and exits at the bottom-right position.
 *   The middle path routes UP and crosses the top path, exiting at the top-right.
 *   The bottom path holds steady, producing the "base rail".
 *   Together they form the escalation / routing / split-decision motif.
 *
 * Wordmark: "ZANE" rendered in Syncopate 700 - geometric, no crossbar on A,
 *   clean authority. For pixel-perfect brand use, replace with Söhne.
 */

interface SymbolProps {
  className?: string;
  color?: string;
}

/** The routing/split-path symbol only - use in tight spaces, favicons, app icons. */
export function ZaneSymbol({ className = "w-8 h-6", color = "#4A6CF7" }: SymbolProps) {
  return (
    <svg
      viewBox="0 0 56 38"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Path 1 - enters top-left, routes DOWN, exits bottom-right */}
      <path
        d="M2 6 L18 6 C26 6 30 19 38 19 C44 19 48 32 54 32"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Path 2 - enters middle-left, routes UP, crosses Path 1, exits top-right */}
      <path
        d="M2 19 L18 19 C26 19 30 6 38 6 L54 6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Path 3 - bottom rail, holds position */}
      <path
        d="M2 32 L18 32 L54 32"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

interface LogoProps {
  /** "full" = symbol + wordmark side-by-side (default)
   *  "stacked" = symbol above wordmark
   *  "symbol" = symbol only
   *  "wordmark" = text only */
  variant?: "full" | "stacked" | "symbol" | "wordmark";
  size?: "sm" | "md" | "lg";
  /** Light version for use on dark backgrounds */
  light?: boolean;
  className?: string;
}

const SYMBOL_SIZES = {
  sm: "w-7 h-[21px]",
  md: "w-9 h-[27px]",
  lg: "w-12 h-9",
};

const WORDMARK_SIZES = {
  sm: "text-[13px] tracking-[0.22em]",
  md: "text-[16px] tracking-[0.25em]",
  lg: "text-[22px] tracking-[0.28em]",
};

export function ZaneLogo({
  variant = "full",
  size = "sm",
  light = true,
  className = "",
}: LogoProps) {
  const symbolColor = "#4A6CF7";
  const wordmarkColor = light ? "#E6E8EB" : "#0B1118";
  const taglineColor = light ? "rgba(230,232,235,0.38)" : "rgba(11,17,24,0.45)";

  const symbol = (
    <ZaneSymbol className={SYMBOL_SIZES[size]} color={symbolColor} />
  );

  const wordmark = (
    <span
      style={{
        fontFamily: "'Syncopate', sans-serif",
        fontWeight: 700,
        letterSpacing: "0.25em",
        color: wordmarkColor,
        lineHeight: 1,
      }}
      className={WORDMARK_SIZES[size]}
    >
      ZANE
    </span>
  );

  const tagline = (
    <span
      style={{
        fontFamily: "'Inter', sans-serif",
        fontWeight: 500,
        fontSize: "7px",
        letterSpacing: "0.18em",
        color: taglineColor,
        textTransform: "uppercase",
        lineHeight: 1,
        display: "block",
        marginTop: "3px",
      }}
    >
      Legal Intelligence
    </span>
  );

  if (variant === "symbol") return symbol;
  if (variant === "wordmark") return <div className={className}>{wordmark}</div>;

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {symbol}
        {wordmark}
      </div>
    );
  }

  // "full" - horizontal lockup
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {symbol}
      <div>
        {wordmark}
        {tagline}
      </div>
    </div>
  );
}
