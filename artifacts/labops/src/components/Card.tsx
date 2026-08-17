import React from 'react';

export function Card({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card shadow-sm ${className || ''}`}>
      {children}
    </div>
  );
}