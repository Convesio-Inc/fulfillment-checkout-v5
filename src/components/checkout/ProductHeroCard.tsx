const TRUST_BADGES = ["NSF Certified", "Non-GMO", "Vegan", "Made in Oregon"];

export function ProductHeroCard() {
  return (
    <div
      data-section="product-hero"
      className="bg-white rounded-[10px] p-[18px] mb-3 flex gap-4 items-start"
    >
      <img
        src="/product-image.jpeg"
        alt="Product photo"
        className="w-[90px] h-[120px] object-cover rounded-[8px] flex-shrink-0"
      />
      <div className="flex-1">
        <div className="text-[10px] text-[#999] uppercase tracking-[0.1em] mb-1.5">
          Step 1 of 1 · Build your order
        </div>
        <h1 className="text-[24px] font-black text-[#1a3028] leading-[1.1] mb-2">
          Vitamin Essentials{" "}
          <em className="font-light italic">Complex</em>
        </h1>
        <p className="text-[13px] text-[#555] leading-[1.6] mb-3">
          One scoop replaces the entire morning supplement stack — 32 organic
          plants, adaptogens, and digestive enzymes clinically dosed for
          daily energy and resilience.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge}
              className="text-[11px] text-[#3a6a4a] font-medium flex items-center gap-1"
            >
              ✓ {badge}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
