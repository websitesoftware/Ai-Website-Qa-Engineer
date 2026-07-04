'use client';
import React from 'react';
import { useCountUp } from '../../hooks/useCountUp';

export const AnimatedCounter: React.FC<{ value: number; duration?: number }> = ({ value, duration }) => {
  const display = useCountUp(value, duration);
  return <>{display}</>;
};
