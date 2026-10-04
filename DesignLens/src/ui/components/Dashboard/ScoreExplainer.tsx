import { CATEGORY_LABELS } from "@shared/types";
import type { HealthScore } from "@shared/types";
import { SCORE_BANDS, SEVERITY_PENALTY } from "@shared/scoring";

/** Collapsed by default: the score is a number people act on, so it should say how it's made. */
export function ScoreExplainer({ health }: { health: HealthScore }) {
  const weighted = [...health.categories].filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight);
  const unweighted = health.categories.filter((c) => c.weight === 0);

  return (
    <details className="score-explainer">
      <summary>How the health score is calculated</summary>
      <div className="score-explainer-body">
        <p>
          The overall score is a weighted average of the category scores below. Each category starts at 100 and loses
          points for every issue: <strong>{SEVERITY_PENALTY.critical} per critical</strong>,{" "}
          <strong>{SEVERITY_PENALTY.warning} per warning</strong>, <strong>{SEVERITY_PENALTY.suggestion} per suggestion</strong>.
          That total is divided by the size of what was audited (components, layers or tokens, depending on the
          category), so a large library isn't penalised just for being large.
        </p>
        <p>
          <strong>{SCORE_BANDS.healthy}+</strong> is healthy, <strong>{SCORE_BANDS.needsWork}–{SCORE_BANDS.healthy - 1}</strong> needs work,
          and anything below <strong>{SCORE_BANDS.needsWork}</strong> is in trouble.
        </p>
        <table className="score-weights">
          <caption className="visually-hidden">Category weights in the overall score</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Weight</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {weighted.map((c) => (
              <tr key={c.category}>
                <th scope="row">{CATEGORY_LABELS[c.category]}</th>
                <td>{Math.round(c.weight * 100)}%</td>
                <td>{c.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {unweighted.length > 0 && (
          <p className="text-tertiary">
            {unweighted.map((c) => CATEGORY_LABELS[c.category]).join(", ")} {unweighted.length === 1 ? "is" : "are"} shown for
            information and {unweighted.length === 1 ? "doesn't" : "don't"} affect the overall score.
          </p>
        )}
      </div>
    </details>
  );
}
