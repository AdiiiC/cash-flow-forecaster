import { FeatureCard, type FeatureItem } from "@/components/business/FeatureCard";

const FEATURES: FeatureItem[] = [
  {
    id: "clarity",
    icon: "clarity",
    title: "See your cash at a glance",
    description:
      "No spreadsheets, no jargon. One clean view shows how much cash you have and where it's heading over the next quarter.",
  },
  {
    id: "foresight",
    icon: "foresight",
    title: "Know your runway before it's a problem",
    description:
      "We project how long your cash lasts and flag the exact week things get tight — while you still have time to act.",
  },
  {
    id: "action",
    icon: "action",
    title: "Get plain-English next steps",
    description:
      "Every number comes with a takeaway: what it means for your business and the one move that improves it most.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="lp-features">
      <div className="lp-features-head">
        <h2>Everything you need, nothing you don&apos;t</h2>
        <p>
          We do the heavy forecasting behind the scenes and hand you clear
          answers you can act on today.
        </p>
      </div>
      <div className="lp-features-grid">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </section>
  );
}
