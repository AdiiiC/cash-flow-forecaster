import { BizIcon } from "@/components/business/BizIcon";
import type { BizTakeaway } from "@/lib/businessView";

export function KeyTakeaways({ takeaways }: { takeaways: BizTakeaway[] }) {
  return (
    <div className="bz-takeaways">
      <div className="bz-takeaways-head">
        <span className="bz-kpi-icon">
          <BizIcon name="action" width={18} height={18} />
        </span>
        <div>
          <h3>Key takeaways</h3>
          <p>What your numbers mean right now</p>
        </div>
      </div>
      <ul className="bz-takeaways-list">
        {takeaways.map((item) => (
          <li key={item.id} className="bz-takeaway">
            <span className={`bz-takeaway-dot ${item.tone}`} aria-hidden="true" />
            <span className="bz-takeaway-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
