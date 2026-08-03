'use client';
import React from 'react';

const STARS = [
  { top: '4%', left: '12%', size: 2, delay: '.2s', duration: '2.4s' },
  { top: '9%', left: '28%', size: 1.5, delay: '1.1s', duration: '3s' },
  { top: '3%', left: '44%', size: 2.5, delay: '.6s', duration: '2.8s' },
  { top: '14%', left: '58%', size: 1.5, delay: '1.6s', duration: '3.4s' },
  { top: '6%', left: '68%', size: 2, delay: '.4s', duration: '2.6s' },
  { top: '20%', left: '8%', size: 1.5, delay: '2s', duration: '3.2s' },
  { top: '24%', left: '36%', size: 2, delay: '.9s', duration: '2.9s' },
  { top: '18%', left: '82%', size: 2.5, delay: '1.4s', duration: '3.1s' },
  { top: '30%', left: '20%', size: 1.5, delay: '.3s', duration: '2.5s' },
  { top: '34%', left: '50%', size: 2, delay: '1.8s', duration: '3.3s' },
  { top: '28%', left: '90%', size: 1.5, delay: '.7s', duration: '2.7s' },
  { top: '40%', left: '6%', size: 2, delay: '1.2s', duration: '3s' },
  { top: '45%', left: '64%', size: 1.5, delay: '.5s', duration: '2.6s' },
  { top: '50%', left: '30%', size: 2.5, delay: '1.7s', duration: '3.4s' },
  { top: '55%', left: '78%', size: 1.5, delay: '.8s', duration: '2.8s' },
  { top: '60%', left: '14%', size: 2, delay: '1.3s', duration: '3.1s' },
  { top: '11%', left: '92%', size: 1.5, delay: '1.9s', duration: '2.9s' },
  { top: '16%', left: '2%', size: 2, delay: '.1s', duration: '3.2s' },
];

const SPARKLES = [
  { top: '18%', left: '6%', delay: '0s' },
  { top: '30%', left: '92%', delay: '.6s' },
  { top: '55%', left: '8%', delay: '1.2s' },
  { top: '8%', left: '85%', delay: '1.8s' },
  { top: '4%', left: '48%', delay: '2.4s' },
];

// Dark-mode counterpart to AquaScene — night sky with a glowing moon,
// twinkling stars, sparkles, drifting clouds and a shooting star. Hidden
// in light mode via .night-scene in globals.css, so it can be mounted
// unconditionally alongside AquaScene.
export const NightScene: React.FC = () => (
  <div className="night-scene fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div className="night-moon" style={{ top: -70, right: 120, width: 190, height: 190 }} />

    {STARS.map((s, i) => (
      <div
        key={i}
        className="night-star"
        style={{ top: s.top, left: s.left, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.duration }}
      />
    ))}

    {SPARKLES.map((sp, i) => (
      <div key={i} className="night-sparkle" style={{ top: sp.top, left: sp.left, width: 14, height: 14, animationDelay: sp.delay }}>
        <svg viewBox="0 0 24 24" width="100%" height="100%">
          <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="#9fd8ff" />
        </svg>
      </div>
    ))}

    <div className="night-cloud" style={{ top: '9%', left: '40%', width: 170, height: 34, animationDuration: '70s' }} />
    <div className="night-cloud" style={{ top: '15%', left: '55%', width: 120, height: 26, animationDuration: '90s' }} />

    <div className="night-shoot" style={{ top: '8%', right: '15%' }} />
  </div>
);
