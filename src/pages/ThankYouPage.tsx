/**
 * ThankYouPage
 * -----------------------------------------------------------------------------
 * Landing page after the checkout redirects. Reads the `?token=` JWT that the
 * worker signed on success/pending, verifies it server-side, and drives a
 * state machine via `useThankYouPayment`:
 *
 *   - "verifying"  Amber "Processing Payment" promo banner with a spinner +
 *                  matching "Processing Your Payment" main-card copy, while
 *                  the worker verifies the token.
 *   - "pending"    Same promo banner and main-card copy as "verifying" — the
 *                  hook polls `/poll-payment` every 5s until the upstream
 *                  status flips to succeeded or failed.
 *   - "succeeded"  Forest "Order Confirmed" promo banner + "Thank You for
 *                  Your Order" main-card copy, plus order details and the
 *                  receipt sidebar.
 *   - "failed"     Single failure card (no banner, no summary) pointing the
 *                  user back to the checkout to retry.
 *
 * Markers:
 *   - page root            data-page="thank-you"
 *   - promo banner         data-section="promo-banner" + data-status="..."
 *   - main card            data-section="thank-you-main-card" + data-status
 *   - failure card         data-section="thank-you-failure"
 * -----------------------------------------------------------------------------
 */

import { useState } from "react";
import { useSearchParams } from "react-router";

import { Icon } from "@/components/icons";
import { PriceRow } from "@/components/checkout/primitives/PriceRow";
import { SectionCard } from "@/components/checkout/primitives/SectionCard";
import { useThankYouPayment } from "@/hooks/useThankYouPayment";
import { Spinner } from "@/components/ui/spinner";
import { UpsellOfferBanner, type UpsellProductConfig } from "@/components/thank-you/UpsellOfferBanner";
import { UpsellCheckoutModal } from "@/components/thank-you/UpsellCheckoutModal";

// Product shown in the receipt when no order items are returned yet.
const PRODUCT = {
  name: "Daily Greens Complex",
  sku: "1234567890",
  salePrice: "$49.00",
  image: { src: "/product-summary-image.jpeg", alt: "Daily Greens Complex product photo" },
};

// Order summary lines shown in the receipt sidebar.
const SUMMARY = {
  includedProductsTitle: "Included Products",
  includedProductSuffix: "",
  shipping: { id: "shipping", label: "Shipping", value: "$7.95" },
  tax: { id: "tax", label: "Tax", value: "$0.00" },
  total: { id: "total", label: "Total", value: "$56.95" },
  currency: "USD",
};

// Thank-you page copy.
const THANK_YOU = {
  nextSteps: { title: "What Happens Next" },
  receipt: {
    title: "Receipt Summary",
    backToHomeLabel: "Return to store",
    backToHomeHref: "/",
    guaranteeNote: "Your 60-day return window starts from the purchase date.",
  },
};

// Optional upsell shown after a successful checkout. Set to null to disable.
const UPSELL_PRODUCT: UpsellProductConfig | null = {
  name: "Boomsilk®",
  sku: "BOOMSILK-UPSELL",
  image: { src: "/product-summary-image.jpeg", alt: "Boomsilk product photo" },
  salePrice: "$51.20",
  regularPrice: "$64.00",
  discountLabel: "-20%",
  upsellMinutes: 10,
  amountMinor: 5120,
  currency: "USD",
};

// Map known SKUs back to display copy + thumbnail.
const SKU_DISPLAY: Record<
  string,
  { name: string; image: { src: string; alt: string } }
> = {
  [PRODUCT.sku]: {
    name: PRODUCT.name,
    image: PRODUCT.image,
  },
  ...(UPSELL_PRODUCT
    ? {
        [UPSELL_PRODUCT.sku]: {
          name: UPSELL_PRODUCT.name,
          image: UPSELL_PRODUCT.image,
        },
      }
    : {}),
};

