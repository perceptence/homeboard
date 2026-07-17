"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * What is actually behind this element — light or dark?
 *
 * Glass over a SCROLLING list has no fixed backdrop: the nav sits over ink at
 * the top of the feed and over a white card a moment later. A single text colour
 * cannot survive that, and darkening the glass until white always works throws
 * away the material to dodge the problem.
 *
 * So: read the backdrop and invert. This is what iOS does when the status bar
 * flips from light to dark content over a scrolling page — the panel keeps its
 * translucency and its CONTENTS adapt.
 *
 * It samples a GRID rather than one point, because the nav is wider than the 8px
 * gap between cards: a single centre probe that landed in a gap would read "ink"
 * while the other 95% of the nav sat on white, and the labels would flicker
 * between colours as you scrolled.
 */

/** Relative luminance (WCAG). */
const lum = (r: number, g: number, b: number) => {
  const f = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
};

/** The nearest ancestor that actually PAINTS. `background: transparent` is the
 *  default, so the element under the cursor usually isn't the one you can see. */
function paintedLuminance(el: Element | null): number | null {
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    const c = getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
    if (c) {
      const a = c.length > 3 ? Number(c[3]) : 1;
      if (a > 0.5) return lum(Number(c[0]), Number(c[1]), Number(c[2]));
    }
    node = node.parentElement;
  }
  return null;
}

export type Tone = "light" | "dark";

export function useBackdropTone(ref: RefObject<HTMLElement | null>, deps: unknown[] = []): Tone {
  const [tone, setTone] = useState<Tone>("dark");

  useEffect(() => {
    let raf = 0;

    const sample = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;

      let sum = 0;
      let n = 0;
      // Inset from the edges so we read what's UNDER the nav, not beside it.
      for (const fx of [0.15, 0.5, 0.85]) {
        for (const fy of [0.2, 0.5, 0.8]) {
          const x = r.left + r.width * fx;
          const y = r.top + r.height * fy;
          // Paint order, topmost first. Skip the nav and everything inside it —
          // otherwise we'd just measure our own glass.
          const behind = document.elementsFromPoint(x, y).find((e) => !el.contains(e));
          const l = paintedLuminance(behind ?? null);
          if (l !== null) {
            sum += l;
            n++;
          }
        }
      }
      if (!n) return;
      // 0.5 is the perceptual midpoint, and there's no hysteresis on purpose:
      // the transition is a 300ms colour tween, so a backdrop hovering at the
      // threshold cross-fades rather than strobing.
      setTone(sum / n > 0.5 ? "light" : "dark");
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sample);
    };

    sample();
    // Capture: the feed scrolls in a nested container, and scroll doesn't bubble.
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps]);

  return tone;
}
