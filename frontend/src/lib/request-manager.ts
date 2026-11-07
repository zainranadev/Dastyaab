/**
 * Centralized Request Manager
 * ═══════════════════════════
 * Layers (applied in order):
 *   1. Visibility guard   – skips polling when the tab is hidden
 *   2. Deduplication      – identical in-flight GET requests share one Promise
 *   3. Circuit breaker    – after N consecutive failures an endpoint is locked
 *                           out for COOLDOWN_MS, protecting the backend
 *   4. AbortController    – each slot keeps its own controller; calling
 *                           managed() again for the same key cancels the
 *                           previous request before starting a new one
 *
 * Usage
 * ─────
 *   import { rm } from '@/lib/request-manager';
 *
 *   // Deduplicated GET (safe to call from multiple components simultaneously)
 *   const data = await rm.get('/notifications/unread-count');
 *
 *   // Mutation with double-submit prevention
 *   await rm.mutate('POST', '/quotes/abc/accept');
 *
 *   // Managed poll slot (cancels previous in-flight before starting next)
 *   const data = await rm.managed('chat-poll', () => fetch(...));
 *
 *   // Cancel a slot on unmount
 *   useEffect(() => () => rm.cancel('chat-poll'), []);
 */

// ─── constants ────────────────────────────────────────────────────────────────
const FAILURE_THRESHOLD = 3;    // consecutive errors before OPEN state
const COOLDOWN_MS       = 30_000; // ms to stay in OPEN before half-open probe
const DEDUP_METHODS     = new Set(['GET', 'HEAD']);

// ─── circuit breaker ──────────────────────────────────────────────────────────
type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitEntry {
  state: CBState;
  failures: number;
  openedAt: number;
}

const circuits = new Map<string, CircuitEntry>();

function getCircuit(key: string): CircuitEntry {
  if (!circuits.has(key)) circuits.set(key, { state: 'CLOSED', failures: 0, openedAt: 0 });
  return circuits.get(key)!;
}

function recordSuccess(key: string) {
  const c = getCircuit(key);
  c.state    = 'CLOSED';
  c.failures = 0;
}

function recordFailure(key: string) {
  const c = getCircuit(key);
  c.failures += 1;
  if (c.failures >= FAILURE_THRESHOLD) {
    c.state    = 'OPEN';
    c.openedAt = Date.now();
    console.warn(`[RequestManager] Circuit OPEN for "${key}" after ${c.failures} failures. Cooling down ${COOLDOWN_MS / 1000}s.`);
  }
}

function isAllowed(key: string): boolean {
  const c = getCircuit(key);
  if (c.state === 'CLOSED') return true;
  if (c.state === 'OPEN') {
    if (Date.now() - c.openedAt >= COOLDOWN_MS) {
      c.state = 'HALF_OPEN';
      return true; // let one probe through
    }
    return false;
  }
  return true; // HALF_OPEN: probe allowed
}

// ─── deduplication map ────────────────────────────────────────────────────────
// key → in-flight Promise
const inFlight = new Map<string, Promise<unknown>>();

// ─── managed slots (AbortController per named slot) ──────────────────────────
const slots = new Map<string, AbortController>();

// ─── pending mutation guard ───────────────────────────────────────────────────
const pendingMutations = new Set<string>();

