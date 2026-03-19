import { useEffect, useRef } from "react";

interface ScrollAnchorProps {
  trackVisibility?: boolean;
}

export function ScrollAnchor({ trackVisibility }: ScrollAnchorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    if (!trackVisibility || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          isVisibleRef.current = entry.isIntersecting;
        }
      },
      { threshold: 0 },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [trackVisibility]);

  useEffect(() => {
    if (isVisibleRef.current && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  });

  return <div ref={ref} className="prc-h-px prc-w-full" />;
}
