import { Toaster } from 'sonner';
import Script from 'next/script';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import CookieBanner from '@/components/marketing/CookieBanner';
import StickyMobileCTA from '@/components/marketing/StickyMobileCTA';
import CommandPalette from '@/components/marketing/CommandPalette';
import { CurrencyProvider } from '@/lib/currency';

const BASE = 'https://clearcash.app';

export const metadata = {
  title: { default: 'ClearCash — Know where your cash is heading.', template: '%s — ClearCash' },
  description: 'AI-powered cash-flow forecasting for SMBs and startups.',
  metadataBase: new URL(BASE),
  openGraph: {
    type: 'website',
    siteName: 'ClearCash',
    title: 'ClearCash — AI cash-flow forecasting',
    description: 'Probabilistic forecasting, AI takeaways, and multi-currency ExIm.',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'ClearCash dashboard' }],
  },
  twitter: { card: 'summary_large_image', title: 'ClearCash', description: 'AI cash-flow forecasting for SMBs.' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'ClearCash',
  url: BASE,
  description: 'AI-powered cash-flow forecasting platform for SMBs and startups.',
  foundingDate: '2024',
  areaServed: 'Worldwide',
  knowsAbout: ['cash flow forecasting', 'financial modelling', 'runway management', 'FX risk'],
};

export default function MarketingLayout({ children }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Cloudflare Turnstile */}
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      {/* Cal.com embed (only loads when NEXT_PUBLIC_CALCOM_LINK is set) */}
      {process.env.NEXT_PUBLIC_CALCOM_LINK && (
        <Script src="https://app.cal.com/embed/embed.js" strategy="lazyOnload" />
      )}
      <Navbar />
      <main><CurrencyProvider>{children}</CurrencyProvider></main>
      <Footer />
      <CookieBanner />
      <StickyMobileCTA />
      <CommandPalette />
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
