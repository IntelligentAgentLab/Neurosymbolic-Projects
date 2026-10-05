"""Aggregates results/*.json into results/summary.md (mean ± std over seeds)."""
import json
import statistics
from pathlib import Path

LABELS = (100, 500, 1000)
METHODS = ("ce", "ce_eo", "ce_ent")
METRICS = [("acc", "test accuracy (%)", 100), ("mean_pr_eo", "mean Pr(exactly-one)", 1),
           ("onehot_rate", "one-hot rate (%)", 100), ("softmax_entropy", "softmax entropy", 1)]


def ms(vals, scale):
    m = statistics.mean(vals) * scale
    s = (statistics.stdev(vals) if len(vals) > 1 else 0.0) * scale
    return f"{m:.2f} ± {s:.2f}" if scale == 100 else f"{m:.3f} ± {s:.3f}"


def main(out=Path("results")):
    best = json.loads((out / "best_lambda.json").read_text())
    runs = [json.loads(p.read_text()) for p in out.glob("n*_seed*.json")]

    def pick(n, m):
        lam = best.get(f"{n}_{m}", 0.0)
        return sorted((r for r in runs if r["n_labeled"] == n and r["method"] == m and r["lam"] == lam),
                      key=lambda r: r["seed"])

    lines = ["# MNIST semi-supervised results (test set, mean ± std over seeds)", ""]
    full = sorted((r for r in runs if r["n_labeled"] is None), key=lambda r: r["seed"])
    if full:
        lines += [f"Fully supervised CE reference (55,000 labels, n={len(full)}): "
                  f"{ms([r['test']['acc'] for r in full], 100)} %", ""]
    for key, label, scale in METRICS:
        lines += [f"## {label}", "", "| labels | " + " | ".join(f"{m}" for m in METHODS) + " |",
                  "|---|" + "---|" * len(METHODS)]
        for n in LABELS:
            cells = []
            for m in METHODS:
                rs = pick(n, m)
                cells.append(f"{ms([r['test'][key] for r in rs], scale)} (n={len(rs)})" if rs else "—")
            lines.append(f"| {n} | " + " | ".join(cells) + " |")
        lines.append("")

    lines += ["## Per-seed test accuracy (%)", "", "| labels | method | λ | seeds |", "|---|---|---|---|"]
    for n in LABELS:
        for m in METHODS:
            rs = pick(n, m)
            lines.append(f"| {n} | {m} | {best.get(f'{n}_{m}', '—')} | "
                         + ", ".join(f"{100 * r['test']['acc']:.2f}" for r in rs) + " |")
    lines.append("")

    tune = [json.loads(p.read_text()) for p in (out / "tune").glob("*.json")]
    lams = sorted({r["lam"] for r in tune})
    lines += ["## λ tuning (validation accuracy %, seed 0)", "",
              "| labels | method | " + " | ".join(f"λ={l}" for l in lams) + " |", "|---|---|" + "---|" * len(lams)]
    for n in LABELS:
        for m in ("ce_eo", "ce_ent"):
            acc = {r["lam"]: r["val"]["acc"] for r in tune if r["n_labeled"] == n and r["method"] == m}
            lines.append(f"| {n} | {m} | " + " | ".join(f"{100 * acc[l]:.2f}" if l in acc else "—" for l in lams) + " |")

    text = "\n".join(lines) + "\n"
    (out / "summary.md").write_text(text)
    print(text)


if __name__ == "__main__":
    main()
