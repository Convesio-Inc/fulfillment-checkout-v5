export function SiteHeader() {
  return (
    <header className="bg-white border-b border-[#e4ddd2] sticky top-0 z-10">
      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Logo + brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1a3028] flex items-center justify-center text-[#7ab89a] text-sm flex-shrink-0">
            🌿
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#1a3028] tracking-[0.1em] leading-none uppercase">
              Your Brand
            </div>
            <div className="text-[9px] text-[#999] tracking-[0.12em] mt-0.5 uppercase">
              Est. 2019
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-5 text-[12px] text-[#555]">
          <a href="/product" className="hover:text-[#1a3028] transition-colors">Science</a>
          <a href="/product" className="hover:text-[#1a3028] transition-colors">Ingredients</a>
          <a href="/product" className="hover:text-[#1a3028] transition-colors">Reviews</a>
          <a href="/product" className="hover:text-[#1a3028] transition-colors">Guarantee</a>
        </nav>

        {/* Secure badge */}
        <span className="text-[11px] text-[#888] flex items-center gap-1">
          🔒 Secure checkout
        </span>
      </div>
    </header>
  );
}
