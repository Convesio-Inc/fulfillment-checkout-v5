/**
 * UpsellOfferBanner
 * -----------------------------------------------------------------------------
 * Post-purchase upsell card shown on the thank-you page after the order
 * confirmation notice. Displays the upsell product with a live countdown timer.
 * Clicking "Claim Offer" opens the upsell checkout modal.
 *
 * UpsellProductConfig is defined and exported from this file.
 *
 * Markers:
 *   - root          data-section="upsell-offer"
 *   - timer badge   data-slot="upsell-timer"
 * -----------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";

export interface UpsellProductConfig {
  name: string;
  sku: string;
  image: { src: string; alt: string };
  salePrice: string;
  regularPrice: string;
  discountLabel: string;
  upsellMinutes: number;
  amountMinor: number;
  currency: string;
}

export interface UpsellOfferBannerProps {
  upsell: UpsellProductConfig;
  onClaim: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function UpsellOfferBanner({ upsell, onClaim }: UpsellOfferBannerProps) {
  const [remaining, setRemaining] = useState(upsell.upsellMinutes * 60);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const mmss = `${pad(minutes)}:${pad(seconds)}`;
  const expired = remaining === 0;

  if (expired) return null;

  return (
    <section
      data-section="upsell-offer"
      className="bg-paper border border-line rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-line2 bg-paper2 px-5 py-3">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">Wait — limited time offer</h2>
        <span
          data-slot="upsell-timer"
          aria-live="polite"
          aria-label={`Offer expires in ${mmss}`}
          className="num text-[14px] font-semibold tabular-nums text-rust"
        >
          {mmss}
        </span>
      </div>

      <div className="flex items-center gap-4 px-5 py-4">
        <img
          src={upsell.image.src}
          alt={upsell.image.alt}
          className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{upsell.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="num text-[14px] font-bold text-ink">{upsell.salePrice}</span>
            <span className="num text-[13px] text-ink3 line-through">{upsell.regularPrice}</span>
            <span className="save-chip inline-flex items-center gap-1">
              <Icon.Tag className="h-3 w-3" aria-hidden="true" />
              {upsell.discountLabel}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClaim}
          data-slot="upsell-cta"
          className="cta shrink-0 px-5 py-2.5 text-[13px]"
        >
          Claim offer
        </button>
      </div>
    </section>
  );
}
