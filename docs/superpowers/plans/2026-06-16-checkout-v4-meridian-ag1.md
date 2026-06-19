# Checkout v4 — MERIDIAN (AG1) Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `fulfillment-checkout-v4` as its own Cloudflare Worker + empty D1 database with updated docs/remote, and re-skin the storefront (CheckoutPage full rework, ThankYouPage restyle, shared chrome) to match the MERIDIAN AG1 reference — warm sand/paper/lime, single-column accordion — preserving all payment/fulfillment behavior.

**Architecture:** React 19 + Vite SPA served by a single Cloudflare Worker. The checkout is a single controlled `<form>` whose visual sections are styled `<details>` accordions; pricing comes from `bundles.ts`; payment runs through the existing `useCheckoutPayment` + ConvesioPay iframe. Styling is Tailwind v4 with palette tokens + helper classes in `src/index.css`. The dashboard/login app shell (shadcn oklch tokens) is untouched.

**Tech Stack:** React 19, React Router 7, Vite 8, Tailwind CSS v4, Cloudflare Workers + Wrangler 4, D1, Drizzle, ConvesioPay SDK.

**Reference files:** spec `docs/superpowers/specs/2026-06-16-checkout-v4-meridian-ag1-design.md`; sample `Checkout v4 - AG1.html` (in `~/Downloads/Checkout iteration/`).

**No unit-test harness exists.** Verification per task = `npm run build` (tsc + vite) and `npm run lint` clean; visual/behavioral verification via `npm run preview` + browser preview tools at the end. Commit after each task.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `wrangler.jsonc` | modify | Worker name + D1 name/id → v4 |
| `package.json` | modify | db:migrate scripts → v4 |
| `README.md`, `AGENTS.md`, `CLAUDE.md` | modify | v2 → v4 references |
| `src/index.css` | modify | Add AG1 palette tokens + helper classes |
| `src/components/icons.tsx` | modify | Add `Mail`, `Pin`, `Caret`, `Beaker` |
| `src/components/site/UrgencyRail.tsx` | rewrite | Single sand top rail (keeps export name) |
| `src/layouts/ShopLayout.tsx` | modify | Drop SiteHeader, bg-sand |
| `src/components/site/SiteFooter.tsx` | rewrite | Centered one-line footer |
| `src/components/checkout/form-atoms.tsx` | rewrite | `Field` (+icon), `Step` accordion, `inputCls` |
| `src/components/checkout/BundleSelector.tsx` | rewrite | Segmented toggle + 3 plan cards |
| `src/components/checkout/CustomerInfo.tsx` | rewrite | Email/phone + SMS checkbox, new Field |
| `src/components/checkout/ShippingInfo.tsx` | rewrite | Address fields, new Field |
| `src/components/checkout/PaymentInfo.tsx` | rewrite | ConvesioPay box, AG1 styling |
| `src/components/checkout/OrderSummaryCard.tsx` | rewrite | Summary + lime `.cta` |
| `src/pages/CheckoutPage.tsx` | rewrite | Single-column accordion assembly + trust strip |
| `src/components/checkout/primitives/SectionCard.tsx` | modify | Paper card, Geist title |
| `src/pages/ThankYouPage.tsx` | modify | Restyle classNames to AG1 palette |
| Deleted (unreferenced after rework) | delete | `ProductHeroCard`, `GuaranteeCard`, `ReviewsSection`, `IngredientsPanel`, `Bottle`, `Seal`, `SecurityBadges` |

---

## Phase 1 — Infrastructure

### Task 1: Repoint git remote

**Files:** none (git config only)

- [ ] **Step 1: Set the new origin URL**

```bash
git remote set-url origin git@github.com:Convesio-Inc/fulfillment-checkout-v4.git
git remote -v
```
Expected: both fetch/push show `git@github.com:Convesio-Inc/fulfillment-checkout-v4.git`.

- [ ] **Step 2: Verify the remote is reachable**

```bash
git ls-remote origin 2>&1 | head -3
```
Expected: a list of refs (repo exists and SSH auth works). If it errors with "Repository not found", stop and tell the user.

### Task 2: New D1 database + wrangler/package config

**Files:**
- Modify: `wrangler.jsonc`
- Modify: `package.json`

- [ ] **Step 1: Create the new D1 database**

```bash
npx wrangler d1 create fulfillment-checkout-v4
```
Expected: prints a `database_id` (a UUID). **Copy it** — it's needed in Step 2. Example output contains:
```
"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

- [ ] **Step 2: Update `wrangler.jsonc`** — change the worker name and the D1 block.

Change the name line:
```jsonc
	"name": "fulfillment-checkout-v4",
```
Change the `d1_databases` block (use the id from Step 1):
```jsonc
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "fulfillment-checkout-v4",
			"database_id": "<DATABASE_ID_FROM_STEP_1>",
			"migrations_dir": "worker/db/migrations"
		}
	],
```
Leave `secrets.required: []` as-is (bootstrap state) — it is restored in Task 16.

- [ ] **Step 3: Update `package.json` db scripts**

```json
    "db:migrate": "wrangler d1 migrations apply fulfillment-checkout-v4 --local",
    "db:migrate:remote": "wrangler d1 migrations apply fulfillment-checkout-v4 --remote",
```

- [ ] **Step 4: Regenerate worker types & verify config parses**

```bash
npx wrangler types
```
Expected: completes without error (writes `worker-configuration.d.ts`).

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc package.json worker-configuration.d.ts
git commit -m "chore: point worker + D1 at fulfillment-checkout-v4"
```

### Task 3: Apply migrations to the new databases

**Files:** none (D1 state)

- [ ] **Step 1: Apply migrations to the local D1**

```bash
npm run db:migrate
```
Expected: applies `0001_init.sql`; prints success. Creates `.wrangler/state` local DB.

- [ ] **Step 2: Apply migrations to the remote D1**

```bash
npm run db:migrate:remote
```
Expected: prompts/automatically applies `0001_init.sql` to the remote `fulfillment-checkout-v4` DB; reports success. (No commit — this changes remote state only.)

### Task 4: Update docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace v2 references in `README.md` and `AGENTS.md`**

Replace every occurrence of `fulfillment-checkout-v2` with `fulfillment-checkout-v4` in both files (worker name, D1 db name `db name fulfillment-checkout-v2`, and the GitHub repo URL if present). Use:
```bash
sed -i 's/fulfillment-checkout-v2/fulfillment-checkout-v4/g' README.md AGENTS.md
grep -rn "checkout-v2" README.md AGENTS.md
```
Expected: the grep returns nothing.

