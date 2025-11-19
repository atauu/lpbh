'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function RadioGroup({ value, onValueChange, children, className = '' }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      className={`${className}`}
    >
      {children}
    </RadioGroupPrimitive.Root>
  );
}

interface RadioGroupItemProps {
  value: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function RadioGroupItem({ value, id, disabled, className = '' }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      id={id}
      disabled={disabled}
      className={`aspect-square h-5 w-5 rounded-full border-2 border-border text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
}


