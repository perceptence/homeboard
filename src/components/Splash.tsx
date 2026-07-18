"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The splash — one breath of brand, then out of the way.
 *
 * It exists because the store rehydrates AFTER React mounts (see page.tsx):
 * for a beat the app shows seed data before yesterday's household lands, and a
 * flash of the wrong family is worse than 1.2 seconds of logo. The splash covers
 * exactly that beat, doing brand work with time we had to spend anyway.
 *
 * It renders INSIDE the device frame — `absolute` over the screen, not `fixed`
 * over the browser. This is what a person sees when they launch the app on
 * their phone; painting the whole demo page with it said "website loading",
 * not "app opening". The frame's rounded corners clip it, as the glass would.
 *
 * The mark is the app icon's grid, drawn live — one lemon cell, one lavender,
 * so the icon on your home screen and the first frame of the app are the same
 * object at two sizes.
 */
export function Splash() {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGone(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
          className="absolute inset-0 z-[300] grid place-items-center bg-ink"
          aria-hidden
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }}
              className="grid grid-cols-2 gap-[7px]"
            >
              <span className="h-[30px] w-[30px] rounded-[10px] bg-lemon" />
              <span className="h-[30px] w-[30px] rounded-[10px] bg-white/25" />
              <span className="h-[30px] w-[30px] rounded-[10px] bg-white/25" />
              <span className="h-[30px] w-[30px] rounded-[10px] bg-lavender/90" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.25, duration: 0.4 } }}
              className="font-tight text-[22px] text-white"
            >
              Homeboard
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
