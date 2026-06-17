/**
 * form-atoms
 * -----------------------------------------------------------------------------
 * Shared building blocks for the AG1 checkout form: the smallcaps-labelled
 * `Field` wrapper (with optional leading icon), the numbered `Step` accordion,
 * and the `inputCls` string applied to every text input / select.
 * -----------------------------------------------------------------------------
 */

import * as React from "react";

import { Icon } from "@/components/icons";

export const inputCls = "ck-input";

export interface FieldProps {
  label: string;
  children: React.ReactElement<{ style?: React.CSSProperties }>;
  /** Tailwind grid-span class. Defaults to full width within a 2-col grid. */
  span?: string;
  optional?: boolean;
  hint?: string;
  /** Leading icon rendered inside the input well. */
  icon?: React.ReactNode;
  /** Stable field marker (data-field). */
  dataField?: string;
}

export function Field({
  label,
  children,
  span = "col-span-2",
  optional = false,
  hint,
  icon,
  dataField,
}: FieldProps) {
  return (
    <label className={"block " + span} data-field={dataField}>
      <span className="smallcaps text-ink3 flex items-baseline justify-between">
        <span>{label}</span>
        {optional && <span className="normal-case tracking-normal text-[10px] text-ink4">optional</span>}
        {hint && !optional && <span className="normal-case tracking-normal text-[10px] text-ink4">{hint}</span>}
      </span>
      <span className="block mt-1.5 relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none">
            {icon}
          </span>
        )}
        {icon
          ? React.cloneElement(children, { style: { ...children.props.style, paddingLeft: 38 } })
          : children}
      </span>
    </label>
  );
}

export interface StepProps {
  n: string;
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  summaryRight?: React.ReactNode;
  children: React.ReactNode;
}

export function Step({ n, title, icon, defaultOpen = true, summaryRight, children }: StepProps) {
  return (
    <details className="step" open={defaultOpen}>
      <summary className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="num text-[11px] w-6 h-6 inline-flex items-center justify-center rounded-full bg-ink text-paper">
            {n}
          </span>
          <span className="text-[15.5px] font-semibold tracking-tight text-ink">{title}</span>
          {icon}
        </div>
        <div className="flex items-center gap-3 text-ink3">
          {summaryRight}
          <Icon.Caret className="caret w-4 h-4" />
        </div>
      </summary>
      <div className="pt-5">{children}</div>
    </details>
  );
}