function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function ThankYouPage() {
  const product = PRODUCT;
  const summary = SUMMARY;
  const thankYou = THANK_YOU;
  const upsellProduct = UPSELL_PRODUCT;
  const [isUpsellModalOpen, setIsUpsellModalOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const orderIdHintRaw = searchParams.get("orderId");
  const orderIdHint =
    orderIdHintRaw && Number.isFinite(Number(orderIdHintRaw))
      ? Number(orderIdHintRaw)
      : null;
  const { state, payload, context, error, refreshOrderContext } =
    useThankYouPayment({
      token,
      orderIdHint,
    });

  const isFailed = state === "failed";
  const isProcessing = state === "pending" || state === "verifying";
  const orderNumber =
    typeof payload?.order_id === "number"
      ? `#${payload.order_id}`
      : "#CV-302948";
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const paymentStatus = isProcessing
    ? "Pending — final review in progress"
    : "Paid — preparing shipment";
  const mainCardTitle = isProcessing
    ? "Processing Your Payment"
    : "Thank You for Your Order";
  const mainCardSubtitle = isProcessing
    ? "Hang tight — your payment is going through a final review. This page will update automatically as soon as it clears."
    : "Your payment was processed successfully.";
  const includedLabel = `${product.name}${summary.includedProductSuffix ? ` ${summary.includedProductSuffix}` : ""}`;

  const orderItems = context?.items ?? [];
  const hasOrderItems = orderItems.length > 0;
  const hasPendingLineCharges = orderItems.some((item) => item.chargePending);
  const upsellAlreadyInOrder = Boolean(
    context && upsellProduct &&
      orderItems.some((item) => item.sku === upsellProduct.sku),
  );
  const showUpsell = Boolean(upsellProduct) && !upsellAlreadyInOrder;
  const receiptCurrency = summary.currency || "USD";
  const itemsSubtotalMinor = orderItems.reduce(
    (sum, item) => sum + (item.amountMinor ?? 0),
    0,
  );
  const formattedTotal = hasOrderItems
    ? formatMoney(itemsSubtotalMinor, receiptCurrency)
    : summary.total.value;

  const ctaClassName =
    "h-12 w-full rounded-full bg-ink text-paper text-[14px] font-semibold tracking-[0.02em] flex items-center justify-center gap-2 transition hover:bg-ink2 cursor-pointer";

  return (
    <main data-page="thank-you">
      <div className="max-w-[760px] mx-auto flex w-full flex-col gap-4 px-6 py-12">
        {isFailed ? (
          <SectionCard
            section="thank-you-failure"
            title="We couldn't confirm your payment"
          >
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rust/15 text-rust">
                <Icon.Alert className="h-6 w-6" />
              </div>
              <p className="text-[13.5px] text-ink2">
                {error?.message ??
                  "Your payment could not be confirmed. You haven't been charged — please try checking out again."}
              </p>
              <a
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-[14px] font-semibold tracking-[0.02em] text-paper transition hover:bg-ink2"
              >
                Return to checkout
              </a>
            </div>
          </SectionCard>
        ) : (
          <>
            {isProcessing ? (
              <section
                data-section="promo-banner"
                data-status={state}
                aria-label="Payment processing message"
                aria-live="polite"
                className="flex items-start gap-3 rounded-[14px] border border-line bg-paper2 px-5 py-4"
              >
                <Spinner aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-cobalt" />
                <div data-slot="promo-copy" className="space-y-1">
                  <p className="text-[15px] font-semibold text-ink">Processing Payment</p>
                  <p className="text-[13px] text-ink2">
                    We've received your payment and it's going through a final review. No need to
                    pay again — we'll confirm here as soon as it clears.
                  </p>
                </div>
              </section>
            ) : (
              <section
                data-section="promo-banner"
                data-status="succeeded"
                aria-label="Order confirmation message"
                className="flex items-start gap-3 rounded-[14px] border border-line2 bg-[#eaf0ff] px-5 py-4"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-paper">
                  <Icon.Check className="h-3 w-3" />
                </span>
                <div data-slot="promo-copy" className="space-y-1">
                  <p className="text-[15px] font-semibold text-ink">Order Confirmed</p>
                  <p className="text-[13px] text-ink2">
                    Your checkout is complete and your confirmation email is on the way.
                  </p>
                </div>
              </section>
            )}

            {showUpsell && upsellProduct && !isProcessing && (
              <>
                <UpsellOfferBanner
                  upsell={upsellProduct}
                  onClaim={() => setIsUpsellModalOpen(true)}
                />
                <UpsellCheckoutModal
                  upsell={upsellProduct}
                  context={context}
                  open={isUpsellModalOpen}
                  onClose={() => setIsUpsellModalOpen(false)}
                  onReceiptRefresh={refreshOrderContext}
                />
              </>
            )}

            <div
              data-section="thank-you-layout"
              className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start"
            >
              <section data-region="thank-you-main" className="flex flex-col gap-4">
                <SectionCard
                  section="thank-you-main-card"
                  data-status={state}
                  title={mainCardTitle}
                  titleClassName="text-[30px] leading-[1.05]"
                >
                  <p className="text-[13.5px] text-ink2">{mainCardSubtitle}</p>

                  <section className="mt-2 rule pt-4">
                    <h3 className="text-[15px] font-semibold tracking-tight text-ink">Order Details</h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <p data-slot="order-label" className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
                          Order Number
                        </p>
                        <p data-slot="order-number" className="mt-1 num text-[13.5px] text-ink">{orderNumber}</p>
                      </div>
                      <div>
                        <p data-slot="date-label" className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
                          Date
                        </p>
                        <p data-slot="order-date" className="mt-1 text-[13.5px] text-ink2">{formattedDate}</p>
                      </div>
                      <div>
                        <p data-slot="status-label" className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
                          Status
                        </p>
                        <p data-slot="order-status" className="mt-1 text-[13.5px] text-ink2">{paymentStatus}</p>
                      </div>
                    </div>
                  </section>

                  <section className="mt-2 rule pt-4">
                    <h3 className="text-[15px] font-semibold tracking-tight text-ink">
                      {thankYou.nextSteps.title}
                    </h3>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p data-slot="shipment-label" className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
                          Shipment
                        </p>
                        <p data-slot="shipment-value" className="mt-1 text-[13.5px] text-ink2">
                          You will receive a tracking email within 24 hours.
                        </p>
                      </div>
                      <div>
                        <p data-slot="support-label" className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
                          Support
                        </p>
                        <p data-slot="support-value" className="mt-1 text-[13.5px] text-ink2">
                          Need help? Reply to your confirmation email for priority support.
                        </p>
                      </div>
                    </div>
                  </section>
                </SectionCard>
              </section>

              <aside data-region="thank-you-summary" className="lg:sticky lg:top-[88px] lg:h-max">
                <SectionCard section="receipt-summary" title={thankYou.receipt.title}>
                  <div
                    data-slot="included-products-list"
                    className="rounded-[14px] border border-line bg-paper2 p-2.5"
                  >
                    {hasOrderItems ? (
                      orderItems.map((item) => {
                        const display = SKU_DISPLAY[item.sku];
                        const label = display?.name ?? item.description;
                        const image = display?.image ?? product.image;
                        const lineLabel =
                          item.quantity > 1 ? `${label} × ${item.quantity}` : label;
                        const rowKey = `${item.sku}-${item.chargePending ? "pending" : "confirmed"}`;
                        return (
                          <div
                            key={rowKey}
                            data-slot="included-product-item"
                            data-charge-pending={item.chargePending ? "true" : undefined}
                            className="my-[7px] flex items-center gap-2.5 text-[13px]"
                          >
                            <img
                              data-slot="included-product-thumb"
                              src={image.src}
                              alt={image.alt}
                              className="h-12 w-12 shrink-0 rounded-[10px] border border-line object-cover"
                            />
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-ink">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span>{lineLabel}</span>
                                {item.chargePending ? (
                                  <span
                                    data-slot="charge-pending-badge"
                                    className="rounded-full border border-line bg-paper2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rust"
                                  >
                                    Charge pending
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <strong data-slot="included-product-price" className="num shrink-0 text-ink">
                              {formatMoney(item.amountMinor, receiptCurrency)}
                            </strong>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        data-slot="included-product-item"
                        className="my-[7px] flex items-center gap-2.5 text-[13px]"
                      >
                        <img
                          data-slot="included-product-thumb"
                          src={product.image.src}
                          alt={product.image.alt}
                          className="h-12 w-12 shrink-0 rounded-[10px] border border-line object-cover"
                        />
                        <span className="flex-1 text-ink">{includedLabel}</span>
                        <strong data-slot="included-product-price" className="num text-ink">
                          {product.salePrice}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div
                    data-slot="included-products-title"
                    className="mt-1 text-[13px] font-semibold text-ink"
                  >
                    {summary.includedProductsTitle}
                  </div>

                  <div className="flex flex-col gap-2">
                    {hasOrderItems
                      ? orderItems.map((item) => {
                          const display = SKU_DISPLAY[item.sku];
                          const label = display?.name ?? item.description;
                          const lineLabel =
                            item.quantity > 1 ? `${label} × ${item.quantity}` : label;
                          const rowKey = `${item.sku}-${item.chargePending ? "pending" : "confirmed"}`;
                          return (
                            <PriceRow
                              key={rowKey}
                              data-slot="product-line"
                              data-charge-pending={item.chargePending ? "true" : undefined}
                              line={{
                                id: `item-${rowKey}`,
                                label: item.chargePending
                                  ? `${lineLabel} (charge pending)`
                                  : lineLabel,
                                value: formatMoney(item.amountMinor, receiptCurrency),
                              }}
                              className="my-2 text-[14px]"
                              labelClassName="text-ink2"
                              valueClassName="font-bold text-ink"
                            />
                          );
                        })
                      : (
                          <PriceRow
                            data-slot="product-line"
                            line={{
                              id: "product",
                              label: product.name,
                              value: product.salePrice,
                            }}
                            className="my-2 text-[14px]"
                            labelClassName="text-ink2"
                            valueClassName="font-bold text-ink"
                          />
                        )}
                    <PriceRow
                      data-slot="shipping-line"
                      line={summary.shipping}
                      className="my-2 text-[14px]"
                      labelClassName="text-ink2"
                    />
                    <PriceRow
                      data-slot="tax-line"
                      line={summary.tax}
                      className="my-2 text-[14px]"
                      labelClassName="text-ink2"
                    />
                    <PriceRow
                      data-slot="total-line"
                      line={{
                        id: "total",
                        label: summary.total.label,
                        value: formattedTotal,
                      }}
                      className="mt-3 border-t border-line pt-3 text-[20px]"
                      labelClassName="font-semibold text-ink uppercase tracking-[0.1em] text-[12px]"
                      valueClassName="text-[22px] font-semibold text-ink"
                    />

                    {hasPendingLineCharges ? (
                      <p data-slot="pending-charges-note" className="text-[11.5px] leading-snug text-ink3">
                        Items marked "charge pending" are on your receipt; your saved card will be
                        charged when your order is finalized.
                      </p>
                    ) : null}

                    <a href={thankYou.receipt.backToHomeHref} data-slot="cta-primary" className={ctaClassName}>
                      {thankYou.receipt.backToHomeLabel}
                    </a>

                    <div
                      data-slot="guarantee-note"
                      className="rounded-[12px] border border-line2 bg-[#eaf0ff] p-3 text-[12.5px] font-semibold text-ink2"
                    >
                      {thankYou.receipt.guaranteeNote}
                    </div>
                  </div>
                </SectionCard>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
