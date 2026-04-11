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
    <div className={cn("inline-flex items-center justify-center relative group", className)}>
      <CheckCircle 
        className={cn(
          sizeClasses[size], 
          "text-emerald-500 fill-emerald-500/10 transition-all duration-300 group-hover:scale-110",
          "drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]"
        )} 
      />
      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
