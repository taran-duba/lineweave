'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, toggleTheme } from '@/lib/theme';
import { IconButton } from '@/components/ui';

/** Light/dark switch for page headers; the server renders it neutral and the client fills in the real theme. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => null);
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <IconButton label={label} onClick={toggleTheme} suppressHydrationWarning>
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </IconButton>
  );
}
