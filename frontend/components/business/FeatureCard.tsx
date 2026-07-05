import { BizIcon } from "@/components/business/BizIcon";

export interface FeatureItem {
  id: string;
  icon: "clarity" | "foresight" | "action";
  title: string;
  description: string;
}

export function FeatureCard({ feature }: { feature: FeatureItem }) {
  return (
    <article className="lp-feature">
      <span className="lp-feature-icon">
        <BizIcon name={feature.icon} width={22} height={22} />
      </span>
      <h3 className="lp-feature-title">{feature.title}</h3>
      <p className="lp-feature-desc">{feature.description}</p>
    </article>
  );
}
