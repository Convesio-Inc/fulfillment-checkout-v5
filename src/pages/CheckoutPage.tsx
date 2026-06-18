import { useCallback, useRef, useState } from "react";

import {
  CustomerInfo,
  type CustomerInfoValue,
} from "@/components/checkout/CustomerInfo";
import { OrderSummaryCard } from "@/components/checkout/OrderSummaryCard";
import { PaymentInfo } from "@/components/checkout/PaymentInfo";
import { PaymentStatusDialog } from "@/components/checkout/PaymentStatusDialog";
import {
  ShippingInfo,
  type ShippingInfoValue,
} from "@/components/checkout/ShippingInfo";
import { BundleSelector } from "@/components/checkout/BundleSelector";
import { BUNDLES, bundlePricing, type Bundle } from "@/components/checkout/bundles";
import { Step } from "@/components/checkout/form-atoms";
import { Icon } from "@/components/icons";
import { useCheckoutPayment } from "@/hooks/useCheckoutPayment";

const PRODUCT_SKU = "1234567890";
const PRODUCT_NAME = "Daily Greens Complex";
const CURRENCY = "USD";

const INITIAL_CUSTOMER: CustomerInfoValue = { email: "", phoneNumber: "" };

const INITIAL_SHIPPING: ShippingInfoValue = {
  firstName: "",
  lastName: "",
  street: "",
  aptSuite: "",
  city: "",
  stateOrProvince: "",
  zip: "",
  country: "US",
};

const TRUST = [
  { k: "TLS 1.3", v: "256-bit encrypted", icon: <Icon.Lock className="w-3.5 h-3.5" /> },
  { k: "PCI DSS · L1", v: "Card data certified", icon: <Icon.Shield className="w-3.5 h-3.5" /> },
  { k: "4.86 · 12.4k", v: "Verified reviews", icon: <Icon.Star className="w-3.5 h-3.5 text-cobalt" /> },
  { k: "Lab tested", v: "3rd-party, COA", icon: <Icon.Beaker className="w-3.5 h-3.5" /> },
];

export function CheckoutPage() {
  const [customer, setCustomer] = useState<CustomerInfoValue>(INITIAL_CUSTOMER);
  const [shipping, setShipping] = useState<ShippingInfoValue>(INITIAL_SHIPPING);
  const [isPaymentValid, setIsPaymentValid] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle>(
    BUNDLES.find((b) => b.isMostChosen) ?? BUNDLES[0],
  );
  const [subscribe, setSubscribe] = useState(true);
  const pricing = bundlePricing(selectedBundle, subscribe);

  const componentRef = useRef<ConvesioPayComponent | null>(null);
  const handleComponentReady = useCallback((c: ConvesioPayComponent) => {
    componentRef.current = c;
  }, []);

  const { status, error, result, pay, reset } = useCheckoutPayment();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!componentRef.current) return;
    if (status === "processing") return;

    const address = {
      houseNumberOrName: shipping.aptSuite,
      street: shipping.street,
      city: shipping.city,
      stateOrProvince: shipping.stateOrProvince,
      postalCode: shipping.zip,
      country: shipping.country,
    };

    await pay(componentRef.current, {
      email: customer.email,
      name: `${shipping.firstName} ${shipping.lastName}`.trim(),
      amount: pricing.totalMinor,
      currency: CURRENCY,
      phone: { number: customer.phoneNumber, countryCode: "1" },
      billingAddress: address,
      shippingAddress: address,
      lineItems: [
        {
          sku: PRODUCT_SKU,
          description: PRODUCT_NAME,
          quantity: selectedBundle.bottleCount,
          amountIncludingTax: pricing.totalMinor,
        },
      ],
    });
  };

  const isProcessing = status === "processing";
  const totalFmt = `$${(pricing.totalMinor / 100).toFixed(2)}`;

  return (
    <main data-page="checkout" className="min-h-screen">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-y-2">
          <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-none text-ink">
            Checkout.
          </h1>
          <span className="text-[12px] text-ink3">
            Need help?{" "}
            <a className="text-cobalt hover:underline" href="#">
              care@meridian.co
            </a>
          </span>
        </div>
        <p className="text-[14px] text-ink2 mt-3 max-w-[58ch] leading-relaxed font-light">
          One unhurried scoop. 32 organic plants, adaptogens &amp; enzymes. Third-party tested,
          shipped from Portland in compostable packaging.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-7 bg-paper rounded-[20px] border border-line shadow-[0_1px_0_rgba(10,11,13,0.02),0_20px_42px_-26px_rgba(10,11,13,0.18)] overflow-hidden"
        >
          <div className="px-6">
            <Step
              n="1"
              title="Your supply"
              summaryRight={
                <span className="num text-[12px] text-ink whitespace-nowrap">
                  <span className="text-ink3 smallcaps mr-2">{selectedBundle.bottleCount}× · {subscribe ? "monthly" : "one-time"}</span>
                  {totalFmt}
                </span>
              }
            >
              <BundleSelector
                value={selectedBundle}
                onChange={setSelectedBundle}
                subscribe={subscribe}
                onSubscribeChange={setSubscribe}
              />
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink3">
                <span className="inline-flex items-center gap-1.5"><Icon.Check className="w-3 h-3 text-mint" /> Free shipping</span>
                <span className="inline-flex items-center gap-1.5"><Icon.Check className="w-3 h-3 text-mint" /> 90-day return</span>
                <span className="inline-flex items-center gap-1.5"><Icon.Check className="w-3 h-3 text-mint" /> Cancel anytime</span>
              </div>
            </Step>
          </div>

          <div className="px-6">
            <Step n="2" title="Contact">
              <CustomerInfo value={customer} onChange={setCustomer} />
            </Step>
          </div>

          <div className="px-6">
            <Step n="3" title="Ships to">
              <ShippingInfo value={shipping} onChange={setShipping} />
            </Step>
          </div>

          <div className="px-6">
            <Step
              n="4"
              title="Payment"
              summaryRight={
                <span className="num text-[10.5px] text-ink3 tracking-[0.1em] hidden sm:inline">VISA · MC · AMEX</span>
              }
            >
              <PaymentInfo
                customerEmail={customer.email || undefined}
                onValidityChange={setIsPaymentValid}
                onComponentReady={handleComponentReady}
              />
            </Step>
          </div>

          <div className="px-6">
            <OrderSummaryCard
              selectedBundle={selectedBundle}
              subscribe={subscribe}
              payDisabled={!isPaymentValid}
              payLoading={isProcessing}
            />
          </div>
        </form>

        {/* Trust strip */}
        <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
          {TRUST.map((t) => (
            <div key={t.k} className="bg-paper border border-line2 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
              <span className="text-ink2">{t.icon}</span>
              <span className="leading-tight">
                <span className="block text-ink font-medium">{t.k}</span>
                <span className="block text-ink3 text-[10.5px]">{t.v}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <PaymentStatusDialog status={status} error={error} result={result} onClose={reset} />
    </main>
  );
}
