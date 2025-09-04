// lib/hooks/use-global-local-storage.tsx
import { useLocalStorage } from '@/components/utils/local-storage-provider';
import { useState, useEffect } from 'react';

interface UseGlobalLocalStorageOptions {
  listen?: boolean
}

export const useGlobalLocalStorage = <T,>(
  key: string,
  initialValue: T,
  options?: UseGlobalLocalStorageOptions
) => {
  const { listen = true } = options || {}
  const { getItem, setItem, removeItem, storageVersion } = useLocalStorage();

  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });

  const setValue = (value: T) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error setting localStorage value', error);
    }
  };

  const clearValue = () => {
    removeItem(key);
    setStoredValue(initialValue);
  };

  // If listen is true, update storedValue if localStorage changes
  useEffect(() => {
    if (!listen) return; // Skip subscribing to changes if listen is false

    const storedItem = getItem(key);
    if (storedItem !== null) {
      setStoredValue(JSON.parse(storedItem));
    } else {
      // If no value found, revert to initialValue
      setStoredValue(initialValue);
    }
  }, [getItem, key, storageVersion, initialValue, listen]);

  return [storedValue, setValue, clearValue] as const;
};
