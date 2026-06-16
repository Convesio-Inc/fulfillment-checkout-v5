# Checkout v4 — MERIDIAN (AG1) Rework — Design Spec

**Date:** 2026-06-16
**Pages in scope:** CheckoutPage (full rework), ThankYouPage (restyle only), shared storefront chrome
**Reference:** `Checkout v4 - AG1.html` (MERIDIAN warm sand/paper/lime single-column accordion checkout)
**Cloudflare account:** Sirvelia (`albert@sirvelia.com`, account `f1cca862ce5ef128759c0054124d38b9`)

---

## Summary

This repo is a clone of `fulfillment-checkout-v2` — a React 19 + Vite SPA served by a single
Cloudflare Worker that proxies ConvesioPay, owns a D1 database, and runs a bi-hourly fulfillment
cron. It was already redesigned once into a forest-green "Daily Greens Complex" theme.

This iteration does two things:

1. **Stand up v4 as its own deployment** — a new Worker and a new, empty D1 database, a new git
   remote, and updated docs — without touching the existing v2 Worker or v2 D1 database.
2. **Re-skin the storefront** to match the new MERIDIAN AG1 reference: a minimal single-column
   (~720px) accordion checkout in a warm sand/paper/lime palette with Geist typography. The
   ThankYouPage is restyled to the same look (structure and logic preserved). All payment,
   validity, and fulfillment behavior is preserved.

The dashboard/login (admin) side is **out of scope** and must remain visually unchanged.

---

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Checkout layout | Match the sample exactly: single-column ~720px, 4-step accordion, inline summary + CTA, trust strip, sample top rail + footer. |
| Marketing sections | **Dropped** from the checkout page (ProductHeroCard, GuaranteeCard, ReviewsSection, IngredientsPanel, Bottle, Seal) — the sample has none. |
| Subscribe toggle | Rendered but **cosmetic/disabled**. One-time purchase is the only functional path; the charged amount is always the selected bundle's one-time price. |
| Thank-you page | **Restyle only** — keep all structure and logic; apply the new palette/type/card treatment. |
| New D1 database | Brand-new, **empty** database `fulfillment-checkout-v4` (fresh schema via existing migration). v2 DB untouched. |
| GitHub repo | `git@github.com:Convesio-Inc/fulfillment-checkout-v4.git` already exists; repoint `origin`. |
| Admin side | Dashboard/login left visually unchanged (shadcn oklch tokens untouched). |

---

## A. Infrastructure / background work

### A1. Wrangler → new Worker + new D1 (`wrangler.jsonc`)
- `name`: `fulfillment-checkout-v2` → `fulfillment-checkout-v4`.
- Create the database: `wrangler d1 create fulfillment-checkout-v4`. Capture the returned
  `database_id`.
- `d1_databases[0].database_name` → `fulfillment-checkout-v4`; `database_id` → the new id.
- Leave `secrets.required: []` for the bootstrap first deploy (already in this state on the
  working tree); restore the full `required` list after secrets are pushed (see A5).
- Keep `triggers.crons: ["0 */2 * * *"]`, observability, compatibility flags, and `vars` as-is.

### A2. package.json
- `db:migrate` → `wrangler d1 migrations apply fulfillment-checkout-v4 --local`.
- `db:migrate:remote` → `wrangler d1 migrations apply fulfillment-checkout-v4 --remote`.
- `name` field is cosmetic; may update to reflect v4 but not required.

### A3. Git remote
- `git remote set-url origin git@github.com:Convesio-Inc/fulfillment-checkout-v4.git`.
- Verify with `git ls-remote origin` before pushing.

### A4. Docs
- `README.md`, `AGENTS.md`, `CLAUDE.md`: replace v2 references (db name, worker name, repo URL).
- `AGENTS.md`: remove the stale `/product` → `ProductPage` route row (no `ProductPage.tsx` exists).

### A5. Local env + deploy
- **Local:** confirm `.dev.vars` exists with the ConvesioPay + auth + integration secrets; run
  `npm run db:migrate` (local) to create the schema in the local D1; exercise via `npm run preview`
  (full worker + D1 + `/config`).
