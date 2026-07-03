"use client";

import { IntervalCalibration } from "@/lib/api";
import { formatPercent } from "@/lib/format";

/** Small badge showing how well the P10–P90 band actually covers actuals. */
export function CalibrationBadge({ calibration }: { calibration: IntervalCalibration | null }) {
  if (!calibration || !Number.isFinite(calibration.empirical)) return null;
  const gap = Math.abs(calibration.empirical - calibration.target);
  // Within 7pts of nominal is "well calibrated" for weekly financial data.
  const ok = gap <= 0.07;
  return (
    <span
      className={`badge ${ok ? "ok" : "warn"}`}
      title={`Nominal ${formatPercent(calibration.target)} interval; measured ${formatPercent(
        calibration.empirical,
      )} out-of-sample coverage${calibration.conformal ? " (conformal-calibrated)" : ""}.`}
    >
      Coverage {formatPercent(calibration.empirical)} / {formatPercent(calibration.target)}
      {calibration.conformal ? " · conformal" : ""}
    </span>
  );
}
