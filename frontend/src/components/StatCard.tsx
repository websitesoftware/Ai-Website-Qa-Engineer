'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { StatCardProps } from '../app/types/dashboard';
import { AnimatedCounter } from './ui/AnimatedCounter';

const variantMap = {
  primary: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-[#6366F1] dark:text-indigo-400', textVal: 'text-slate-900 dark:text-slate-100' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', textVal: 'text-slate-900 dark:text-slate-100' },
  danger: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-500 dark:text-red-400', textVal: 'text-red-600 dark:text-red-400' },
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', textVal: 'text-slate-900 dark:text-slate-100' },
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
      className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
    >
      <div>
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400 block">{title}</span>
        <span className={`text-2xl font-bold block mt-1 ${styles.textVal}`}>
          <AnimatedCounter value={numericValue} />
          {subValue && <span className="text-sm font-medium text-slate-400 dark:text-slate-500">{subValue}</span>}
        </span>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${styles.bg} ${styles.text}`}>
        <i className={`ph ${icon}`}></i>
      </div>
    </motion.div>
  );
};
