/**
 * OrderSummaryCard
 * -----------------------------------------------------------------------------
 * AG1 summary footer at the bottom of the checkout card: line item, free
 * shipping, bundle savings, the grand total, and the lime pay CTA (idle / busy
 * / done states wired to the real payment status).
 *
 * Marker: data-section="order-summary"
 * -----------------------------------------------------------------------------
 */

import { useState, useEffect, useRef } from "react";

import { Icon } from "@/components/icons";
import { type Bundle } from "@/components/checkout/bundles";

const PRODUCT_NAME = "Daily Greens Complex";

function dollars(minor: number) {
  return `$${(minor / 100).toFixed(2)}`;
}

export interface OrderSummaryCardProps {
  selectedBundle: Bundle;
  payDisabled?: boolean;
  payLoading?: boolean;
}

export function OrderSummaryCard({
  selectedBundle,
  payDisabled = false,
  payLoading = false,
}: OrderSummaryCardProps) {
  const disabled = payDisabled || payLoading;

  const [ctaState, setCtaState] = useState<"idle" | "busy" | "done">("idle");
  const prevLoading = useRef(false);

  useEffect(() => {
    if (payLoading) {
      setCtaState("busy");
      prevLoading.current = true;
    } else if (prevLoading.current) {
      prevLoading.current = false;
      setCtaState("done");
      const t = setTimeout(() => setCtaState("idle"), 2200);
      return () => clearTimeout(t);
    }
  }, [payLoading]);

  const total = selectedBundle.totalAmountMinor;
  const totalFmt = dollars(total);
  const savings = selectedBundle.savingsMinor ?? 0;

  return (
    <div data-section="order-summary" className="bg-paper2 border-t border-line2 px-6 py-6 -mx-6">
      <dl className="space-y-2 text-[13px]">
        <div className="flex items-baseline justify-between gap-4 text-ink2">
          <dt className="min-w-0">
            <span className="num text-ink3 mr-1">{selectedBundle.bottleCount}×</span>
            {PRODUCT_NAME}
            <span className="text-ink3 ml-1">· one-time</span>
          </dt>
          <dd className="num shrink-0 whitespace-nowrap">{totalFmt}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 text-ink2">
          <dt>Shipping</dt>
          <dd className="num shrink-0 font-medium">FREE</dd>
        </div>
        {savings > 0 && (
          <div className="flex items-baseline justify-between gap-4 text-rust font-medium">
            <dt>Bundle savings</dt>
            <dd className="num shrink-0 whitespace-nowrap">−{dollars(savings)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 pt-4 border-t border-line2 flex items-baseline justify-between gap-4">
        <div className="smallcaps text-ink3">Total today</div>
        <div className="text-right">
          <div className="num text-[28px] text-ink leading-none font-medium tracking-tight whitespace-nowrap">
            {totalFmt}<span className="text-[11px] text-ink3 ml-1.5">USD</span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <button
          data-slot="cta-primary"
          data-state={ctaState}
          type="submit"
          disabled={disabled}
          aria-disabled={disabled}
          aria-busy={ctaState === "busy"}
          className="cta w-full px-6 py-5 text-[16px] font-semibold tracking-[0.01em] relative flex items-center justify-between gap-4 cursor-pointer"
        >
          <span className="cta-label flex items-center gap-3">
            <Icon.Lock className="w-4 h-4" />
            <span className="flex flex-col items-start leading-tight">
              <span>Place order — {totalFmt}</span>
              <span className="text-[11px] font-medium tracking-[0.02em] text-ink/60 mt-0.5">
                Secure 256-bit checkout
              </span>
            </span>
          </span>
          <span className="cta-label arrow-slot shrink-0">
            <Icon.Arrow className="w-4 h-4" />
          </span>

          <span className="cta-busy">
            <span className="spinner" />
            <span className="text-[14px] tracking-[0.02em]">Placing your order…</span>
          </span>

          <span className="cta-done">
            <svg className="check-anim" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4 4 10-10" />
            </svg>
            <span className="text-[14px] tracking-[0.02em]">Order confirmed</span>
          </span>
        </button>

        <p className="text-center text-[11px] text-ink3 mt-3">
          You won't be charged until you press the button above.
        </p>
      </div>
    </div>
  );
}
