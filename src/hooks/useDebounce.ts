import { useState, useEffect } from 'react';

/**
 * Hook para debounce de valores
 * Evita chamadas excessivas à API ao digitar na busca
 * @param value - Valor a ser "debounced"
 * @param delay - Delay em milissegundos (padrão: 300ms)
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
