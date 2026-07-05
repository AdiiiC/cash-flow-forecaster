import type { JSX } from "react";

import type { Takeaway, TakeawayTone } from "@/types";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

interface KeyTakeawaysProps {
  takeaways: Takeaway[];
}

const TONE_STYLES: Record<TakeawayTone, { dot: string; ring: string }> = {
  positive: { dot: "bg-emerald-500", ring: "bg-emerald-50" },
  watch: { dot: "bg-amber-500", ring: "bg-amber-50" },
  neutral: { dot: "bg-slate-400", ring: "bg-slate-100" },
};

export function KeyTakeaways({ takeaways }: KeyTakeawaysProps): JSX.Element {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <Icon name="action" width={18} height={18} />
        </span>
        <div>
          <h3 className="text-base font-bold text-slate-900">Key takeaways</h3>
          <p className="text-sm text-slate-500">What your numbers mean this week</p>
        </div>
      </div>
      <ul className="space-y-4">
        {takeaways.map((item) => {
          const tone = TONE_STYLES[item.tone];
          return (
            <li key={item.id} className="flex gap-3">
              <span
                className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${tone.ring}`}
              >
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              </span>
              <p className="text-sm leading-relaxed text-slate-700">{item.text}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
