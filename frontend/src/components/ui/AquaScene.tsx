'use client';
import React from 'react';

// Decorative, non-interactive background — trees swaying, petals falling,
// clouds drifting. Mounted once in the app shell (Layout.tsx) so it sits
// behind every tab instead of being rebuilt per-screen. Hidden in dark mode
// and under prefers-reduced-motion via CSS (see .aqua-scene/.aqua-tree/etc.
// in globals.css) — this component just supplies the markup.
export const AquaScene: React.FC = () => (
  <div className="aqua-scene fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <svg className="aqua-cloud" style={{ top: '6%', width: 120, animationDuration: '38s' }} viewBox="0 0 100 40">
      <ellipse cx="30" cy="25" rx="28" ry="14" fill="#fff" />
      <ellipse cx="60" cy="18" rx="22" ry="16" fill="#fff" />
      <ellipse cx="80" cy="26" rx="18" ry="11" fill="#fff" />
    </svg>
    <svg className="aqua-cloud" style={{ top: '14%', width: 90, animationDuration: '52s', animationDelay: '-10s' }} viewBox="0 0 100 40">
      <ellipse cx="30" cy="25" rx="28" ry="14" fill="#fff" />
      <ellipse cx="60" cy="18" rx="22" ry="16" fill="#fff" />
    </svg>

    <svg className="aqua-tree" style={{ left: -30, width: 170, animationDuration: '7s' }} viewBox="0 0 100 160">
      <rect x="45" y="120" width="10" height="40" fill="#8A5A3C" />
      <ellipse cx="50" cy="100" rx="42" ry="46" fill="#2FAE84" />
      <ellipse cx="30" cy="80" rx="26" ry="30" fill="#37C093" />
      <ellipse cx="70" cy="85" rx="24" ry="28" fill="#289873" />
    </svg>
    <svg className="aqua-tree" style={{ left: 80, width: 110, animationDuration: '5.5s', animationDelay: '.4s', opacity: 0.7 }} viewBox="0 0 100 160">
      <rect x="45" y="130" width="9" height="30" fill="#8A5A3C" />
      <polygon points="50,20 78,110 22,110" fill="#289873" />
      <polygon points="50,50 72,120 28,120" fill="#2FAE84" />
    </svg>
    <svg className="aqua-tree" style={{ right: -30, width: 190, animationDuration: '6.5s', animationDelay: '.2s' }} viewBox="0 0 100 160">
      <rect x="45" y="120" width="10" height="40" fill="#8A5A3C" />
      <ellipse cx="50" cy="100" rx="44" ry="48" fill="#37C093" />
      <ellipse cx="72" cy="82" rx="24" ry="28" fill="#2FAE84" />
      <ellipse cx="30" cy="88" rx="22" ry="26" fill="#289873" />
    </svg>
    <svg className="aqua-tree" style={{ right: 100, width: 120, animationDuration: '5s', animationDelay: '.6s', opacity: 0.7 }} viewBox="0 0 100 160">
      <rect x="45" y="130" width="9" height="30" fill="#8A5A3C" />
      <polygon points="50,20 78,110 22,110" fill="#2FAE84" />
      <polygon points="50,50 72,120 28,120" fill="#289873" />
    </svg>

    {[
      { left: '8%', width: 22, drift: 60, duration: '11s', delay: '0s', petals: '#FF9FC6', center: '#FFD36E' },
      { left: '22%', width: 16, drift: -40, duration: '9s', delay: '-3s', petals: '#FFD36E', center: '#FF9FC6' },
      { left: '38%', width: 18, drift: 50, duration: '13s', delay: '-6s', petals: '#7FB8FF', center: '#fff' },
      { left: '55%', width: 20, drift: -55, duration: '10s', delay: '-1s', petals: '#FF9FC6', center: '#FFD36E' },
      { left: '70%', width: 15, drift: 35, duration: '12s', delay: '-8s', petals: '#FFD36E', center: '#FF9FC6' },
      { left: '85%', width: 19, drift: -45, duration: '9.5s', delay: '-4.5s', petals: '#7FB8FF', center: '#fff' },
    ].map((p, i) => (
      <svg
        key={i}
        className="aqua-petal"
        style={{ left: p.left, width: p.width, ['--drift' as string]: `${p.drift}px`, animationDuration: p.duration, animationDelay: p.delay }}
        viewBox="0 0 40 40"
      >
        <g fill={p.petals}>
          <circle cx="20" cy="10" r="8" />
          <circle cx="20" cy="30" r="8" />
          <circle cx="10" cy="20" r="8" />
          <circle cx="30" cy="20" r="8" />
        </g>
        <circle cx="20" cy="20" r="6" fill={p.center} />
      </svg>
    ))}
  </div>
);