- **Remote DB:** `npm run db:migrate:remote` to create the schema in the new remote D1.
- **Deploy:** `wrangler deploy` (bootstrap with empty `secrets.required`), then push secret values
  read from `.dev.vars` (`CPAY_CLIENT_KEY`, `CPAY_API_KEY`, `CPAY_SECRET`, `CPAY_INTEGRATION`,
  `AUTH_SALT`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SENDGRID_API_KEY`,
  `CARTROVER_API_USER`, `CARTROVER_API_KEY`) via `wrangler secret put` / `secret bulk`, restore the
  `secrets.required` list in `wrangler.jsonc`, and redeploy. Confirm the live URL renders.

---

## B. Design system (`src/index.css`)

Add the sample's exact palette tokens (Tailwind v4 `@theme inline`):

```
sand #eddfc4   sand2 #e4d3ad   paper #fbf3dd   paper2 #f7eece
ink #0a0b0d    ink2 #2a2b25    ink3 #65665d    ink4 #a09d8c
line #d4c69f   line2 #e3d5b1
lime #cde04a   lime2 #aec33a   lime3 #e6f08b   rust #b04923
```

Page background becomes `sand`; body text `ink`; font `Geist Variable` (already a dependency) with
`Geist Mono` for `.num`.

Add the sample's CSS helpers:
- `.cta` — flat lime button with inset/ambient shadows, hover/active, `.arrow-slot`, and the
  `data-state` `idle`/`busy`/`done` state machine (spinner + animated checkmark, done = green).
- `.seg-track` / `.seg-on` / `.seg-on-lime` — segmented control.
- `.plan` / `.plan.on` / `.ringdot` — bundle plan cards.
- `.save-chip`, `.strike`, `.smallcaps`.
- `details.step` accordion (hairline divider, rotating caret, no default marker).
- Warm-paper input/select styling (focus ring, custom select caret).
- `livedot` / `tick` keyframes, `::selection` lime.

The `:root` shadcn oklch block (dashboard/login app shell) is **not** modified. Legacy storefront
tokens that the admin side may reference (e.g. `forest`, `bone`, `amber`) are left defined to avoid
regressions; the storefront components are migrated off them onto the new tokens.

---

## C. CheckoutPage rework

Replace the two-column layout with a single `max-w-[720px]` main. Structure mirrors the sample:

1. **Checkout card** (`paper`, rounded-[20px], hairline + soft drop) containing a 4-step accordion:
   - **Step 1 — Your supply:** segmented One-time / Subscribe toggle (Subscribe disabled,
     cosmetic) + 3 plan cards in a `grid-cols-3` grid (`.plan` styling, "Best value" chip on the
     3-bottle, per-bottle price, struck list price, total, supply tag) + perks row (Free shipping /
     90-day return / Cancel anytime). Selecting a card updates the bundle.
   - **Step 2 — Contact:** Email (icon) + Phone (optional) + SMS-updates checkbox.
   - **Step 3 — Ships to:** First/Family name, Street (icon), Apt/suite (optional), City, State
     (select), ZIP.
   - **Step 4 — Payment:** real ConvesioPay iframe (`PaymentInfo`) inside the sample's payment box
     with the TLS assurance + PCI line and accepted-card label.
   - **Summary + CTA footer** (`paper2`, top border): line item, FREE shipping, bundle savings (if
     any), Total today, lime CTA "Place order — $X" wired to `useCheckoutPayment` (busy/done states
     driven by real status), "You won't be charged…" note.
2. **Trust strip** — 4 chips (TLS 1.3, PCI DSS L1, rating, Lab tested) below the card.

**Components:**
- `form-atoms.tsx`: rework `Field` to support an optional leading icon and an `optional` tag; add a
  numbered `Step` accordion component (`details.step`); update `inputCls`/input styling to the warm
  paper treatment.
- `CustomerInfo.tsx`, `ShippingInfo.tsx`: restyle to the new Field/grid; preserve all `data-field`
  markers, controlled state, and required/validation behavior.
- `PaymentInfo.tsx`: restyle the container to the sample payment box; preserve the ConvesioPay
  mount, validity, and ready callbacks.
- `BundleSelector.tsx`: rebuild as the segmented toggle + 3 `.plan` cards (replaces the stacked
  card list). Subscribe tab disabled. Preserve `data-section` markers and `onChange` contract.
- `OrderSummaryCard.tsx`: rebuild as the sample summary + lime `.cta`; keep `data-state` busy/done
  wiring, `type="submit"`, `payDisabled`/`payLoading` props.
- Removed from the page: `ProductHeroCard`, `GuaranteeCard`, `ReviewsSection`, `IngredientsPanel`,
  `Bottle`, `Seal`, `SecurityBadges` (superseded by the trust strip). Files may be deleted once
  unreferenced.
- `bundles.ts`: values already match the sample (1 bottle $49, 2 × $39.50 save $19, 3 × $33 save
  $48). Keep as the single source of truth for pricing.
- `useStorefrontUrgency` (countdown + viewers) is reused by the top rail.

**Preserved behavior:** `useCheckoutPayment`, the submit handler building line items/addresses from
state, the charged amount = `selectedBundle.totalAmountMinor`, and `PaymentStatusDialog`.

---

## D. ThankYouPage restyle

Keep all logic and structure (token verify, `useThankYouPayment` state machine, polling, upsell,
receipt sidebar, all `data-section`/`data-slot` markers). Re-skin only:
- Container/chrome inherits the new top rail + footer.
- Cards adopt the `paper` + hairline + soft-drop treatment; type → Geist; accents → `ink`/`lime`.
- Processing banner uses the warm paper/amber→rust tones; confirmed banner uses lime/ink; receipt
  CTA restyled (lime or ink as appropriate). No behavioral change.

---

## E. Shared chrome (`ShopLayout`)

- `UrgencyRail.tsx` → reworked into the sample's single sand top rail: logo tile + "MERIDIAN" +
  "Daily greens" smallcaps on the left; live "N at checkout" (livedot) + "Secure" + "Reserved
  mm:ss" (tick) on the right. Sticky, `border-b border-line2`. Keep `data-slot="reserved-timer"`.
- `SiteHeader.tsx` (separate masthead/nav) → removed from `ShopLayout`; brand now lives in the top
  rail (matches the sample, which has no separate masthead).
- `SiteFooter.tsx` → restyled to the sample's centered one-line footer (© + address + Privacy /
  Terms / Refunds).
- `ShopLayout` background → `sand`, text → `ink`.

This chrome is shared by the only storefront pages, CheckoutPage and ThankYouPage.

---

## F. Verification & deploy

1. `npm run build` + `npm run lint` clean.
2. `npm run preview` (full worker + local D1): snapshot/screenshot CheckoutPage and ThankYouPage;
   confirm the ConvesioPay iframe loads via `/config`; run a test payment and confirm the CTA
   busy/done states and `PaymentStatusDialog` behave; load `/thank-you?token=…` styling.
3. Confirm the dashboard/login pages are visually unchanged.
4. Deploy to the new Worker (A5); confirm the live URL renders both pages.

---

## Out of scope / non-goals

- Real recurring/subscription billing (toggle is cosmetic only).
- Any change to worker handlers, payment/fulfillment logic, DB schema, or admin (dashboard/login)
  UI beyond shared-token safety.
- Migrating data from the v2 database (v4 starts empty).
