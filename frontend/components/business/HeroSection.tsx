import Link from "next/link";

export function HeroSection() {
  return (
    <section className="lp-hero">
      <div className="lp-hero-inner">
        <span className="lp-eyebrow">Built for busy business owners</span>
        <h1 className="lp-hero-title">
          Know exactly where your <span className="lp-accent">cash is heading</span>.
        </h1>
        <p className="lp-hero-sub">
          We turn your numbers into a simple, forward-looking picture: how much
          cash you have, how long it lasts, and the one move that strengthens
          your business this month — no finance degree required.
        </p>
        <div className="lp-hero-actions">
          <Link href="/dashboard" className="lp-btn lp-btn-primary">
            View dashboard
          </Link>
          <Link href="/forecast" className="lp-btn lp-btn-secondary">
            Explore the full forecaster
          </Link>
        </div>
        <p className="lp-hero-note">
          Live sample data, ready to explore. No sign-up required.
        </p>
      </div>
    </section>
  );
}
