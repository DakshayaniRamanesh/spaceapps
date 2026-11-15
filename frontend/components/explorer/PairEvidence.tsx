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
    <div className="science-passport" aria-label="Comparison evidence">
      <details>
        <summary>Comparison evidence · Processing manifest</summary>
        <p>{data.notice}</p>
        {fa && fb && (
          <p>
            A: {fa.lambda_um?.toFixed(4) ?? "Unknown"} µm · B:{" "}
            {fb.lambda_um?.toFixed(4) ?? "Unknown"} µm. Values refer to the
            requested field center.
          </p>
        )}
        <p>
          {pair?.reason ??
            "No assessed pair. At least two distinct exposures are needed for comparison."}
        </p>
        {pair?.checks?.length ? (
          <ul className="evidence-checks">
            {pair.checks.map((check) => (
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
        ) : null}
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
    </div>
  );
}
