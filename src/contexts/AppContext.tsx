import React, { createContext, useContext, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { UserCollection, CollectionItem } from '../types';

export type StatusTone = 'success' | 'info' | 'warning' | 'error';

interface AppContextValue {
  // Data
  collections: UserCollection[];
  user: User | null;
  isAdmin: boolean;

  // Actions
  updateItem: (collectionId: string, itemId: string, updates: Partial<CollectionItem>) => void;
  deleteItem: (collectionId: string, itemId: string) => boolean;
  showStatus: (
    message: string,
    tone?: StatusTone,
    options?: { actionLabel?: string; onAction?: () => void; durationMs?: number },
  ) => void;
  checkStorageQuota: () => Promise<void>;

  // Helpers
  canEditCollection: (collectionId: string) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
  value: AppContextValue;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, value }) => {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