- [ ] **Step 2: Remove the stale `/product` route row in `AGENTS.md`**

In `AGENTS.md`, find the "Frontend routes" table and delete the row:
```
| `/product`                      | `ProductPage`  | `ShopLayout`      | public                                           |
```
(There is no `ProductPage.tsx`.) Verify:
```bash
grep -n "ProductPage" AGENTS.md
```
Expected: no matches.

- [ ] **Step 3: Sanity-check `CLAUDE.md`**

`CLAUDE.md` only points at `AGENTS.md`; confirm it has no `checkout-v2` string:
```bash
grep -n "checkout-v2" CLAUDE.md || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md CLAUDE.md
git commit -m "docs: update references from checkout-v2 to checkout-v4"
```

---

## Phase 2 — Design system

### Task 5: Add AG1 palette tokens + helper classes (`src/index.css`)

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add the AG1 palette tokens** inside the `@theme inline { … }` block, immediately after the existing `--color-gold2: #8d6a2a;` line:

```css
    /* === AG1 WARM PALETTE (Checkout v4 reference) === */
    --color-sand: #eddfc4;
    --color-sand2: #e4d3ad;
    --color-paper: #fbf3dd;
    --color-paper2: #f7eece;
    --color-ink: #0a0b0d;
    --color-ink2: #2a2b25;
    --color-ink3: #65665d;
    --color-ink4: #a09d8c;
    --color-line: #d4c69f;
    --color-line2: #e3d5b1;
    --color-lime: #cde04a;
    --color-lime2: #aec33a;
    --color-lime3: #e6f08b;
    --color-rust: #b04923;
```

Note: these redefine `--color-ink/ink2/ink3/line/line2/paper/rust` (which already exist with cooler values) to the warm AG1 values, and add `sand/sand2/paper2/ink4/lime/lime2/lime3`. The dashboard relies on the shadcn `:root` oklch tokens, not these, so it is unaffected (verified in Task 15).

- [ ] **Step 2: Update `.rule` and add the AG1 helper classes.** Replace the existing `.rule { border-top: 1px solid #ece5d2; }` line with the block below (which updates `.rule` and appends all new helpers). Place it right after the `.stripes { … }` rule:

```css
.rule { border-top: 1px solid #e3d5b1; }

/* === AG1 helpers (Checkout v4) === */
.smallcaps { text-transform: uppercase; letter-spacing: 0.14em; font-size: 10.5px; font-weight: 500; }
.strike { text-decoration: line-through; text-decoration-thickness: 1px; color: #a09d8c; }
::selection { background: #cde04a; color: #0a0b0d; }

/* Warm-paper inputs (checkout only — class-scoped, dashboard untouched) */
.ck-input {
  font-family: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  background: #fbf3dd;
  border: 1px solid #d4c69f;
  width: 100%;
  padding: 13px 14px;
  font-size: 14.5px;
  color: #0a0b0d;
  border-radius: 12px;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.ck-input::placeholder { color: #a09d8c; }
.ck-input:focus {
  outline: none;
  border-color: #0a0b0d;
  box-shadow: 0 0 0 4px rgba(10, 11, 13, 0.08);
  background: #fff8e2;
}
select.ck-input {
  appearance: none; -webkit-appearance: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%230a0b0d' stroke-width='1.4' stroke-linecap='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 14px center;
  padding-right: 36px;
}

/* Segmented control */
.seg-track { background: #e4d3ad; border: 1px solid #d4c69f; border-radius: 999px; padding: 4px; }
.seg-on { background: #0a0b0d; color: #fbf3dd; border-radius: 999px; }
.seg-on-lime { background: #cde04a; color: #0a0b0d; border-radius: 999px; }

/* Plan card */
.plan {
  background: #fbf3dd; border: 1px solid #d4c69f; border-radius: 16px;
  transition: border-color .15s ease, transform .12s ease, box-shadow .15s ease, background .15s ease;
}
.plan:hover:not(.on) { border-color: #0a0b0d; transform: translateY(-1px); }
.plan.on { background: #0a0b0d; color: #fbf3dd; border-color: #0a0b0d; box-shadow: 0 14px 28px -16px rgba(10,11,13,0.4); }
.plan .ringdot {
  width: 18px; height: 18px; border-radius: 999px; border: 1.5px solid #c8b993;
  display: inline-flex; align-items: center; justify-content: center;
  transition: border-color .15s ease, background .15s ease; position: relative;
}
.plan.on .ringdot { border-color: #cde04a; background: #cde04a; }
.plan.on .ringdot::after { content: ''; width: 6px; height: 6px; border-radius: 999px; background: #0a0b0d; }

/* Save chip */
.save-chip {
  background: #cde04a; color: #0a0b0d; border-radius: 999px;
  padding: 2px 8px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em;
}

/* Accordion step */
details.step { border-bottom: 1px solid #e3d5b1; padding: 22px 0; }
details.step:last-child { border-bottom: 0; }
details.step[open] summary .caret { transform: rotate(180deg); }
details.step summary { list-style: none; cursor: pointer; }
details.step summary::-webkit-details-marker { display: none; }
.caret { transition: transform .2s ease; }

/* Lime CTA + state machine */
.cta {
  position: relative; background: #cde04a; color: #0a0b0d; border-radius: 999px;
  box-shadow:
    0 1px 0 rgba(255,255,255,0.45) inset,
    0 -1px 0 rgba(0,0,0,0.1) inset,
    0 1px 2px rgba(10,11,13,0.08),
    0 12px 24px -10px rgba(174,195,58,0.45);
  overflow: hidden;
  transition: transform .14s cubic-bezier(.2,.7,.2,1), background .15s ease, box-shadow .14s ease;
  -webkit-tap-highlight-color: transparent;
}
.cta:hover:not(:disabled) { background: #d8e966; }
.cta:active:not(:disabled) {
  transform: translateY(1px) scale(.995); background: #b9cc3d;
  box-shadow: 0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.1) inset, 0 4px 10px -4px rgba(10,11,13,0.2);
}
.cta:disabled { filter: saturate(0.55) brightness(0.99); cursor: not-allowed; }
.cta .arrow-slot {
  width: 32px; height: 32px; border-radius: 999px; background: rgba(10,11,13,0.10);
  display: inline-flex; align-items: center; justify-content: center;
  transition: transform .25s cubic-bezier(.2,.7,.2,1), background .15s ease;
}
.cta:hover:not(:disabled) .arrow-slot { transform: translateX(3px); background: rgba(10,11,13,0.18); }
.spinner { width: 16px; height: 16px; border-radius: 999px; border: 2px solid rgba(10,11,13,0.2); border-top-color: #0a0b0d; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes drawcheck { 0% { stroke-dashoffset: 30; opacity: 0; transform: scale(.7); } 20% { opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 1; transform: scale(1); } }
.check-anim path { stroke-dasharray: 30; stroke-dashoffset: 30; animation: drawcheck .5s cubic-bezier(.2,.7,.2,1) .1s forwards; }
.cta .cta-label { transition: opacity .2s ease, transform .2s ease; }
.cta[data-state="idle"] .cta-label { opacity: 1; transform: translateY(0); }
.cta[data-state="busy"] .cta-label, .cta[data-state="done"] .cta-label { opacity: 0; transform: translateY(-2px); }
.cta .cta-busy, .cta .cta-done {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 12px;
  opacity: 0; transform: translateY(2px); transition: opacity .2s ease, transform .2s ease; pointer-events: none;
}
.cta[data-state="busy"] .cta-busy { opacity: 1; transform: translateY(0); }
.cta[data-state="done"] { background: #0a8a55; color: #ffffff; }
.cta[data-state="done"] .cta-done { opacity: 1; transform: translateY(0); }
```

