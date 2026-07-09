/**
 * useThankYouPayment
 * -----------------------------------------------------------------------------
 * Drives the thank-you page's "is the payment done yet?" lifecycle.
 *
 * The hook accepts two inputs — a canonical `?token=<jwt>` read from the URL,
 * and an optional `orderIdHint` (either a `?orderId=` query param read from
 * the return URL or, as a fallback, a value stashed in sessionStorage by
 * `useCheckoutPayment` before the 3DS handoff).
 *
 * Flow:
 *
 *   1. If we have a `token`, POST it to `/verify-token` to decode it.
 *      - If the decoded payload has a `payment_id`, it's a normal thank-you
 *        token: continue with verify + poll.
 *      - If `payment_id` is empty, it's the "marker" JWT the worker pre-
 *        signed into `returnUrl` before the payments call (3DS return). The
 *        marker carries an `order_id`, which we use to mint a real thank-you
 *        JWT via `/issue-token`.
 *   2. If we need to resume, take the `order_id` from (in order): the
 *      decoded marker payload, the `orderIdHint`, or the sessionStorage
 *      bridge. POST it to `/issue-token` to mint a proper thank-you JWT,
 *      rewrite the URL to `?token=<jwt>` via `history.replaceState`, clear
 *      the sessionStorage entry, then run verify + poll as if we had a
 *      token all along.
 *   3. If the decoded status is already terminal (Succeeded / Authorized →
 *      "succeeded", or anything else non-pending → "failed"), we're done.
 *   4. If the status is "Pending", poll `/poll-payment` every 5s with
 *      `{ order_id }` and map each response's status through the same sets.
 *      Clears the interval on terminal status or unmount.
 *
 * Exposed state:
 *
 *   {
 *     state,    // "verifying" | "pending" | "succeeded" | "failed"
 *     payload,  // decoded JWT body (once verified)
 *     error,    // Error | null — set on verify failure / missing token /
 *               // non-ok poll responses with a failed status
 *   }
 * -----------------------------------------------------------------------------
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  PENDING_PAYMENT_MAX_AGE_MS,
  PENDING_PAYMENT_SESSION_KEY,
  type PendingPaymentSessionEntry,
} from "@/hooks/useCheckoutPayment";

export type ThankYouState =
  | "verifying"
  | "pending"
  | "succeeded"
  | "failed";

export interface CheckoutTokenPayload {
  order_id: number;
  payment_id: string;
  customer_id: string;
  status: string;
}

export interface ShippingAddress {
  houseNumberOrName: string;
  street: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  country: string;
}

/** Aggregated line item as stored on `orders.items` and returned by
 *  `/verify-token`. Amounts are in minor units (cents). */
export interface OrderLineItem {
  sku: string;
  description: string;
  quantity: number;
  amountMinor: number;
  /** True when the line is from a deferred upsell (`scheduled` payment); not yet charged upstream. */
  chargePending?: boolean;
}

/** Extra context returned by `/verify-token` alongside the decoded JWT —
 *  used by follow-up flows (e.g. the upsell modal and the receipt summary)
 *  to skip re-collecting customer + shipping info and to render the full
 *  list of items on the order. */
export interface OrderContext {
  order_id: number;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: ShippingAddress | null;
  items: OrderLineItem[];
}

export interface UseThankYouPaymentOptions {
  /** The `?token=<jwt>` read from the URL. When present, the hook verifies
   *  it directly. */
  token: string | null;
  /** An `order_id` found outside the JWT — either a `?orderId=` URL query
   *  param or, as a fallback, the value stashed in sessionStorage by
   *  `useCheckoutPayment`. The hook exchanges it for a JWT via
   *  `/issue-token` before proceeding. */
  orderIdHint: number | null;
}

export interface UseThankYouPaymentResult {
  state: ThankYouState;
  payload: CheckoutTokenPayload | null;
  context: OrderContext | null;
  error: Error | null;
  /** Re-fetches `/verify-token` to refresh receipt line items (e.g. after a deferred upsell is queued). */
  refreshOrderContext: () => Promise<void>;
}

type VerifyTokenResponseBody = CheckoutTokenPayload &
  Partial<OrderContext> & {
    error?: boolean;
    message?: string;
  };

