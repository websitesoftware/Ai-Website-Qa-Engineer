'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { StatCardProps } from '../app/types/dashboard';
import { AnimatedCounter } from './ui/AnimatedCounter';

const variantMap = {
  primary: { badge: 'bg-gradient-to-br from-[#4C93FF] to-[#1C56C9] shadow-blue-500/30', textVal: 'text-slate-900 dark:text-slate-100' },
  warning: { badge: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/30', textVal: 'text-slate-900 dark:text-slate-100' },
  danger: { badge: 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30', textVal: 'text-red-600 dark:text-red-400' },
  success: { badge: 'bg-gradient-to-br from-[#2FAE84] to-[#1F8F6B] shadow-emerald-500/30', textVal: 'text-slate-900 dark:text-slate-100' },
};

export const StatCard: React.FC<StatCardProps> = ({ title, value, subValue, icon, variant }) => {
  const styles = variantMap[variant] || variantMap.primary;
  const numericValue = typeof value === 'number' ? value : Number(value) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.35 }}
      className="bg-white/85 dark:bg-slate-800 backdrop-blur-md p-6 rounded-2xl border border-slate-200/70 dark:border-slate-700 shadow-lg shadow-slate-900/5 flex items-center justify-between"
    >
      <div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">{title}</span>
        <span className={`font-display text-2xl font-bold block mt-1 ${styles.textVal}`}>
          <AnimatedCounter value={numericValue} />
          {subValue && <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{subValue}</span>}
        </span>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl text-white shadow-md ${styles.badge}`}>
        <i className={`ph ${icon}`}></i>
      </div>
    </motion.div>
  );
};
