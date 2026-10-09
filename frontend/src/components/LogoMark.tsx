import React, { useId } from 'react';

interface Props {
  size?: number;
  className?: string;
}

export default function LogoMark({ size = 36, className }: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="LookAte" className={className}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`pin${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbeafe" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#bg${id})`} />
      <path d="M96 436C190 384 322 474 416 414" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="14" strokeLinecap="round" strokeDasharray="1 28" />
      <path d="M256 78C178 78 122 136 122 210C122 292 214 366 256 424C298 366 390 292 390 210C390 136 334 78 256 78Z" fill={`url(#pin${id})`} />
      <circle cx="256" cy="208" r="72" fill={`url(#bg${id})`} />
      <circle cx="256" cy="208" r="34" fill="#fff" fillOpacity=".95" />
      <circle cx="244" cy="196" r="10" fill="#fff" />
      <path d="M404 74l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      Look<span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Ate</span>
    </span>
  );
}
