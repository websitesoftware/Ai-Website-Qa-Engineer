'use client';
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ResultLaunchAnimationProps {
  passed: boolean;
  label: string;
}

// Cloud puffs clustered around the flight path — staggered in so they read as
// a "burst" the rocket emerges from and eventually settles into.
const CLOUD_PUFFS = [
  { emoji: '☁️', x: -70, y: 10, size: 34, delay: 0 },
  { emoji: '☁️', x: -20, y: -8, size: 44, delay: 0.05 },
  { emoji: '☁️', x: 35, y: 6, size: 38, delay: 0.1 },
  { emoji: '☁️', x: 80, y: -6, size: 30, delay: 0.15 },
  { emoji: '💨', x: -45, y: -22, size: 26, delay: 0.2 },
  { emoji: '💨', x: 55, y: -20, size: 24, delay: 0.28 },
];

const VISIBLE_MS = 5000;

export const ResultLaunchAnimation: React.FC<ResultLaunchAnimationProps> = ({ passed, label }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const t = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(t);
  }, [passed, label]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl mb-4"
        >
          <div className="relative h-32 flex items-center justify-center overflow-hidden">
            {/* Cloud cluster — puffs in, then settles and stays as the backdrop */}
            {CLOUD_PUFFS.map((c, i) => (
              <motion.span
                key={i}
                className="absolute select-none"
                style={{ fontSize: c.size, left: `calc(50% + ${c.x}px)`, top: `calc(50% + ${c.y}px)` }}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: 0.9, scale: 1 }}
                transition={{ delay: c.delay, duration: 0.4, ease: 'easeOut' }}
              >
                {c.emoji}
              </motion.span>
            ))}

            {/* Rocket — flies in through the cloud cluster, then exits up and away */}
            <motion.span
              className="absolute select-none text-4xl"
              style={{ left: '50%', top: '50%' }}
              initial={{ x: 120, y: 140, opacity: 0, rotate: -45 }}
              animate={{
                x: [120, 0, -140],
                y: [140, 0, -160],
                opacity: [0, 1, 0],
                rotate: [-45, -45, -45],
              }}
              transition={{ duration: 1.1, times: [0, 0.4, 1], ease: 'easeInOut' }}
            >
              🚀
            </motion.span>

            {/* Result label — settles on top of the clouds once the rocket is gone */}
            <motion.div
              className={`relative z-10 font-extrabold tracking-wide text-2xl ${
                passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
              }`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.85, duration: 0.35, ease: 'backOut' }}
            >
              {label}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