function orderContextFromVerifyBody(
  body: VerifyTokenResponseBody,
): OrderContext | null {
  if (typeof body.order_id !== "number") return null;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: OrderLineItem[] = rawItems.map((row) => {
    const r = row as unknown as Record<string, unknown>;
    return {
      sku: String(r.sku ?? ""),
      description: String(r.description ?? ""),
      quantity: Number(r.quantity ?? 1),
      amountMinor: Number(r.amountMinor ?? 0),
      chargePending: r.chargePending === true,
    };
  });
  return {
    order_id: body.order_id,
    customer_email: body.customer_email ?? null,
    customer_name: body.customer_name ?? null,
    customer_phone: body.customer_phone ?? null,
    shipping_address: body.shipping_address ?? null,
    items,
  };
}

// Intentionally duplicated in useCheckoutPayment.ts and
// worker/handlers/payments/shared.ts — the SPA and worker bundle separately
// so they cannot share a module. Keep all three in sync when adding statuses.
const SUCCESS_STATUSES = new Set(["Succeeded", "Authorized", "Authorised"]);
const PENDING_STATUSES = new Set(["Pending"]);

const POLL_INTERVAL_MS = 5000;

function classify(status: string | undefined): ThankYouState {
  if (status && SUCCESS_STATUSES.has(status)) return "succeeded";
  if (status && PENDING_STATUSES.has(status)) return "pending";
  return "failed";
}

/**
 * Pull the sessionStorage entry written by `useCheckoutPayment` before the
 * 3DS handoff. Returns `null` (and clears the entry) if the payload is
 * malformed or older than `PENDING_PAYMENT_MAX_AGE_MS` — the latter catches
 * the case where the user abandoned the challenge and returned to this page
 * hours or days later via an open tab.
 */
function readPendingPaymentHint(): PendingPaymentSessionEntry | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PENDING_PAYMENT_SESSION_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { order_id?: unknown }).order_id !== "number" ||
    !Number.isFinite((parsed as { order_id: number }).order_id)
  ) {
    return null;
  }

  const entry = parsed as PendingPaymentSessionEntry;

  if (
    typeof entry.saved_at === "number" &&
    Date.now() - entry.saved_at > PENDING_PAYMENT_MAX_AGE_MS
  ) {
    try {
      window.sessionStorage.removeItem(PENDING_PAYMENT_SESSION_KEY);
    } catch {
      // ignore
    }
    return null;
  }

  return entry;
}

function clearPendingPaymentHint(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_PAYMENT_SESSION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Rewrite the browser URL to `/thank-you?token=<jwt>` without a navigation,
 * so that refreshes, copy-pastes, and share-this-URL flows all behave the
 * same as the non-3DS path. Any other existing query params (e.g. the
 * `?paymentId=` ConvesioPay may have appended) are dropped.
 */
function promoteTokenToUrl(token: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    // Drop existing query (paymentId, cache-busting, etc.) so the URL is a
    // clean canonical thank-you URL.
    url.search = "";
    url.searchParams.set("token", token);
    window.history.replaceState(null, "", url.toString());
  } catch {
    // ignore — URL rewriting is purely cosmetic
  }
}

