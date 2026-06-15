const BADGES = [
  { icon: "🔒", title: "SSL 256", sub: "ENCRYPT." },
  { icon: "💳", title: "PCI Com.", sub: "LEVEL 1" },
  { icon: "✓", title: "Verified", sub: "SINCE '19" },
  { icon: "🔐", title: "Privacy", sub: "NO RESALE" },
];

export function SecurityBadges() {
  return (
    <div data-section="security-badges" className="grid grid-cols-4 gap-1.5">
      {BADGES.map((b) => (
        <div
          key={b.title}
          className="bg-[#fafaf8] border border-[#e8e0d4] rounded-[6px] p-1.5 text-center"
        >
          <div className="text-[13px]">{b.icon}</div>
          <div className="text-[8px] font-semibold text-[#555] leading-[1.4] mt-0.5">
            {b.title}
            <br />
            {b.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
