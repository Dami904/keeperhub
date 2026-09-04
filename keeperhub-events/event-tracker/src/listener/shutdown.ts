/**
 * Shutdown-time primitives shared by the dispatch path.
 *
 * A matched event parks before it is forwarded to SQS - on the pacer under
 * contention, on the legacy jitter otherwise. That park is the window in
 * which SIGTERM loses the event outright, so shutdown does two things to it:
 * it stops the park (this module's signal) and then waits for the handlers
 * to finish dispatching (`InFlightTracker`).
 */

/**
 * How long `stopAll` waits for in-flight handlers before giving up and
 * letting the process exit.
 *
 * Mirrors `SHUTDOWN_TIMEOUT_MS` in `lib/workflow/executor/runner-constants.ts`
 * (25s inside the K8s 30s default grace period), duplicated because this
 * package cannot import from the root context. The buffer matters: a drain
 * that outlives the grace period is SIGKILLed with nothing logged, which is
 * the failure this drain exists to remove.
 */
export const SHUTDOWN_DRAIN_TIMEOUT_MS = 25_000;

/**
 * Sleeps for `ms`, or returns early when `signal` aborts.
 *
 * Resolves in both cases - it never rejects. An abort here means "stop
 * waiting and dispatch now", not "cancel this event". That is the right
 * trade at shutdown: pacing exists to keep a spike off SQS and the phantom
 * execution API, and a burst into SQS is recoverable where a dropped trigger
 * is not. Because it resolves rather than throws, callers need no
 * abort-specific branch and a parked event follows its normal path straight
 * through to the send.
 */
export function abortableSleep(
  ms: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    // `onAbort` closes over `timer` before it is declared. Safe: the listener
    // is registered after the timer is assigned, so the handle always exists
    // by the time abort can fire.
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
