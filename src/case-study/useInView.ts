"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Is this element near the viewport?
 *
 * This page mounts real applications — the embed runs one shell, the
 * two-surface section runs two more, and each carries store subscriptions, a
 * 1s clock, a frame that re-fits on resize, and a hero above them all painting
 * dozens of independently-animating SVG portraits. Mounting the lot at once put
 * three live copies of the product on one document and the browser stopped
 * compositing: correct DOM, correct geometry, blank paint, then an unresponsive
 * renderer.
 *
 * So sections take turns. `rootMargin` starts the work a screen early, so
 * anything you scroll to has already booted by the time you read it.
 *
 * `once` is the interesting knob. Content that holds reader state (an app you
 * may have tapped around in) should stay mounted once seen — throwing that away
 * is user-hostile. Content that is purely decorative, or that re-derives itself
 * deterministically on mount, is safe to unmount when it's far away, and that
 * is what keeps the number of simultaneously-live applications to one or two.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { rootMargin = "600px", once = true }: { rootMargin?: string; once?: boolean } = {},
) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (jsdom, ancient browsers) — mount immediately
    // rather than never. Failing closed here would leave the page empty.
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        setInView((was) => (once ? was || hit : hit));
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, once]);

  return inView;
}