export function useThankYouPayment(
  options: UseThankYouPaymentOptions,
): UseThankYouPaymentResult {
  const { token: initialToken, orderIdHint } = options;

  const lastThankYouTokenRef = useRef<string | null>(null);

  // The effective token may arrive synchronously (from the URL) or after a
  // `/issue-token` roundtrip. Either way, once set, the rest of the hook
  // treats it as the source of truth.
  const [state, setState] = useState<ThankYouState>(() => {
    if (initialToken) return "verifying";
    if (orderIdHint != null) return "verifying";
    if (readPendingPaymentHint()) return "verifying";
    return "failed";
  });
  const [payload, setPayload] = useState<CheckoutTokenPayload | null>(null);
  const [context, setContext] = useState<OrderContext | null>(null);
  const [error, setError] = useState<Error | null>(() => {
    if (initialToken) return null;
    if (orderIdHint != null) return null;
    if (readPendingPaymentHint()) return null;
    return new Error("Missing confirmation token.");
  });

  // Keep the latest payload available to the poller without re-arming the
  // effect on every status change (which would leak intervals).
  const payloadRef = useRef<CheckoutTokenPayload | null>(null);

  const refreshOrderContext = useCallback(async () => {
    const t = lastThankYouTokenRef.current;
    if (!t) return;
    let response: Response;
    try {
      response = await fetch("/verify-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ token: t }),
      });
    } catch {
      return;
    }
    let body: VerifyTokenResponseBody | null = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok || body?.error || !body) return;
    const next = orderContextFromVerifyBody(body);
    if (next) setContext(next);
  }, [setContext]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const poll = async () => {
      const current = payloadRef.current;
      if (!current) return;

      let response: Response;
      try {
        response = await fetch("/poll-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            order_id: current.order_id,
          }),
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setState("failed");
        stopPolling();
        return;
      }

      let body:
        | { status?: string; error?: boolean; message?: string }
        | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (cancelled) return;

      if (!response.ok || body?.error) {
        setError(
          new Error(
            body?.message ??
              `Payment status check failed (${response.status} ${response.statusText})`,
          ),
        );
        setState("failed");
        stopPolling();
        return;
      }

      const next = classify(body?.status);
      if (next === "pending") return; // keep polling
      setState(next);
      if (next === "failed") {
        setError(
          new Error(
            `Payment ${(body?.status ?? "failed").toLowerCase()}.`,
          ),
        );
      }
      stopPolling();
    };

    const verifyToken = async (tokenToVerify: string) => {
      let response: Response;
      try {
        response = await fetch("/verify-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ token: tokenToVerify }),
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setState("failed");
        return;
      }

      let body:
        | (CheckoutTokenPayload &
            Partial<OrderContext> & {
              error?: boolean;
              message?: string;
            })
        | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (cancelled) return;

      if (!response.ok || body?.error || !body) {
        setError(
          new Error(
            body?.message ??
              `Could not verify confirmation token (${response.status} ${response.statusText})`,
          ),
        );
        setState("failed");
        return;
      }

      const decoded: CheckoutTokenPayload = {
        order_id: body.order_id,
        payment_id: body.payment_id,
        customer_id: body.customer_id,
        status: body.status,
      };

      const ctx = orderContextFromVerifyBody(body as VerifyTokenResponseBody);
      if (!ctx) {
        setError(new Error("Invalid order context in verification response."));
        setState("failed");
        return;
      }
      setContext(ctx);
      lastThankYouTokenRef.current = tokenToVerify;

      // Marker token: the worker pre-signed this into `returnUrl` before
      // calling ConvesioPay, so we're on a 3DS return. The marker carries
      // `order_id` but no `payment_id` (the payment didn't exist yet at
      // signing time). Swap it for a real thank-you token via
      // `/issue-token` so we get the latest cpay status and id.
      if (!decoded.payment_id) {
        const orderIdToResume =
          (typeof decoded.order_id === "number" && decoded.order_id) ||
          orderIdHint ||
          readPendingPaymentHint()?.order_id ||
          null;
        if (!orderIdToResume) {
          setError(
            new Error(
              "Could not resolve an order id to resume verification.",
            ),
          );
          setState("failed");
          return;
        }
        await resumeFromOrderId(orderIdToResume);
        return;
      }

      payloadRef.current = decoded;
      setPayload(decoded);

      const next = classify(decoded.status);
      setState(next);

      if (next === "pending") {
        // Immediate refresh before the first 5s tick so slow-webhook cases
        // resolve as quickly as possible when the user lands.
        void poll();
        intervalId = setInterval(() => {
          void poll();
        }, POLL_INTERVAL_MS);
      }
    };

    const resumeFromOrderId = async (orderId: number) => {
      let response: Response;
      try {
        response = await fetch("/issue-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ order_id: orderId }),
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setState("failed");
        return;
      }

      let body: { token?: string; error?: boolean; message?: string } | null =
        null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (cancelled) return;

      if (!response.ok || body?.error || !body?.token) {
        setError(
          new Error(
            body?.message ??
              `Could not resume payment verification (${response.status} ${response.statusText})`,
          ),
        );
        setState("failed");
        return;
      }

      // Normalize the URL to the canonical `?token=<jwt>` shape and drop
      // the sessionStorage bridge — from here on the flow is identical to
      // the non-3DS path.
      promoteTokenToUrl(body.token);
      clearPendingPaymentHint();

      await verifyToken(body.token);
    };

    (async () => {
      if (initialToken) {
        await verifyToken(initialToken);
        return;
      }

      const hint = orderIdHint ?? readPendingPaymentHint()?.order_id ?? null;
      if (hint) {
        await resumeFromOrderId(hint);
        return;
      }

      if (cancelled) return;
      setState("failed");
      setError(new Error("Missing confirmation token."));
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [initialToken, orderIdHint]);

  return { state, payload, context, error, refreshOrderContext };
}
