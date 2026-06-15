const INGREDIENTS = [
  "Spirulina",
  "Chlorella",
  "Ashwagandha KSM-66",
  "Reishi",
  "Beetroot",
  "Spinach",
  "Kale",
  "Matcha",
  "Turmeric",
  "Ginger",
  "L-Theanine",
  "Probiotic Blend",
];

export function IngredientsPanel() {
  return (
    <div
      data-section="ingredients"
      className="bg-[#1a3028] rounded-[10px] p-4 mb-3"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white">
          What's Inside
        </span>
        <span className="text-[11px] text-[#7ab89a] uppercase tracking-[0.08em]">
          32 Ingredients
        </span>
      </div>
      <div className="grid grid-cols-3 gap-y-[6px] gap-x-2">
        {INGREDIENTS.map((name) => (
          <span
            key={name}
            className="text-[11px] text-[#a8cdb8] flex items-center gap-1"
          >
            🌿 {name}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-[#7a9a8a] mt-2.5">
        + 20 more — full lab panel on the product page.
      </p>
    </div>
  );
}
