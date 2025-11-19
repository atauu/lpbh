'use client';

import * as LabelPrimitive from '@radix-ui/react-label';

interface LabelProps {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export function Label({ children, htmlFor, className = '' }: LabelProps) {
  return (
    <LabelPrimitive.Root
      htmlFor={htmlFor}
      className={`text-sm font-medium leading-none text-text-secondary peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
    >
      {children}
    </LabelPrimitive.Root>
  );
}


