// 'use client';
// import React, { useEffect, useState } from 'react';

// interface ScoreGaugeProps {
//   score: number | null;
//   size?: number;
//   strokeWidth?: number;
//   label?: string;
// }

// function colorForScore(score: number) {
//   if (score >= 90) return '#10b981'; // emerald
//   if (score >= 70) return '#6366F1'; // indigo
//   if (score >= 50) return '#f59e0b'; // amber
//   return '#ef4444'; // red
// }

// export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, size = 120, strokeWidth = 10, label }) => {
//   const [animatedScore, setAnimatedScore] = useState(0);
//   const radius = (size - strokeWidth) / 2;
//   const circumference = 2 * Math.PI * radius;

//   useEffect(() => {
//     if (score === null) return;
//     const t = setTimeout(() => setAnimatedScore(score), 100);
//     return () => clearTimeout(t);
//   }, [score]);

//   const offset = circumference - (animatedScore / 100) * circumference;
//   const color = colorForScore(score ?? 0);

//   return (
//     <div className="relative inline-flex flex-col items-center justify-center" style={{ width: size, height: size }}>
//       <svg width={size} height={size} className="-rotate-90">
//         <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
//         <circle
//           cx={size / 2}
//           cy={size / 2}
//           r={radius}
//           fill="none"
//           stroke={score === null ? '#e2e8f0' : color}
//           strokeWidth={strokeWidth}
//           strokeDasharray={circumference}
//           strokeDashoffset={offset}
//           strokeLinecap="round"
//           style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16,1,0.3,1)' }}
//         />
//       </svg>
//       <div className="absolute inset-0 flex flex-col items-center justify-center">
//         <span className="font-bold text-slate-900" style={{ fontSize: size <= 70 ? 16 : 24 }}>
//           {score ?? '-'}
//         </span>
//         {label && <span className="text-[10px] text-slate-400 font-medium">{label}</span>}
//       </div>
//     </div>
//   );
// };
'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface ScoreGaugeProps {
  score: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

function colorForScore(score: number) {
  if (score >= 90) return '#10b981'; // Green
  if (score >= 70) return '#6366F1'; // Indigo
  if (score >= 50) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  size = 120,
  strokeWidth = 10,
  label,
}) => {
  const safeScore = useMemo(() => {
    const value = Number(score);

    if (Number.isNaN(value)) return 0;

    return Math.max(0, Math.min(100, value));
  }, [score]);

  const [animatedScore, setAnimatedScore] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(safeScore);
    }, 100);

    return () => clearTimeout(timer);
  }, [safeScore]);

  const offset = circumference - (animatedScore / 100) * circumference;
  const color = colorForScore(safeScore);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition:
              'stroke-dashoffset 1s ease, stroke 0.3s ease',
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold text-slate-900"
          style={{ fontSize: size <= 70 ? 16 : 24 }}
        >
          {safeScore}
        </span>

        {label && (
          <span className="text-[10px] text-slate-500 font-medium mt-1">
            {label}
          </span>
        )}
      </div>
    </div>
  );
};