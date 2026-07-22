'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Monitor
} from '@phosphor-icons/react';
import { useTheme } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme
  } = useTheme();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);

    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, []);

  return (
    <div
      className="relative"
      ref={menuRef}
    >
      <button
        onClick={toggleTheme}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
        className="
          h-10
          w-10
          rounded-xl
          border
          border-slate-300
          dark:border-slate-700
          bg-white
          dark:bg-slate-900
          flex
          items-center
          justify-center
          transition-all
          duration-300
          hover:scale-105
          hover:shadow-md
        "
      >
        {resolvedTheme === 'dark' ? (
          <Moon
            size={20}
            weight="fill"
            className="text-yellow-400"
          />
        ) : (
          <Sun
            size={20}
            weight="fill"
            className="text-orange-500"
          />
        )}
      </button>

      {open && (
        <div
          className="
            absolute
            right-0
            mt-2
            w-48
            rounded-xl
            border
            border-slate-200
            dark:border-slate-700
            bg-white
            dark:bg-slate-900
            shadow-xl
            overflow-hidden
            z-50
          "
        >
          <button
            onClick={() => {
              setTheme('light');
              setOpen(false);
            }}
            className={`
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-sm
              hover:bg-slate-100
              dark:hover:bg-slate-800
              ${theme === 'light'
                ? 'bg-slate-100 dark:bg-slate-800'
                : ''
              }
            `}
          >
            <Sun size={18} />
            Light
          </button>

          <button
            onClick={() => {
              setTheme('dark');
              setOpen(false);
            }}
            className={`
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-sm
              hover:bg-slate-100
              dark:hover:bg-slate-800
              ${theme === 'dark'
                ? 'bg-slate-100 dark:bg-slate-800'
                : ''
              }
            `}
          >
            <Moon size={18} />
            Dark
          </button>

          <button
            onClick={() => {
              setTheme('system');
              setOpen(false);
            }}
            className={`
              flex
              items-center
              gap-3
              w-full
              px-4
              py-3
              text-sm
              hover:bg-slate-100
              dark:hover:bg-slate-800
              ${theme === 'system'
                ? 'bg-slate-100 dark:bg-slate-800'
                : ''
              }
            `}
          >
            <Monitor size={18} />
            System
          </button>
        </div>
      )}
    </div>
  );
};