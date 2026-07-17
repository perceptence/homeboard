"use client";

/**
 * An illustrated avatar — a drawn portrait, not a photograph.
 *
 * Built as a BUST, not a floating head: tinted backdrop, shoulders, then the head
 * inside it. That's what makes it legible at 20px — the backdrop gives the
 * silhouette something to sit against. A skin-coloured disc with features on it
 * just reads as a blob at small sizes.
 *
 * Inline SVG, generated deterministically from the member's id: the same person
 * always gets the same face, forever. Nothing is fetched — no network, no CDN, no
 * CSP problem — and it works for a household that hasn't uploaded a single photo,
 * which is every household on day one.
 *
 * The eyes blink, each person on their own beat.
 */

/* FNV-1a — better avalanche than the naive *31 hash, so ids that differ by one
   character don't land on neighbouring traits. */
function seedOf(id: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
/** Pull an independent trait out of the hash — each gets its own bits. */
const pick = <T,>(arr: readonly T[], h: number, shift: number) =>
  arr[(h >>> shift) % arr.length];

/**
 * Six quiet tints, one per hue. NONE of them is `lemon` (#F4FF7A).
 *
 * It used to be in slot 1, and Ada's hash landed on it — so her face wore the
 * brand's ACTION colour, the same yellow as every CTA, the "Best fit" badge and
 * the lemon hero card. An identity can't borrow the accent: the eye reads lemon
 * as "do this", and it started reading a seven-year-old's head that way.
 *
 * The slot keeps a yellow so the palette still spans the wheel — just a butter
 * that could never be mistaken for a button.
 */
const BACKDROP = ["#C9C8F0", "#EFE3A6", "#BFE3D0", "#F7CFD8", "#CFE3F7", "#F6DCC0"] as const;
const SKIN     = ["#F8D5B8", "#EFC09B", "#D8A170", "#B87A4C", "#8D5524", "#6A3D1E"] as const;
const HAIR     = ["#241F20", "#4A2F1B", "#8C4A25", "#C9822F", "#6E5A8F", "#2F4C7A", "#E0C078"] as const;
const CLOTHES  = ["#2F3140", "#4A5B7C", "#7C4A5B", "#3F6B58", "#8C5E3C", "#5B4A7C"] as const;

export function Face({ id, size = 32 }: { id: string; size?: number }) {
  const h = seedOf(id);
  const bg     = pick(BACKDROP, h, 0);
  const skin   = pick(SKIN,     h, 5);
  const hair   = pick(HAIR,     h, 11);
  const shirt  = pick(CLOTHES,  h, 17);
  const style  = (h >>> 23) % 5;          // hair silhouette
  const brows  = (h >>> 27) % 2;          // a little face-to-face variety
  const blink  = ((h >>> 3) % 5) + 3;     // own blink beat, 3–7s
  const clip   = `fc${id.replace(/\W/g, "")}`;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="20" cy="20" r="20" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <circle cx="20" cy="20" r="20" fill={bg} />

        {/* Shoulders — clipped by the circle, so the bust is cropped like a real
            portrait rather than floating. */}
        <path d="M20 30c-7.5 0-13 4.5-14.5 11.5h29C33 34.5 27.5 30 20 30z" fill={shirt} />
        {/* Neck, tucked behind the shoulders. */}
        <path d="M17 25.5h6v5.5a3 3 0 0 1-6 0z" fill={skin} />

        {/* Hair BEHIND the head. This is what gives each style its outline: the head
            ellipse tops out at y≈9.8, so anything drawn above that is VOLUME. Hair
            that merely traces the skull reads as a swim cap. */}
        {style === 1 && /* long, falling past the jaw */ (
          <path d="M8.6 20c0-8.4 5-13 11.4-13s11.4 4.6 11.4 13v8c0 1.8-2.2 2.4-2.2.4V19H10.8v9.4c0 2-2.2 1.4-2.2-.4z" fill={hair} />
        )}
        {style === 3 && /* big round bob */ (
          <ellipse cx="20" cy="17.5" rx="11.8" ry="11.2" fill={hair} />
        )}
        {style === 4 && /* buns */ (
          <>
            <ellipse cx="20" cy="17" rx="10.8" ry="10.4" fill={hair} />
            <circle cx="9" cy="13.6" r="3.6" fill={hair} />
            <circle cx="31" cy="13.6" r="3.6" fill={hair} />
          </>
        )}

        {/* Head. */}
        <ellipse cx="20" cy="19" rx="8.6" ry="9.2" fill={skin} />
        {/* Ears. */}
        <circle cx="11.4" cy="19.5" r="1.7" fill={skin} />
        <circle cx="28.6" cy="19.5" r="1.7" fill={skin} />

        {/* Hair ON the head — a solid CAP, not an arc.
            The outer edge rises to y≈6.5 (the skull tops out at 9.8, so that's real
            volume) and the hairline comes back across at y≈13, well above the brows
            at 16.2. A thin crescent between those two reads as a headband, which is
            exactly what the first pass looked like. */}
        {style === 0 && /* short crop, flat fringe */ (
          <path d="M11.2 19C10.4 10 14 6.4 20 6.4S29.6 10 28.8 19c-.6-4.4-1.4-5.8-8.8-5.8s-8.2 1.4-8.8 5.8z" fill={hair} />
        )}
        {style === 1 && /* centre part */ (
          <path d="M11.2 19C10.4 10 14 6.4 20 6.4S29.6 10 28.8 19c-.5-4.6-2-6.6-5-7.4-1.4 1.8-2.4 2.6-3.8 2.6s-2.4-.8-3.8-2.6c-3 .8-4.5 2.8-5 7.4z" fill={hair} />
        )}
        {style === 2 && /* swept across, one side heavier */ (
          <path d="M11.2 19C10.4 10 14 6.4 20 6.4c5.4 0 8.6 3 8.8 8.6-2.6-3-5-4-8.6-4-3.4 0-5.6 1.6-6.6 4-.7 1.7-.6 3.4-2.4 4z" fill={hair} />
        )}
        {style === 3 && /* bob fringe */ (
          <path d="M11.2 19C10.4 10 14 6.4 20 6.4S29.6 10 28.8 19c-1-5.2-3.2-7.2-8.8-7.2s-7.8 2-8.8 7.2z" fill={hair} />
        )}
        {style === 4 && /* soft rounded fringe */ (
          <path d="M11.2 19C10.4 10 14 6.4 20 6.4S29.6 10 28.8 19c-1.2-4-2.8-5.8-5.4-5.8-1.7 0-2.4.8-4.2.8-2 0-3.4-.5-4.8 1-1 1-1.6 2.4-2.2 4z" fill={hair} />
        )}

        {/* Brows — small, but they're most of the personality. */}
        {brows === 0 && (
          <g stroke="#3A2E2A" strokeWidth="1" strokeLinecap="round" opacity=".7">
            <path d="M15.4 16.2q1.8-.9 3.2 0" />
            <path d="M21.4 16.2q1.8-.9 3.2 0" />
          </g>
        )}

        {/* Eyes. The blink is ONE animation per eye: `ry` collapses to a slit and
            back. keyTimes hold the eye open for ~97% of the cycle, so the blink is
            a flick rather than a pulse — and each face gets its own cycle length,
            so a row of avatars never blinks in unison. */}
        <g fill="#2B2523">
          {[16.6, 23.4].map((cx) => (
            <ellipse key={cx} cx={cx} cy="19.4" rx="1.25" ry="1.6">
              <animate
                attributeName="ry"
                values="1.6; 1.6; 0.1; 1.6"
                keyTimes="0; 0.94; 0.97; 1"
                dur={`${blink}s`}
                repeatCount="indefinite"
              />
            </ellipse>
          ))}
        </g>

        {/* A small, unhurried smile. */}
        <path d="M17 23.4q3 2.2 6 0" stroke="#8C5A46" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
