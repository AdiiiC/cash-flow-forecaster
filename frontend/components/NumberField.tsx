"use client";

import { useCallback } from "react";

interface Props {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

/**
 * Accessible number stepper with custom −/+ controls.
 * Native spinner is suppressed (see globals.css) in favour of large, keyboard-
 * and touch-friendly buttons. Values are clamped to [min, max] at the boundary.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled = false,
}: Props) {
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const commit = useCallback(
    (raw: number) => {
      if (!Number.isFinite(raw)) return;
      onChange(clamp(raw));
    },
    [clamp, onChange],
  );

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="stepper" data-disabled={disabled || undefined}>
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Decrease ${label}`}
          onClick={() => commit(value - step)}
          disabled={disabled || atMin}
          tabIndex={-1}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        <input
          id={id}
          type="number"
          className="stepper-input num"
          value={Number.isFinite(value) ? value : ""}
          min={Number.isFinite(min) ? min : undefined}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          disabled={disabled}
          onChange={(e) => commit(Number(e.target.value))}
        />
        <button
          type="button"
          className="stepper-btn"
          aria-label={`Increase ${label}`}
          onClick={() => commit(value + step)}
          disabled={disabled || atMax}
          tabIndex={-1}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
