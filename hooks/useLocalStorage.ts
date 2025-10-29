import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';

const LOCAL_STORAGE_CHANGE_EVENT = 'onLocalStorageChange';

// Simple deep merge for filling in defaults
function mergeDefaults<T extends object>(data: Partial<T>, defaults: T): T {
    const result = { ...defaults };
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const val = data[key as keyof T];
            const defaultVal = defaults[key as keyof T];

            if (val !== null && typeof val === 'object' && !Array.isArray(val) && defaultVal !== null && typeof defaultVal === 'object' && !Array.isArray(defaultVal)) {
                (result as any)[key] = mergeDefaults(val as any, defaultVal as any);
            } else if (val !== undefined) {
                (result as any)[key] = val;
            }
        }
    }
    return result;
}


// FIX: Removed 'extends object' constraint to allow primitive types.
function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsedItem = item ? JSON.parse(item) : initialValue;
      // FIX: Only merge defaults for objects.
      if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue)) {
        return mergeDefaults(parsedItem, initialValue as T & object);
      }
      return parsedItem;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      const serializedValue = JSON.stringify(valueToStore);
      window.localStorage.setItem(key, serializedValue);
      // Dispatch event for other components in the same tab
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_CHANGE_EVENT, { detail: { key, newValue: serializedValue } }));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === key && e.newValue !== JSON.stringify(storedValue)) {
            try {
                const parsed = e.newValue ? JSON.parse(e.newValue) : initialValue;
                // FIX: Only merge defaults for objects.
                if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue)) {
                    setStoredValue(mergeDefaults(parsed, initialValue as T & object));
                } else {
                    setStoredValue(parsed);
                }
            } catch (error) {
                console.error(error);
                setStoredValue(initialValue);
            }
        }
    };
    
    const handleCustomEvent = (e: Event) => {
        const { detail } = e as CustomEvent;
        if (detail.key === key && detail.newValue !== JSON.stringify(storedValue)) {
            try {
                const parsed = detail.newValue ? JSON.parse(detail.newValue) : initialValue;
                 // FIX: Only merge defaults for objects.
                if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue)) {
                    setStoredValue(mergeDefaults(parsed, initialValue as T & object));
                } else {
                    setStoredValue(parsed);
                }
            } catch (error) {
                console.error(error);
                setStoredValue(initialValue);
            }
        }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleCustomEvent);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleCustomEvent);
    };
  }, [key, initialValue, storedValue]);

  return [storedValue, setValue as Dispatch<SetStateAction<T>>];
}

export default useLocalStorage;
