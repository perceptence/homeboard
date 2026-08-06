/**
 * jsdom is missing a handful of browser APIs the app legitimately uses. These
 * are stubs so components can mount — not behaviour under test.
 */
import { vi } from "vitest";

/** DeviceFrame's container-fitting path watches its host with one of these. */
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/** useBackdropTone samples the page behind the floating nav. */
if (!("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }),
  });
}

if (!("scrollTo" in window)) {
  Object.defineProperty(window, "scrollTo", { writable: true, value: vi.fn() });
}

/** PhoneShell parks the Ahead list by calling scrollTo on the SCROLLER ELEMENT,
 *  not on window. jsdom implements neither. */
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {} as typeof Element.prototype.scrollTo;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

/** Speech recognition — the dictation hook feature-detects it, so absence is fine. */