// ─── main class ───────────────────────────────────────────────────────────────
class RequestManager {
  /**
   * Deduplicated fetch for safe read-only requests (GET/HEAD).
   * If an identical request is already in-flight, the same Promise is returned
   * — no second HTTP call is made.
   *
   * @param key     Unique cache key (usually the URL path, optionally + query)
   * @param fetcher Zero-arg async function that performs the actual request
   * @param opts.skipWhenHidden  Default true — skip when document is hidden
   * @param opts.circuitKey      Circuit breaker key (defaults to `key`)
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    opts: { skipWhenHidden?: boolean; circuitKey?: string } = {},
  ): Promise<T | null> {
    const { skipWhenHidden = true, circuitKey = key } = opts;

    // 1. Visibility guard
    if (skipWhenHidden && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return null;
    }

    // 2. Circuit breaker
    if (!isAllowed(circuitKey)) {
      console.debug(`[RequestManager] Circuit OPEN — skipping GET "${key}"`);
      return null;
    }

    // 3. Deduplication
    if (inFlight.has(key)) {
      return inFlight.get(key) as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        recordSuccess(circuitKey);
        return result;
      } catch (err) {
        recordFailure(circuitKey);
        throw err;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, promise as Promise<unknown>);
    return promise;
  }

  /**
   * Mutation guard for POST / PATCH / DELETE.
   * While a mutation for `key` is in-flight, subsequent calls are dropped
   * (returns null silently). This prevents double-submit.
   *
   * @param key     Unique key for this mutation slot (e.g. "accept-quote-{id}")
   * @param fetcher Async function that fires the mutation
   */
  async mutate<T>(
    key: string,
    fetcher: () => Promise<T>,
    opts: { circuitKey?: string } = {},
  ): Promise<T | null> {
    const { circuitKey = key } = opts;

    if (pendingMutations.has(key)) {
      console.debug(`[RequestManager] Duplicate mutation dropped for "${key}"`);
      return null;
    }

    if (!isAllowed(circuitKey)) {
      console.debug(`[RequestManager] Circuit OPEN — dropping mutation "${key}"`);
      return null;
    }

    pendingMutations.add(key);
    try {
      const result = await fetcher();
      recordSuccess(circuitKey);
      return result;
    } catch (err) {
      recordFailure(circuitKey);
      throw err;
    } finally {
      pendingMutations.delete(key);
    }
  }

  /**
   * Managed slot — designed for poll loops.
   * Each slot has an AbortController. Calling managed() again for the same
   * slot cancels the previous in-flight request before starting a new one,
   * preventing request pile-up over slow connections.
   *
   * @param slot    Named slot identifier (e.g. "chat-{bookingId}")
   * @param fetcher (signal: AbortSignal) => Promise<T>
   * @param opts.skipWhenHidden   Default true
   * @param opts.circuitKey       Circuit breaker key (defaults to `slot`)
   */
  async managed<T>(
    slot: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    opts: { skipWhenHidden?: boolean; circuitKey?: string } = {},
  ): Promise<T | null> {
    const { skipWhenHidden = true, circuitKey = slot } = opts;

    // 1. Visibility guard
    if (skipWhenHidden && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return null;
    }

    // 2. Circuit breaker
    if (!isAllowed(circuitKey)) {
      console.debug(`[RequestManager] Circuit OPEN — skipping managed "${slot}"`);
      return null;
    }

    // 3. Cancel previous in-flight for this slot
    const prev = slots.get(slot);
    if (prev) prev.abort();

    const controller = new AbortController();
    slots.set(slot, controller);

    try {
      const result = await fetcher(controller.signal);
      recordSuccess(circuitKey);
      return result;
    } catch (err) {
      // AbortError is intentional — do not count as failure
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      recordFailure(circuitKey);
      throw err;
    } finally {
      // Only clear if this controller is still the current one
      if (slots.get(slot) === controller) slots.delete(slot);
    }
  }

  /** Cancel a named slot's in-flight request (call on component unmount). */
  cancel(slot: string) {
    const ctrl = slots.get(slot);
    if (ctrl) {
      ctrl.abort();
      slots.delete(slot);
    }
  }

  /** Cancel all in-flight managed slots (e.g. on logout). */
  cancelAll() {
    for (const [slot, ctrl] of slots) {
      ctrl.abort();
      slots.delete(slot);
    }
    inFlight.clear();
    pendingMutations.clear();
  }

  /** Manually reset the circuit for a key (useful in tests or admin reset). */
  resetCircuit(key: string) {
    circuits.delete(key);
  }

  /** Read-only inspection for debugging. */
  debug() {
    return {
      inFlight:         [...inFlight.keys()],
      slots:            [...slots.keys()],
      pendingMutations: [...pendingMutations],
      circuits:         Object.fromEntries(circuits),
    };
  }
}

/** Singleton — import this everywhere. */
export const rm = new RequestManager();

