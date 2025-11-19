'use client';

import * as SelectPrimitive from '@radix-ui/react-select';

interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  className?: string;
}

export function Select({ value, onValueChange, children, placeholder, className = '' }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={`inline-flex items-center justify-between px-3 py-2 text-sm bg-background-secondary border border-border rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/50 transition-all ${className}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ml-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="overflow-hidden bg-background-secondary border border-border rounded-md shadow-lg z-50 min-w-[8rem] backdrop-blur-md">
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 bg-background-secondary text-text-primary cursor-default">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {children}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 bg-background-secondary text-text-primary cursor-default">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className = '' }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={`relative flex items-center pl-8 pr-3 py-2 text-sm text-text-primary rounded-sm cursor-pointer select-none data-[highlighted]:bg-primary/20 data-[highlighted]:text-primary focus:outline-none ${className}`}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute left-2 w-4 inline-flex items-center justify-center">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

