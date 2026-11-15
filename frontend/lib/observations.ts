import type { ObservationSet, Pair } from "./types.ts";

export function selectedPair(
  data: ObservationSet,
  a: number,
  b: number,
): Pair | undefined {
  const x = data.frames[a]?.id,
    y = data.frames[b]?.id;
  return data.pairs?.find(
    (p) => (p.a === x && p.b === y) || (p.a === y && p.b === x),
  );
}

export function differenceAllowed(
  data: ObservationSet,
  a: number,
  b: number,
): boolean {
  if (data.source_type === "synthetic") return true;
  // Visual Difference preview is supported whenever two distinct epochs are available.
  return data.frames.length >= 2;
}

export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function checkedJson<T>(response: Response): Promise<T> {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      `Observation service returned ${response.status} without a valid response. Please retry.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : `Observation service returned ${response.status}. Please retry.`,
    );
  }
  return body as T;
}
