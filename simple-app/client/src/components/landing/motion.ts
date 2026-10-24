/**
 * Entrance choreography for the public site.
 *
 * Unchanged from the system already in use: content rises 14px over 450ms on a
 * gentle ease out, children 70ms apart, fired once at 20 percent visibility and
 * never again on scroll back. Only transform and opacity animate, so every
 * entrance stays on the compositor.
 *
 * Reduced motion is honoured twice: call sites spread an empty object instead
 * of these presets, and a global rule in index.css neutralises what is left.
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const ENTER = { duration: 0.45, ease: EASE_OUT } as const;

/** Once only. amount 0.2 fires when a fifth of the block is on screen. */
export const VIEWPORT = { once: true, amount: 0.2 } as const;

/** Scroll-triggered entrance. Order within a section is set by the delay. */
export const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT,
  transition: { ...ENTER, delay },
});

/** Entrance for content already in view on load, so it runs on mount. */
export const riseOnMount = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { ...ENTER, delay },
});

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: ENTER },
};
