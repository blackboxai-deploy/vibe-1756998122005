import { useEffect, useState } from 'react'

export function useSessionStorageValue(key: string) {
  const [value, setValue] = useState('')

  useEffect(() => {
    // Only access sessionStorage on the client side
    if (typeof window !== 'undefined') {
      const storedValue = sessionStorage.getItem(key)
      if (storedValue !== null) {
        setValue(storedValue)
      }
    }
  }, [key])

  useEffect(() => {
    // Only set sessionStorage on the client side and when value is not empty
    if (typeof window !== 'undefined' && value !== '') {
      sessionStorage.setItem(key, value)
    }
  }, [key, value])

  return [value, setValue] as const
}
