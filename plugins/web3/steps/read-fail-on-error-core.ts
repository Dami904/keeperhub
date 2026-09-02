/**
 * Shared "Fail workflow on error" handling for the web3 read steps.
 *
 * IMPORTANT: This file must NOT contain "use step" or be a step file.
 * It exists so that multiple step files can reuse the soft-fail decision
 * without exporting functions from "use step" files (which breaks the
 * workflow bundler).
 */
import "server-only";
import { redactAllUrls } from "@/lib/rpc/scrub-rpc-urls";
import { resolveFailOnError } from "@/lib/utils";

/** The `failOnError` config field carried by every web3 read action. */
export type ReadFailOnErrorInput = {
  // Mirrors HTTP Request's failOnError. Defaults to true. See
  // softenReadFailure below for which failures the toggle covers.
  failOnError?: boolean;
};

/**
 * The payload a read step returns in place of its `success: false` when the
 * author turned "Fail workflow on error" off: the next node receives the
 * error and decides what to do, instead of the run aborting on a transient
 * miss. Callers spread it over their own success shape with the data fields
 * set to null, so a downstream node can tell a soft failure apart from a real
 * read by checking `error`. Returns undefined when the toggle is on, so the
 * caller falls through to its hard failure.
 *
 * Only the on-chain read attempt is eligible. Config problems (bad address or
 * ABI, unknown network, unresolved RPC, no token selected) recur on every
 * execution, so callers hard-fail those regardless of the toggle; softening
 * them would let a broken node run forever without the author noticing. This
 * mirrors HTTP Request's SSRF and malformed-URL carve-out.
 *
 * The message is redacted here because every web3 URL is an RPC provider
 * endpoint, and withStepLogging only redacts the `success: false` branch (see
 * redactStepError in step-handler.ts) -- a softened success gets no redaction
 * safety net downstream.
 */
export function softenReadFailure(
  failOnError: unknown,
  message: string
): { success: true; error: string } | undefined {
  if (resolveFailOnError(failOnError)) {
    return;
  }
  return { success: true, error: redactAllUrls(message) };
}
