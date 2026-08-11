// components/ScrollReveal.tsx
// Fades + slides a section in the first time it scrolls into view. Client-only
// and deliberately has no imports beyond React — it gets used inside server
// components (like the pricing page) as a child, which is fine; only this
// wrapper itself needs to run in the browser, not the page around it.
'use client'

import { useEffect, useRef, useState } from 'react'

export default function ScrollReveal({ children, delayMs = 0 }: { children: React.ReactNode; delayMs?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(18px)',
        transition: `opacity 0.6s ease ${delayMs}ms, transform 0.6s ease ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  )
}
