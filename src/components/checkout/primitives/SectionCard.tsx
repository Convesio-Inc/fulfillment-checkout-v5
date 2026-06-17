/**
 * SectionCard
 * -----------------------------------------------------------------------------
 * Shared white "gloss" card with an optional titled header. Used by the
 * thank-you page surfaces. Title renders in the Instrument Serif display face
 * by default; pass `titleClassName` to override.
 *
 * Markers:
 *   - root             data-section="<section>" + data-slot="section-card"
 *   - title            data-slot="section-title"
 * -----------------------------------------------------------------------------
 */

import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionCardProps extends React.ComponentProps<"section"> {
  section: string;
  title?: string;
  titleClassName?: string;
}

export function SectionCard({
  section,
  title,
  titleClassName,
  className,
  children,
  ...rest
}: SectionCardProps) {
  return (
    <section
      data-section={section}
      data-slot="section-card"
      className={cn(
        "bg-paper border border-line rounded-[20px] overflow-hidden shadow-[0_1px_0_rgba(10,11,13,0.02),0_20px_42px_-26px_rgba(10,11,13,0.18)]",
        className,
      )}
      {...rest}
    >
      {title ? (
        <header className="px-5 sm:px-6 pt-5 pb-4 border-b border-line2">
          <h2
            data-slot="section-title"
            className={cn("text-[24px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink", titleClassName)}
          >
            {title}
          </h2>
        </header>
      ) : null}
      <div className="px-5 sm:px-6 py-5">
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </section>
  );
}
