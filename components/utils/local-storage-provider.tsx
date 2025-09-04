// components/local-storage-provider.tsx

'use client'

import React, { createContext, useContext, useEffect, useState } from 'react';

interface LocalStorageContextProps {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  storageVersion: number;
}

// Create the context
const LocalStorageContext = createContext<LocalStorageContextProps | null>(null);

// LocalStorageProvider component to wrap your app
export const LocalStorageProvider = ({ children }: { children: React.ReactNode }) => {
  const [storageVersion, setStorageVersion] = useState(0);

  // Listen for changes to localStorage (even from other tabs)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.storageArea === localStorage) {
          // Increment storageVersion to notify all listeners
          setStorageVersion(prev => prev + 1);
        }
      };

      window.addEventListener('storage', handleStorageChange);

      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  const getItem = (key: string) => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  };
  
  const setItem = (key: string, value: string) => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      setStorageVersion(prev => prev + 1);
    }
  };
  
  const removeItem = (key: string) => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      setStorageVersion(prev => prev + 1);
    }
  };

  return (
    <LocalStorageContext.Provider value= {{ getItem, setItem, removeItem, storageVersion }
}>
  { children }
  </LocalStorageContext.Provider>
  );
};

// Create custom hook to use the localStorage context
export const useLocalStorage = (): LocalStorageContextProps => {
  const context = useContext(LocalStorageContext);
  if (!context) {
    throw new Error('useLocalStorage must be used within a LocalStorageProvider');
  }
  return context;
};
