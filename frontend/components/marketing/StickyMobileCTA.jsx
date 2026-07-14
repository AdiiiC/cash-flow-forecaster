'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 md:hidden z-40 p-3 bg-bg/95 hairline-t"
      data-testid="sticky-mobile-cta"
    >
      <Link
        href="/contact"
        className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-[#f0b25c] text-bg rounded-btn py-3 text-[14px] font-medium transition-colors"
      >
        Start free <ArrowRight size={14} />
      </Link>
    </div>
  );
}
