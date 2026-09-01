'use client';

import { cn } from '@/lib/cn';
import { useInView } from '@/lib/use-in-view';

/** Ingresso in scena al primo passaggio in viewport. */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section';
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <Tag
      ref={ref as never}
      className={cn('reveal', inView && 'reveal-visible', className)}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  );
}