- [ ] **Step 3: Verify build is still clean**

Run: `npm run build`
Expected: PASS (no TS/CSS errors). CSS-only additions can't break TS but confirm Vite compiles.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat: add AG1 warm palette tokens and helper classes"
```

### Task 6: Add missing icons (`src/components/icons.tsx`)

**Files:**
- Modify: `src/components/icons.tsx`

- [ ] **Step 1: Add four icons** to the `Icon` object (insert before the closing `};`):

```tsx
  Mail: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </svg>
  ),
  Pin: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  Caret: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  Beaker: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" />
      <path d="M7.5 14h9" />
    </svg>
  ),
```

- [ ] **Step 2: Build + commit**

```bash
npm run build && git add src/components/icons.tsx && git commit -m "feat: add Mail, Pin, Caret, Beaker icons"
```
Expected: build PASS.

---

## Phase 3 — Shared chrome

### Task 7: Top rail, ShopLayout, footer

**Files:**
- Rewrite: `src/components/site/UrgencyRail.tsx`
- Modify: `src/layouts/ShopLayout.tsx`
- Rewrite: `src/components/site/SiteFooter.tsx`

- [ ] **Step 1: Rewrite `UrgencyRail.tsx`** (keeps the `UrgencyRail` export so ShopLayout's import is unchanged):

```tsx
/**
 * UrgencyRail
 * -----------------------------------------------------------------------------
 * Sticky AG1 top rail across the storefront: brand mark on the left; live
 * "N at checkout", a secure marker, and a "Reserved mm:ss" countdown on the
 * right. Self-contained — owns its own countdown + viewer counter.
 *
 * Markers:
 *   - root            data-section="top-rail"
 *   - reserved timer  data-slot="reserved-timer"
 * -----------------------------------------------------------------------------
 */

import { Icon } from "@/components/icons";
import { useCountdown, useViewers } from "@/hooks/useStorefrontUrgency";

