import { Toaster } from 'sonner';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import CookieBanner from '@/components/marketing/CookieBanner';

export const metadata = {
  title: { default: 'ClearCash — Know where your cash is heading.', template: '%s — ClearCash' },
  description: 'AI-powered cash-flow forecasting for SMBs and startups.',
  openGraph: { type: 'website', title: 'ClearCash — AI cash-flow forecasting', description: 'Probabilistic forecasting, AI takeaways, and multi-currency ExIm.' },
};

export default function MarketingLayout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      <CookieBanner />
      <Toaster theme="dark" position="bottom-right" />
    </>
  );
}
