import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

const variants = {
  primary: 'bg-accent text-bg hover:bg-[#f0b25c]',
  secondary: 'bg-surface text-white hairline hover:bg-elevated',
  ghost: 'text-muted hover:text-white',
};

const sizes = {
  md: 'text-[13.5px] px-4 py-2',
  lg: 'text-[14px] px-5 py-2.5',
  sm: 'text-[12.5px] px-3 py-1.5',
};

export default function Button({
  as: As,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  const cls = cn(
    'inline-flex items-center gap-1.5 rounded-btn font-medium transition-colors',
    variants[variant],
    sizes[size],
    className
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={cls} {...props}>
        {children}
      </a>
    );
  }
  const Comp = As || 'button';
  return (
    <Comp className={cls} {...props}>
      {children}
    </Comp>
  );
}
