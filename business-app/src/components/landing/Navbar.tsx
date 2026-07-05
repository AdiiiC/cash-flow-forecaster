import type { JSX } from "react";

import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

interface NavbarProps {
  onLaunch: () => void;
}

export function Navbar({ onLaunch }: NavbarProps): JSX.Element {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
            <Icon name="wallet" width={18} height={18} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-slate-900">
            ClearCash
          </span>
        </div>
        <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a className="hover:text-slate-900" href="#features">
            Features
          </a>
          <a className="hover:text-slate-900" href="#how">
            How it works
          </a>
        </div>
        <Button onClick={onLaunch}>View Dashboard</Button>
      </nav>
    </header>
  );
}
