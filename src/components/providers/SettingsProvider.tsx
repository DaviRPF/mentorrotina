'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settings-store';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { fetchSettings, isInitialized } = useSettingsStore();

  useEffect(() => {
    if (!isInitialized) {
      fetchSettings();
    }
  }, [fetchSettings, isInitialized]);

  return <>{children}</>;
}
