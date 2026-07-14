import { Toaster } from 'sonner';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import CookieBanner from '@/components/marketing/CookieBanner';
import StickyMobileCTA from '@/components/marketing/StickyMobileCTA';

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
      <Navbar />
      <main>{children}</main>
      <Footer />
      <CookieBanner />
      <StickyMobileCTA />
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
