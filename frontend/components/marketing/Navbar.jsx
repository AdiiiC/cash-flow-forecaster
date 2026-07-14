'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';

const links = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/roi-calculator', label: 'ROI' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const linkCls = (href) =>
    `text-[13.5px] px-3 py-1.5 rounded-btn transition-colors ${
      pathname === href ? 'text-white' : 'text-muted hover:text-white'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-bg/95 hairline-b backdrop-blur-0">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" data-testid="nav-home-link" className="flex items-center">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={linkCls(l.href)}
              data-testid={`nav-link-${l.label.toLowerCase()}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/dashboard"
            data-testid="nav-signin-btn"
            className="text-[13.5px] text-muted hover:text-white px-3 py-1.5 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/contact"
            data-testid="nav-getstarted-btn"
            className="text-[13.5px] font-medium text-bg bg-accent hover:bg-[#f0b25c] rounded-btn px-3.5 py-1.5 transition-colors"
          >
            Get started
          </Link>
        </div>

        <button
          className="md:hidden p-2 text-white"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          data-testid="nav-mobile-toggle"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden hairline-t bg-bg" data-testid="nav-mobile-menu">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2.5 rounded-btn text-[14px] ${
                  pathname === l.href ? 'text-white bg-surface' : 'text-muted'
                }`}
                data-testid={`nav-mobile-link-${l.label.toLowerCase()}`}
              >
                {l.label}
              </Link>
            ))}
            <div className="hairline-t mt-3 pt-3 flex flex-col gap-2">
              <Link
                href="/dashboard"
                className="px-3 py-2.5 text-[14px] text-muted"
                data-testid="nav-mobile-signin"
              >
                Sign in
              </Link>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-[14px] font-medium text-bg bg-accent rounded-btn text-center"
                data-testid="nav-mobile-getstarted"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
