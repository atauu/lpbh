'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={className}>
      {children}
    </TabsPrimitive.Root>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <TabsPrimitive.List
      className={`inline-flex h-10 items-center justify-center rounded-md bg-background-secondary p-1 text-text-tertiary ${className}`}
    >
      {children}
    </TabsPrimitive.List>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className = '' }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background-tertiary data-[state=active]:text-text-primary data-[state=active]:shadow-sm ${className}`}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      value={value}
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </TabsPrimitive.Content>
  );
}


