import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function SlidePages({
  detail,
  rtl,
  main,
  children,
}: {
  detail: boolean;
  rtl: boolean;
  main: ReactNode;
  children: ReactNode;
}) {
  const first = useRef<HTMLDivElement>(null);
  const second = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    // Mirroring a hidden page must not animate it across the visible menu.
    // Establish its new offscreen origin before the next push/pop transition.
    for (const node of [first.current!, second.current!])
      node.style.transition = "none";
    second.current!.getBoundingClientRect();
    for (const node of [first.current!, second.current!])
      node.style.removeProperty("transition");
  }, [rtl]);
  useLayoutEffect(() => {
    const element = (detail ? second : first).current!;
    const measure = () => setHeight(element.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [detail, main, children]);
  const direction = rtl ? -1 : 1;
  return (
    <div
      className="about-pages"
      data-page={detail ? "detail" : "menu"}
      style={{ height }}
    >
      <div
        className="about-page"
        ref={first}
        aria-hidden={detail}
        inert={detail}
        style={{ transform: `translateX(${detail ? -direction * 100 : 0}%)` }}
      >
        {main}
      </div>
      <div
        className="about-page"
        ref={second}
        aria-hidden={!detail}
        inert={!detail}
        style={{ transform: `translateX(${detail ? 0 : direction * 100}%)` }}
      >
        {children}
      </div>
    </div>
  );
}
