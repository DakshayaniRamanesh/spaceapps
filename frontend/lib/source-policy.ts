/** Synthetic observations are an opt-in development tool, never a default dataset. */
export const developmentDemoEnabled =
  process.env.NEXT_PUBLIC_ENABLE_SYNTHETIC_DEMO === "true";
export type ProviderHealth = {
  status: string;
  source: string;
  real_data_enabled: boolean;
};
export function mayRequestObservations(
  health: ProviderHealth,
  allowDemo: boolean,
): boolean {
  return (
    health.real_data_enabled === true ||
    (allowDemo && health.source === "synthetic" && health.status === "ok")
  );
}
export function mayDisplaySource(source: string, allowDemo: boolean): boolean {
  return source === "synthetic" ? allowDemo : source === "spherex-irsa";
}
