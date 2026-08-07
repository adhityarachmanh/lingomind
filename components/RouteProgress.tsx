"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setVisible(true);
    setProgress(0);
    const raf = requestAnimationFrame(() => setProgress(0.9));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setProgress(1);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none">
      <div
        className="h-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
