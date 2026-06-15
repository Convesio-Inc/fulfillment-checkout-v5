interface UrgencyBannerProps {
  timer: string;
}

export function UrgencyBanner({ timer }: UrgencyBannerProps) {
  return (
    <div
      data-section="urgency-banner"
      className="bg-[#c8620a] text-white text-[12px] font-semibold text-center py-[9px] px-4 tracking-[0.04em]"
    >
      HURRY — Order in the next{" "}
      <strong className="font-mono">{timer}</strong> to guarantee your 2 FREE
      bottles with the 3-bottle bundle.
    </div>
  );
}