export function UrgencyRail() {
  const { mm, ss } = useCountdown(5 * 60);
  const viewers = useViewers();

  return (
    <div
      data-section="top-rail"
      className="sticky top-0 z-40 bg-sand border-b border-line2"
    >
      <div className="max-w-[1080px] mx-auto px-6 h-12 flex items-center justify-between text-[12px]">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-ink text-paper grid place-items-center">
            <Icon.Beaker className="w-4 h-4" />
          </div>
          <span className="font-semibold tracking-[0.08em] text-ink">MERIDIAN</span>
          <span className="hidden sm:inline text-ink3 smallcaps">Daily greens</span>
        </a>
        <div className="flex items-center gap-5">
          <span className="hidden md:flex items-center gap-2 text-ink3">
            <span className="livedot inline-flex w-1.5 h-1.5 rounded-full bg-rust" />
            <span><span className="num text-ink">{viewers}</span> at checkout</span>
          </span>
          <span className="hidden sm:flex items-center gap-1.5 text-ink3 smallcaps">
            <Icon.Lock className="w-3.5 h-3.5" /> Secure
          </span>
          <span className="num text-[12.5px] text-ink">
            <span className="text-ink3 smallcaps mr-2">Reserved</span>
            <span data-slot="reserved-timer">
              {mm}<span className="tick text-ink3">:</span>{ss}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `ShopLayout.tsx`** — drop the `SiteHeader`, use `bg-sand`:

```tsx
import { Outlet } from "react-router";

import { SiteFooter } from "@/components/site";
import { UrgencyRail } from "@/components/site/UrgencyRail";
import { LoggedInBar } from "@/components/site/LoggedInBar";
import { useAuth } from "@/hooks/useAuth";

export function ShopLayout() {
  const { status } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col bg-sand text-ink">
      <UrgencyRail />
      {status === "authenticated" && <LoggedInBar />}
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `SiteFooter.tsx`** — centered one-line AG1 footer:

```tsx
/**
 * SiteFooter
 * -----------------------------------------------------------------------------
 * Quiet AG1 storefront footer: a single centered line with copyright, address,
 * and policy links. Shared by the storefront pages (Checkout, Thank You).
 * -----------------------------------------------------------------------------
 */

export function SiteFooter() {
  return (
    <footer className="mt-8 pb-10">
      <div className="max-w-[720px] mx-auto px-6 text-center text-[11px] text-ink3">
        © 2026 Meridian Botanicals · 126 SE Stark Street, Portland, OR ·{" "}
        <a href="#" className="hover:text-ink">Privacy</a> ·{" "}
        <a href="#" className="hover:text-ink">Terms</a> ·{" "}
        <a href="#" className="hover:text-ink">Refunds</a>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Confirm `SiteFooter` is still exported from the site barrel**

Run: `grep -n "SiteFooter" src/components/site/index.tsx`
Expected: a line exporting `SiteFooter`. If `SiteHeader` is also exported there it can stay (unused import removed only from ShopLayout). No change needed unless the grep shows `SiteFooter` is missing — then add `export { SiteFooter } from "./SiteFooter";`.

- [ ] **Step 5: Build + commit**

```bash
npm run build && git add src/components/site/UrgencyRail.tsx src/layouts/ShopLayout.tsx src/components/site/SiteFooter.tsx && git commit -m "feat: AG1 top rail, footer, and ShopLayout chrome"
```
Expected: build PASS.

---

## Phase 4 — Checkout components

### Task 8: form-atoms — Field (+icon), Step accordion, inputCls

**Files:**
- Rewrite: `src/components/checkout/form-atoms.tsx`

- [ ] **Step 1: Rewrite `form-atoms.tsx`:**

```tsx
/**
 * form-atoms
 * -----------------------------------------------------------------------------
 * Shared building blocks for the AG1 checkout form: the smallcaps-labelled
 * `Field` wrapper (with optional leading icon), the numbered `Step` accordion,
 * and the `inputCls` string applied to every text input / select.
 * -----------------------------------------------------------------------------
 */

import * as React from "react";

import { Icon } from "@/components/icons";

export const inputCls = "ck-input";

export interface FieldProps {
  label: string;
  children: React.ReactElement<{ style?: React.CSSProperties }>;
  /** Tailwind grid-span class. Defaults to full width within a 2-col grid. */
  span?: string;
  optional?: boolean;
  hint?: string;
  /** Leading icon rendered inside the input well. */
  icon?: React.ReactNode;
  /** Stable field marker (data-field). */
  dataField?: string;
}

export function Field({
  label,
  children,
  span = "col-span-2",
  optional = false,
  hint,
  icon,
  dataField,
}: FieldProps) {
  return (
    <label className={"block " + span} data-field={dataField}>
      <span className="smallcaps text-ink3 flex items-baseline justify-between">
        <span>{label}</span>
        {optional && <span className="normal-case tracking-normal text-[10px] text-ink4">optional</span>}
        {hint && !optional && <span className="normal-case tracking-normal text-[10px] text-ink4">{hint}</span>}
      </span>
      <span className="block mt-1.5 relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink3 pointer-events-none">
            {icon}
          </span>
        )}
        {icon
          ? React.cloneElement(children, { style: { ...children.props.style, paddingLeft: 38 } })
          : children}
      </span>
    </label>
  );
}

export interface StepProps {
  n: string;
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  summaryRight?: React.ReactNode;
  children: React.ReactNode;
}

export function Step({ n, title, icon, defaultOpen = true, summaryRight, children }: StepProps) {
  return (
    <details className="step" open={defaultOpen}>
      <summary className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="num text-[11px] w-6 h-6 inline-flex items-center justify-center rounded-full bg-ink text-paper">
            {n}
          </span>
          <span className="text-[15.5px] font-semibold tracking-tight text-ink">{title}</span>
          {icon}
        </div>
        <div className="flex items-center gap-3 text-ink3">
          {summaryRight}
          <Icon.Caret className="caret w-4 h-4" />
        </div>
      </summary>
      <div className="pt-5">{children}</div>
    </details>
  );
}
```

- [ ] **Step 2: Build** (will fail at `CheckoutPage`/`CustomerInfo` etc. that still import the old `SectionHead` — that is expected and resolved in later tasks). Just confirm `form-atoms.tsx` itself has no type error by checking the error list does not reference `form-atoms.tsx`.

Run: `npm run build 2>&1 | grep -i "form-atoms" || echo "form-atoms OK"`
Expected: `form-atoms OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/checkout/form-atoms.tsx
git commit -m "feat: AG1 Field (with icon) and Step accordion atoms"
```

### Task 9: BundleSelector — segmented toggle + plan cards

**Files:**
- Rewrite: `src/components/checkout/BundleSelector.tsx`

- [ ] **Step 1: Rewrite `BundleSelector.tsx`:**

```tsx
/**
 * BundleSelector
 * -----------------------------------------------------------------------------
 * AG1 supply picker: a One-time / Subscribe segmented toggle (Subscribe is
 * disabled — cosmetic only) above three plan cards. One-time is the only
 * functional path; selecting a card calls onChange(bundle) and the parent
 * drives the charge amount from the selection.
 *
 * Markers:
 *   - root          data-section="bundle-selector"
 *   - each card     data-section="bundle-card" + data-bundle-id
 * -----------------------------------------------------------------------------
 */

import { type Bundle, BUNDLES } from "./bundles";

const LIST_PER_BOTTLE = 49; // compare-at $/bottle for the strike price

function PlanCard({
  bundle,
  selected,
  onSelect,
}: {
  bundle: Bundle;
  selected: boolean;
  onSelect: () => void;
}) {
  const featured = Boolean(bundle.isMostChosen);
  const list = LIST_PER_BOTTLE * bundle.bottleCount;
  const total = bundle.totalAmountMinor / 100;
  const save = bundle.savingsMinor ? bundle.savingsMinor / 100 : 0;

  return (
    <button
      type="button"
      data-section="bundle-card"
      data-bundle-id={bundle.id}
      aria-pressed={selected}
      onClick={onSelect}
      className={"plan relative text-left p-4 pt-5 " + (selected ? "on" : "")}
    >
      {featured && (
        <span className="save-chip absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          Best value
        </span>
      )}
      <div className="flex items-start justify-between">
        <span className="ringdot mt-0.5" />
        {save > 0 ? (
          <span className={"num text-[10.5px] font-semibold whitespace-nowrap " + (selected ? "text-lime" : "text-rust")}>
            Save ${save.toFixed(0)}
          </span>
        ) : (
          <span className="text-[10.5px]">&nbsp;</span>
        )}
      </div>
      <div className="mt-3">
        <div className={"text-[13px] font-medium whitespace-nowrap " + (selected ? "text-sand/80" : "text-ink2")}>
          {bundle.bottleCount} bottle{bundle.bottleCount > 1 ? "s" : ""}
        </div>
        <div className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
          <span className={"num text-[24px] leading-none font-medium tracking-tight " + (selected ? "text-sand" : "text-ink")}>
            ${bundle.pricePerBottle.toFixed(2)}
          </span>
          <span className={"text-[10.5px] " + (selected ? "text-sand/60" : "text-ink3")}>/bottle</span>
        </div>
        <div className="mt-1.5 text-[11px] num whitespace-nowrap">
          <span className={"strike mr-1 " + (selected ? "!text-sand/40" : "")}>${list.toFixed(2)}</span>
          <span className={selected ? "text-sand/80" : "text-ink2"}>${total.toFixed(2)}</span>
        </div>
        <div className={"mt-1.5 text-[11px] whitespace-nowrap " + (selected ? "text-sand/60" : "text-ink3")}>
          {bundle.supplyLabel}
        </div>
      </div>
    </button>
  );
}

export interface BundleSelectorProps {
  value: Bundle;
  onChange: (bundle: Bundle) => void;
}

export function BundleSelector({ value, onChange }: BundleSelectorProps) {
  const ordered = [...BUNDLES].sort((a, b) => a.bottleCount - b.bottleCount);

  return (
    <div data-section="bundle-selector">
      {/* One-time / Subscribe toggle (Subscribe disabled — cosmetic only) */}
      <div className="mb-4">
        <div className="seg-track flex items-center w-full text-[13px] font-medium">
          <button type="button" className="flex-1 py-2.5 seg-on">
            One-time
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="flex-1 py-2.5 flex items-center justify-center gap-2 text-ink4 cursor-not-allowed"
          >
            Subscribe
            <span className="num text-[10.5px] font-semibold text-rust">−20%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {ordered.map((bundle) => (
          <PlanCard
            key={bundle.id}
            bundle={bundle}
            selected={value.id === bundle.id}
            onSelect={() => onChange(bundle)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check (BundleSelector only)**

Run: `npm run build 2>&1 | grep -i "BundleSelector" || echo "BundleSelector OK"`
Expected: `BundleSelector OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/checkout/BundleSelector.tsx
git commit -m "feat: AG1 bundle plan cards + cosmetic subscribe toggle"
```

### Task 10: CustomerInfo + ShippingInfo restyle

**Files:**
- Rewrite: `src/components/checkout/CustomerInfo.tsx`
- Rewrite: `src/components/checkout/ShippingInfo.tsx`

- [ ] **Step 1: Rewrite `CustomerInfo.tsx`** (adds email icon + SMS checkbox; preserves controlled state + `data-field` markers):

```tsx
/**
 * CustomerInfo
 * -----------------------------------------------------------------------------
 * Collects email + phone and an SMS-updates opt-in. Fully controlled; the
 * parent owns state. Email is required so the browser blocks submission.
 *
 * Markers: email field data-field="email"; phone field data-field="phone-number".
 * -----------------------------------------------------------------------------
 */

import { Icon } from "@/components/icons";
import { Field, inputCls } from "@/components/checkout/form-atoms";

export interface CustomerInfoValue {
  email: string;
  phoneNumber: string;
}

export interface CustomerInfoCardProps {
  value: CustomerInfoValue;
  onChange: (next: CustomerInfoValue) => void;
}

export function CustomerInfo({ value, onChange }: CustomerInfoCardProps) {
  const set =
    (key: keyof CustomerInfoValue) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: event.target.value });

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" icon={<Icon.Mail className="w-4 h-4" />} dataField="email">
          <input
            className={inputCls}
            type="email"
            autoComplete="email"
            placeholder="you@domain.com"
            required
            value={value.email}
            onChange={set("email")}
          />
        </Field>
        <Field label="Phone" optional dataField="phone-number">
          <input
            className={inputCls}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(555) 010-4423"
            value={value.phoneNumber}
            onChange={set("phoneNumber")}
          />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-[12px] text-ink2 select-none">
        <input type="checkbox" defaultChecked className="w-4 h-4 rounded accent-ink" />
        Send shipping updates by SMS.
      </label>
    </>
  );
}
```

- [ ] **Step 2: Rewrite `ShippingInfo.tsx`** (street icon, AG1 grid; preserves state + markers):

```tsx
/**
 * ShippingInfo
 * -----------------------------------------------------------------------------
 * U.S. shipping address, AG1 layout:
 *   [First name] [Family name]
 *   [Street (icon)            ]
 *   [Apt / suite] [City] [State] [ZIP]
 * Fully controlled; country fixed to the U.S.
 *
 * Markers: data-field="first-name" | "last-name" | "street" | "apt-suite" |
 *          "city" | "state" | "zip".
 * -----------------------------------------------------------------------------
 */

import { Icon } from "@/components/icons";
import { Field, inputCls } from "@/components/checkout/form-atoms";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export interface ShippingInfoValue {
  firstName: string;
  lastName: string;
  street: string;
  aptSuite: string;
  city: string;
  stateOrProvince: string;
  zip: string;
  country: string;
}

export interface ShippingInfoProps {
  value: ShippingInfoValue;
  onChange: (next: ShippingInfoValue) => void;
}

export function ShippingInfo({ value, onChange }: ShippingInfoProps) {
  const set =
    (key: keyof ShippingInfoValue) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="First name" span="col-span-1" dataField="first-name">
        <input className={inputCls} type="text" autoComplete="given-name" placeholder="Alex" required value={value.firstName} onChange={set("firstName")} />
      </Field>
      <Field label="Family name" span="col-span-1" dataField="last-name">
        <input className={inputCls} type="text" autoComplete="family-name" placeholder="Mendez" required value={value.lastName} onChange={set("lastName")} />
      </Field>
      <Field label="Street" icon={<Icon.Pin className="w-4 h-4" />} dataField="street">
        <input className={inputCls} type="text" autoComplete="address-line1" placeholder="2114 Larkspur Lane" required value={value.street} onChange={set("street")} />
      </Field>
      <Field label="Apt / suite" span="col-span-1" optional dataField="apt-suite">
        <input className={inputCls} type="text" autoComplete="address-line2" placeholder="—" value={value.aptSuite} onChange={set("aptSuite")} />
      </Field>
      <Field label="City" span="col-span-1" dataField="city">
        <input className={inputCls} type="text" autoComplete="address-level2" placeholder="Portland" required value={value.city} onChange={set("city")} />
      </Field>
      <Field label="State" span="col-span-1" dataField="state">
        <select className={inputCls} autoComplete="address-level1" required value={value.stateOrProvince} onChange={set("stateOrProvince")}>
          <option value="" disabled>State</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field label="ZIP" span="col-span-1" dataField="zip">
        <input className={inputCls} type="text" inputMode="numeric" autoComplete="postal-code" placeholder="97214" required value={value.zip} onChange={set("zip")} />
      </Field>
    </div>
  );
}
```

- [ ] **Step 3: Build check (these two files only)**

Run: `npm run build 2>&1 | grep -iE "CustomerInfo|ShippingInfo" || echo "Customer/Shipping OK"`
Expected: `Customer/Shipping OK`.

- [ ] **Step 4: Commit**

```bash
git add src/components/checkout/CustomerInfo.tsx src/components/checkout/ShippingInfo.tsx
git commit -m "feat: AG1 contact + shipping fields"
```

### Task 11: PaymentInfo restyle

**Files:**
- Rewrite: `src/components/checkout/PaymentInfo.tsx`

- [ ] **Step 1: Rewrite `PaymentInfo.tsx`** (AG1 payment box; preserves ConvesioPay mount/validity/ready):

```tsx
/**
 * PaymentInfo
 * -----------------------------------------------------------------------------
 * Hosts the ConvesioPay checkout iframe (PCI-compliant card tokenization). The
 * SDK is initialized + mounted once via `useConvesioPayCheckout`; keys come from
 * the `/config` worker endpoint. Wrapped in the AG1 payment box with a TLS
 * assurance line.
 *
 * Markers: data-slot="cpay-mount" | "cpay-loading" | "cpay-error".
 * -----------------------------------------------------------------------------
 */

