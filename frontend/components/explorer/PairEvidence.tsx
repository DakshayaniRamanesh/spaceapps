import { ObservationSet } from "@/lib/types";
import { selectedPair } from "@/lib/observations";

export default function PairEvidence({
  data,
  a,
  b,
}: {
  data: ObservationSet;
  a: number;
  b: number;
}) {
  if (data.source_type === "synthetic")
    return <p className="science-notice">{data.notice}</p>;
  const pair = selectedPair(data, a, b);
  const fa = data.frames[a],
    fb = data.frames[b];
  return (
    <section className="science-passport" aria-label="Comparison evidence">
      <p className="eyebrow">REAL SPHEREx · EVIDENCE BEFORE INTERPRETATION</p>
      <p>
        Real SPHEREx exposures, shown in observation-time order. Wavelength and
        image quality can change their appearance; scientific subtraction is not
        validated.
      </p>
      {data.frames.some((frame) => frame.quality.center_valid === false) && (
        <p className="center-warning">
          The requested field center is masked in at least one exposure.
          Brightness measurements there are unavailable.
        </p>
      )}
      <details>
        <summary>Comparison evidence · Subtraction blocked</summary>
        <p>{data.notice}</p>
        <p>
          A: {fa.lambda_um?.toFixed(4) ?? "Unknown"} µm · B:{" "}
          {fb.lambda_um?.toFixed(4) ?? "Unknown"} µm. Values refer to the
          requested field center.
        </p>
        <p>
          {pair?.reason ??
            "No assessed pair. At least two distinct exposures are needed for comparison."}
        </p>
        <ul className="evidence-checks">
          {pair?.checks.map((check) => (
            <li key={check.name}>
              <strong data-verdict={check.status}>
                {check.status.toUpperCase()} · {check.name}
              </strong>
              <span>
                {check.reason}
                {check.value != null ? ` (${check.value.toFixed(3)})` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p>
          {data.assessed_records} assessed / {data.archive_records} archive
          records ·{" "}
          {data.search_complete
            ? "Search complete"
            : "Bounded sample; other compatible observations may exist"}
          .
        </p>
        {data.warnings?.length ? (
          <ul>
            {data.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <a href={`/api/observation-sets/${data.dataset_id}/manifest.json`}>
          Download provenance and processing manifest
        </a>
      </details>
    </section>
  );
}
