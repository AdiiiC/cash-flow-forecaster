'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, LayoutDashboard, BarChart3, DollarSign, Users, BookOpen, Calculator, Mail, Home, ChevronRight } from 'lucide-react';

const PAGES = [
  { group: 'Marketing', icon: Home,           label: 'Home',              href: '/' },
  { group: 'Marketing', icon: BarChart3,      label: 'Features',          href: '/features' },
  { group: 'Marketing', icon: DollarSign,     label: 'Pricing',           href: '/pricing' },
  { group: 'Marketing', icon: Calculator,     label: 'ROI Calculator',    href: '/roi-calculator' },
  { group: 'Marketing', icon: Users,          label: 'About',             href: '/about' },
  { group: 'Marketing', icon: Mail,           label: 'Contact / Demo',    href: '/contact' },
  { group: 'App',       icon: LayoutDashboard,label: 'Dashboard',         href: '/dashboard' },
  { group: 'App',       icon: BarChart3,      label: 'Forecast App',      href: '/forecast' },
  { group: 'App',       icon: BookOpen,       label: 'Actuals',           href: '/actuals' },
  { group: 'App',       icon: DollarSign,     label: 'Budget',            href: '/budget' },
  { group: 'App',       icon: Users,          label: 'Team & Org',        href: '/settings/team' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;

  const go = (href) => {
    setOpen(false);
    router.push(href);
  };

  // Group pages
  const groups = [...new Set(PAGES.map((p) => p.group))];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] bg-black/60"
      onClick={() => setOpen(false)}
      data-testid="command-palette-overlay"
    >
      <Command
        className="w-full max-w-lg bg-elevated hairline rounded-card shadow-subtle overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <div className="flex items-center gap-3 px-4 hairline-b">
          <Search size={14} className="text-muted shrink-0" />
          <Command.Input
            autoFocus
            placeholder="Go to page…"
            className="flex-1 py-3.5 bg-transparent text-[14px] text-white placeholder-muted/60 outline-none"
            data-testid="command-palette-input"
          />
          <kbd className="overline px-1.5 py-0.5 hairline rounded text-muted/60">ESC</kbd>
        </div>

        <Command.List className="max-h-[360px] overflow-y-auto py-2">
          <Command.Empty className="py-8 text-center text-[13px] text-muted">
            No results.
          </Command.Empty>

          {groups.map((group) => (
            <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:overline [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-muted/60">
              {PAGES.filter((p) => p.group === group).map((page) => {
                const Icon = page.icon;
                return (
                  <Command.Item
                    key={page.href}
                    value={page.label}
                    onSelect={() => go(page.href)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer text-[13.5px] text-white/80 hover:bg-surface data-[selected=true]:bg-surface data-[selected]:bg-surface aria-selected:bg-surface transition-colors"
                    data-testid={`cmd-item-${page.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Icon size={13} className="text-muted shrink-0" />
                    <span className="flex-1">{page.label}</span>
                    <ChevronRight size={11} className="text-muted/40" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>

        <div className="hairline-t px-4 py-2.5 flex items-center gap-4 text-[11px] text-muted">
          <span><kbd className="num">↑↓</kbd> navigate</span>
          <span><kbd className="num">↵</kbd> open</span>
          <span><kbd className="num">⌘K</kbd> toggle</span>
        </div>
      </Command>
    </div>
  );
}
