import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import Landing from './pages/Landing';
import Features from './pages/Features';
import Pricing from './pages/Pricing';
import About from './pages/About';
import Contact from './pages/Contact';
import RoiCalculator from './pages/RoiCalculator';

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Let the browser handle in-page anchors
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash]);
  return null;
}

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const map = {
      '/': 'ClearCash — Know where your cash is heading.',
      '/features': 'Features — ClearCash',
      '/pricing': 'Pricing — ClearCash',
      '/about': 'About — ClearCash',
      '/contact': 'Contact — ClearCash',
      '/roi-calculator': 'ROI Calculator — ClearCash',
    };
    document.title = map[pathname] || 'ClearCash';
    const desc = {
      '/': 'AI-powered cash-flow forecasting for SMBs and startups.',
      '/features': 'Probabilistic forecasting, AI takeaways, ExIm FX, actuals & variance.',
      '/pricing': 'Simple pricing. Free Starter, Growth $49/mo, Enterprise custom.',
      '/about': 'The team building ClearCash. Mission-driven, engineer-led.',
      '/contact': 'Talk to ClearCash. Book a 20-minute demo.',
      '/roi-calculator': 'See how many months of runway ClearCash unlocks — in seconds.',
    };
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = desc[pathname] || desc['/'];
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <DocumentTitle />
      <div className="min-h-screen bg-bg text-white flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/roi-calculator" element={<RoiCalculator />} />
          </Routes>
        </main>
        <Footer />
        <CookieBanner />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#12161f',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#ffffff',
              borderRadius: '8px',
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}
