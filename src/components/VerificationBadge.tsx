import React from 'react';
import { CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface VerificationBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function VerificationBadge({ className, size = 'md' }: VerificationBadgeProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      <CheckCircle 
        className={cn(
          sizeClasses[size], 
          "text-blue-500 fill-current drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
        )} 
      />
    </div>
  );
}