import { useEffect, useRef } from "react";

import { Icon } from "@/components/icons";
import { useConvesioPayCheckout } from "@/hooks/useConvesioPayCheckout";

export interface PaymentInfoProps {
  customerEmail?: string;
  onValidityChange?: (isValid: boolean) => void;
  onComponentReady?: (component: ConvesioPayComponent) => void;
}

export function PaymentInfo({
  customerEmail,
  onValidityChange,
  onComponentReady,
}: PaymentInfoProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { status, error, isValid, component } = useConvesioPayCheckout(mountRef, {
    customerEmail,
    theme: "light",
  });

  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  useEffect(() => {
    if (component) onComponentReady?.(component);
  }, [component, onComponentReady]);

  return (
    <div>
      <div className="rounded-xl border border-line bg-paper2 p-3">
        <div
          ref={mountRef}
          data-slot="cpay-mount"
          id="cpay-checkout-component"
          className="min-h-[220px]"
        />

        {status === "loading" && (
          <p data-slot="cpay-loading" className="text-[13px] text-ink3" aria-live="polite">
            Loading secure payment form…
          </p>
        )}

        {status === "error" && (
          <p data-slot="cpay-error" role="alert" className="text-[13px] text-rust">
            {error?.message ?? "Could not load the payment form."}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-ink3">
        <span className="inline-flex items-center gap-1.5">
          <Icon.Shield className="w-3.5 h-3.5" /> Tokenized via TLS 1.3 · your card never touches our servers
        </span>
        <span className="num tracking-[0.08em]">PCI DSS · L1</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build 2>&1 | grep -i "PaymentInfo" || echo "PaymentInfo OK"`
Expected: `PaymentInfo OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/checkout/PaymentInfo.tsx
git commit -m "feat: AG1 payment box styling"
```

### Task 12: OrderSummaryCard — summary + lime CTA

**Files:**
- Rewrite: `src/components/checkout/OrderSummaryCard.tsx`

- [ ] **Step 1: Rewrite `OrderSummaryCard.tsx`** (renders the AG1 summary footer + lime `.cta`; keeps `type="submit"`, `payDisabled`/`payLoading`, and the busy→done flash):

```tsx
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
```

Note: `-mx-6` lets this footer span the card's full width while the card body uses `px-6`. The CheckoutPage card body wraps content in `px-6` (Task 13), so this cancels the padding to reach the card edges.

- [ ] **Step 2: Build check**

Run: `npm run build 2>&1 | grep -i "OrderSummaryCard" || echo "OrderSummaryCard OK"`
Expected: `OrderSummaryCard OK`.

- [ ] **Step 3: Commit**

```bash
git add src/components/checkout/OrderSummaryCard.tsx
git commit -m "feat: AG1 summary footer + lime CTA"
```

### Task 13: CheckoutPage assembly + trust strip + remove marketing components

**Files:**
- Rewrite: `src/pages/CheckoutPage.tsx`
- Delete: `src/components/checkout/ProductHeroCard.tsx`, `GuaranteeCard.tsx`, `ReviewsSection.tsx`, `IngredientsPanel.tsx`, `Bottle.tsx`, `Seal.tsx`, `SecurityBadges.tsx`

- [ ] **Step 1: Rewrite `CheckoutPage.tsx`:**

```tsx
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
import { BUNDLES, type Bundle } from "@/components/checkout/bundles";
import { Field, Step, inputCls } from "@/components/checkout/form-atoms";
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
  { k: "4.86 · 12.4k", v: "Verified reviews", icon: <Icon.Star className="w-3.5 h-3.5" /> },
  { k: "Lab tested", v: "3rd-party, COA", icon: <Icon.Beaker className="w-3.5 h-3.5" /> },
];

export function CheckoutPage() {
  const [customer, setCustomer] = useState<CustomerInfoValue>(INITIAL_CUSTOMER);
  const [shipping, setShipping] = useState<ShippingInfoValue>(INITIAL_SHIPPING);
  const [isPaymentValid, setIsPaymentValid] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<Bundle>(
    BUNDLES.find((b) => b.isMostChosen) ?? BUNDLES[0],
  );

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
      amount: selectedBundle.totalAmountMinor,
      currency: CURRENCY,
      phone: { number: customer.phoneNumber, countryCode: "1" },
      billingAddress: address,
      shippingAddress: address,
      lineItems: [
        {
          sku: PRODUCT_SKU,
          description: PRODUCT_NAME,
          quantity: selectedBundle.bottleCount,
          amountIncludingTax: selectedBundle.totalAmountMinor,
        },
      ],
    });
  };

  const isProcessing = status === "processing";
  const totalFmt = `$${(selectedBundle.totalAmountMinor / 100).toFixed(2)}`;

  return (
    <main data-page="checkout" className="min-h-screen">
      <div className="max-w-[720px] mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-none text-ink">
            Almost there.
          </h1>
          <span className="text-[12px] text-ink3">
            Need a hand?{" "}
            <a className="text-ink underline underline-offset-4 hover:text-ink2" href="#">
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
                <span className="num text-[12px] text-ink">
                  <span className="text-ink3 smallcaps mr-2">{selectedBundle.bottleCount}× · one-time</span>
                  {totalFmt}
                </span>
              }
            >
              <BundleSelector value={selectedBundle} onChange={setSelectedBundle} />
              <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1 text-[11px] text-ink3">
                <span className="inline-flex items-center gap-1.5"><Icon.Check className="w-3 h-3" /> Free shipping</span>
                <span className="inline-flex items-center gap-1.5"><Icon.Check className="w-3 h-3" /> 90-day return</span>
                <span className="inline-flex items-center gap-1.5"><Icon.Check className="w-3 h-3" /> Cancel anytime</span>
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
```

Note: the `OrderSummaryCard` is wrapped in a `px-6` div but uses `-mx-6` internally so its paper2 background reaches the card edges while inheriting the page's horizontal rhythm.

- [ ] **Step 2: Delete the now-unreferenced marketing components**

```bash
git rm src/components/checkout/ProductHeroCard.tsx \
       src/components/checkout/GuaranteeCard.tsx \
       src/components/checkout/ReviewsSection.tsx \
       src/components/checkout/IngredientsPanel.tsx \
       src/components/checkout/Bottle.tsx \
       src/components/checkout/Seal.tsx \
       src/components/checkout/SecurityBadges.tsx
```

- [ ] **Step 3: Confirm nothing else imports the deleted files**

Run:
```bash
grep -rnE "ProductHeroCard|GuaranteeCard|ReviewsSection|IngredientsPanel|Bottle|Seal|SecurityBadges|SectionHead" src/ || echo "no stale imports"
```
Expected: `no stale imports`. (If `SectionHead` appears anywhere, replace that usage — it was removed in Task 8.)

- [ ] **Step 4: Build + lint**

```bash
npm run build && npm run lint
```
Expected: both PASS. Fix any reported error before continuing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rebuild CheckoutPage as AG1 single-column accordion"
```

---

## Phase 5 — Thank-you restyle

### Task 14: SectionCard + ThankYouPage restyle

**Files:**
- Modify: `src/components/checkout/primitives/SectionCard.tsx`
- Modify: `src/pages/ThankYouPage.tsx`

- [ ] **Step 1: Restyle `SectionCard.tsx`** — paper card, Geist (non-serif) title. Replace the `className` on the `<section>` and the header/title:

Change the section className from:
```tsx
      className={cn("gloss-card rounded-md overflow-hidden", className)}
```
to:
```tsx
      className={cn(
        "bg-paper border border-line rounded-[20px] overflow-hidden shadow-[0_1px_0_rgba(10,11,13,0.02),0_20px_42px_-26px_rgba(10,11,13,0.18)]",
        className,
      )}
```
Change the header/title block from:
```tsx
        <header className="px-5 sm:px-6 pt-5 pb-4 border-b border-line2">
          <h2
            data-slot="section-title"
            className={cn("serif text-[24px] leading-[1.1] tracking-tight text-ink", titleClassName)}
          >
            {title}
          </h2>
        </header>
```
to:
```tsx
        <header className="px-5 sm:px-6 pt-5 pb-4 border-b border-line2">
          <h2
            data-slot="section-title"
            className={cn("text-[24px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink", titleClassName)}
          >
            {title}
          </h2>
        </header>
```

- [ ] **Step 2: Restyle `ThankYouPage.tsx`** by applying these exact find/replace edits (logic untouched):

Edit A — failure icon chip (rust on warm wash):
- Find: `<div className="flex h-12 w-12 items-center justify-center rounded-full bg-rust/10 text-rust">`
- Replace: `<div className="flex h-12 w-12 items-center justify-center rounded-full bg-rust/15 text-rust">`

Edit B — failure CTA button:
- Find: `className="inline-flex h-11 items-center justify-center rounded-md bg-forest px-6 text-[14px] font-semibold uppercase tracking-[0.04em] text-bone transition hover:bg-forest2"`
- Replace: `className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-[14px] font-semibold tracking-[0.02em] text-paper transition hover:bg-ink2"`

Edit C — processing banner container:
- Find: `className="flex items-start gap-3 rounded-md border border-[#e4d4a5] bg-amber-soft/50 px-5 py-4"`
- Replace: `className="flex items-start gap-3 rounded-[14px] border border-line bg-paper2 px-5 py-4"`

Edit D — processing spinner color:
- Find: `<Spinner aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber2" />`
- Replace: `<Spinner aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-rust" />`

Edit E — confirmed banner container:
- Find: `className="flex items-start gap-3 rounded-md border border-[#cfe0d2] bg-[#f4faf4] px-5 py-4"`
- Replace: `className="flex items-start gap-3 rounded-[14px] border border-line2 bg-lime3/40 px-5 py-4"`

Edit F — confirmed banner check chip:
- Find: `<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-bone">`
- Replace: `<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-ink">`

Edit G — included-products well background:
- Find: `className="rounded-md border border-line bg-bone2/50 p-2.5"`
- Replace: `className="rounded-[14px] border border-line bg-paper2 p-2.5"`

Edit H — thumbnails (two occurrences — use replace-all): 
- Find: `className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"`
- Replace: `className="h-12 w-12 shrink-0 rounded-[10px] border border-line object-cover"`

Edit I — charge-pending badge:
- Find: `className="rounded-[3px] border border-amber/40 bg-amber-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber2"`
- Replace: `className="rounded-full border border-line bg-paper2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rust"`

Edit J — "Included Products" sublabel color:
- Find: `className="mt-1 text-[13px] font-bold text-forest"`
- Replace: `className="mt-1 text-[13px] font-semibold text-ink"`

Edit K — receipt CTA className constant:
- Find:
```tsx
  const ctaClassName =
    "h-12 w-full rounded-md bg-forest text-bone text-[14px] font-semibold tracking-[0.04em] uppercase flex items-center justify-center gap-2 transition hover:bg-forest2 cursor-pointer";
```
- Replace:
```tsx
  const ctaClassName =
    "h-12 w-full rounded-full bg-ink text-paper text-[14px] font-semibold tracking-[0.02em] flex items-center justify-center gap-2 transition hover:bg-ink2 cursor-pointer";
```

Edit L — guarantee note (lime wash):
- Find: `className="rounded-md border border-[#b9e0be] bg-[#eff9f0] p-3 text-[12.5px] font-semibold text-forest"`
- Replace: `className="rounded-[12px] border border-line2 bg-lime3/40 p-3 text-[12.5px] font-semibold text-ink2"`

Edit M — page container width (match the 720px storefront rhythm):
- Find: `<div className="max-w-[1180px] mx-auto flex w-full flex-col gap-4 px-5 py-8">`
- Replace: `<div className="max-w-[760px] mx-auto flex w-full flex-col gap-4 px-6 py-12">`

Edit N — total-line value already uses `text-ink`; the two-column grid (`lg:grid-cols-[1.6fr_1fr]`) stays. No change.

- [ ] **Step 3: Build + lint**

```bash
npm run build && npm run lint
```
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/checkout/primitives/SectionCard.tsx src/pages/ThankYouPage.tsx
git commit -m "feat: restyle ThankYouPage + SectionCard to AG1 palette"
```

---

## Phase 6 — Verification & deploy

### Task 15: Local verification (preview)

**Files:** none

- [ ] **Step 1: Confirm `.dev.vars` exists** with the ConvesioPay/auth/integration secrets:

```bash
grep -oE "^[A-Z_]+=" .dev.vars | tr -d '=' | sort | tr '\n' ' '
```
Expected: includes `CPAY_API_KEY CPAY_SECRET CPAY_INTEGRATION` (and ideally `AUTH_SALT`, `SENDGRID_API_KEY`, `CARTROVER_*`). If `CPAY_*` are missing, stop — the payment iframe won't load.

- [ ] **Step 2: Build and start the full preview (worker + local D1)**

Use the preview tooling to run `npm run preview` (build + Wrangler) and open `/`. The dev server only serves the SPA; `npm run preview` is required for `/config` and `/payments`.

- [ ] **Step 3: Verify the CheckoutPage**

- Snapshot/screenshot `/`. Confirm: single-column ~720px card, sand background, sticky top rail (MERIDIAN + viewers + Reserved timer), 4 numbered accordion steps, 3 plan cards (3-bottle = "Best value", selected = dark/lime ring), cosmetic disabled Subscribe tab, ConvesioPay iframe loaded under "Payment", lime CTA reading "Place order — $99.00", trust strip of 4 chips, centered footer.
- Check console/network: no errors; `/config` returns 200.
- Click a different plan card → CTA total and Step 1 summary update.

- [ ] **Step 4: Verify a test payment**

Fill email + address, complete the test card in the iframe, submit. Confirm: CTA shows "Placing your order…" (busy) then either the `PaymentStatusDialog` opens or the CTA flashes "Order confirmed" (done) per the upstream status. No uncaught errors.

- [ ] **Step 5: Verify the ThankYouPage styling**

Open `/thank-you` (no token → it will show the failed/return state, which is fine for styling). Confirm AG1 palette: paper cards, Geist titles, lime/ink accents, rounded-full CTA, sand background, shared top rail + footer.

- [ ] **Step 6: Confirm the dashboard is visually unchanged**

Open `/login`. Confirm it still renders with the neutral shadcn styling (no warm-sand bleed). If the login/dashboard looks broken by the token changes, scope the offending token (e.g. revert `--color-paper`/`--color-line` to the cool value and introduce a checkout-only alias instead) and rebuild.

- [ ] **Step 7: Stop the preview.** No commit (verification only). If any fix was needed, commit it with a `fix:` message.

### Task 16: Deploy to the new Worker

**Files:**
- Modify: `wrangler.jsonc` (restore `secrets.required`)

- [ ] **Step 1: Bootstrap deploy (empty `secrets.required`)**

```bash
npm run deploy
```
Expected: builds and deploys a **new** Worker `fulfillment-checkout-v4`; prints the `*.workers.dev` URL. (v2 is not touched.)

- [ ] **Step 2: Push secrets from `.dev.vars`**

For each secret present in `.dev.vars`, push it to the new Worker. Run the bundled helper for the ConvesioPay keys:
```bash
npm run add-envs
```
Then push the remaining secrets individually (paste each value from `.dev.vars` when prompted):
```bash
npx wrangler secret put AUTH_SALT
npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put SENDGRID_API_KEY
npx wrangler secret put CARTROVER_API_USER
npx wrangler secret put CARTROVER_API_KEY
```
(Skip any that are not in `.dev.vars`.) Verify:
```bash
npx wrangler secret list
```
Expected: lists every secret name.

- [ ] **Step 3: Restore the `secrets.required` list in `wrangler.jsonc`**

Replace the bootstrap `secrets` block with:
```jsonc
	"secrets": {
		"required": [
			"CPAY_API_KEY",
			"CPAY_SECRET",
			"CPAY_INTEGRATION",
			"AUTH_SALT",
			"GOOGLE_OAUTH_CLIENT_ID",
			"GOOGLE_OAUTH_CLIENT_SECRET",
			"SENDGRID_API_KEY",
			"CARTROVER_API_USER",
			"CARTROVER_API_KEY"
		]
	},
```

- [ ] **Step 4: Redeploy with the required list enforced**

```bash
npm run deploy
```
Expected: deploy succeeds (all required secrets present).

- [ ] **Step 5: Smoke-test the live URL**

Open the printed `*.workers.dev` URL. Confirm the AG1 CheckoutPage renders, the top rail + footer show, `/config` returns 200 (iframe loads), and `/thank-you` styling matches. 

- [ ] **Step 6: Commit + push**

```bash
git add wrangler.jsonc
git commit -m "chore: restore required secrets after v4 bootstrap deploy"
git push -u origin main
```
Expected: pushes to `Convesio-Inc/fulfillment-checkout-v4`.

---

## Self-review notes

- **Spec coverage:** A (infra) → Tasks 1–4, 16; B (design system) → Tasks 5–6; C (checkout) → Tasks 8–13; D (thank-you) → Task 14; E (chrome) → Task 7; F (verify/deploy) → Tasks 15–16. All covered.
- **Subscribe toggle:** cosmetic/disabled in `BundleSelector` (Task 9); charge amount always `selectedBundle.totalAmountMinor` (Tasks 12–13). ✓
- **Type consistency:** `Field`/`Step`/`inputCls` defined in Task 8 are the exact names imported in Tasks 9–13; `OrderSummaryCardProps` (`selectedBundle`/`payDisabled`/`payLoading`) consistent across Tasks 12–13; `CustomerInfoValue`/`ShippingInfoValue` shapes unchanged so `CheckoutPage`'s submit handler still compiles. ✓
- **No unit tests:** intentional — project has no test runner; verification is build/lint/preview. ✓
- **Risk flagged:** redefining `--color-paper`/`--color-line`/`--color-ink*` may tint the dashboard; Task 15 Step 6 verifies and gives the scoping fallback.
