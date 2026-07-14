import React from 'react';

// Static wrappers — apply animation via CSS class if desired.
// Kept as components so pages don't need refactoring.
export function Reveal({ children, className = '' }) {
  return <div className={`cc-reveal ${className}`}>{children}</div>;
}

export function Stagger({ children, className = '' }) {
  return <div className={`cc-reveal ${className}`}>{children}</div>;
}

export function StaggerItem({ children, className = '' }) {
  return <div className={className}>{children}</div>;
}
