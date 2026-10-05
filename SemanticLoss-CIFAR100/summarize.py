"""Aggregates results/*.json into mean +- std tables (Markdown) and writes results/summary.md."""
import json
import statistics
from pathlib import Path

from semloss.data import SETTINGS
from semloss.train import ABLATIONS, METHODS

METRICS = [
    ("fine_acc", "fine acc"),
    ("fine_acc_joint", "fine acc (joint MAP)"),
    ("fine_acc_masked", "fine acc (masked)"),
    ("coarse_acc", "coarse acc"),
    ("coarse_acc_via_fine", "coarse via fine"),
    ("consistency", "consistency"),
    ("mean_log_pr_alpha", "mean log Pr(α)"),
    ("within_superclass_err", "within-superclass err"),
]
# ce_fine never trains the coarse head, so metrics that read it are meaningless there.
USES_COARSE_HEAD = {"fine_acc_joint", "fine_acc_masked", "coarse_acc", "consistency", "mean_log_pr_alpha"}


def fmt(vals, key):
    m = statistics.mean(vals)
    s = statistics.stdev(vals) if len(vals) > 1 else 0.0
    if key == "mean_log_pr_alpha":
        return f"{m:.2f} ± {s:.2f}"
    return f"{100 * m:.2f} ± {100 * s:.2f}"


def main(out_dir=Path("results")):
    runs = [json.loads(p.read_text()) for p in sorted(out_dir.glob("*_seed*.json"))]
    best = json.loads((out_dir / "best_lambda.json").read_text())
    eo_path = out_dir / "best_lambda_eo.json"
    best_eo = json.loads(eo_path.read_text()) if eo_path.exists() else {}
    methods = METHODS + ABLATIONS
    lines = ["# Results (test set, mean ± std over seeds; accuracies in %)", ""]
    for setting in SETTINGS:
        chosen = {"ce_both_sl": best.get(setting), "ce_both_eo": best_eo.get(setting)}
        rows = {m: [r for r in runs if r["setting"] == setting and r["method"] == m
                    and (m not in chosen or r["lam"] == chosen[m])] for m in methods}
        if not any(rows.values()):
            continue
        n_f = next(r for rs in rows.values() for r in rs)["n_fine_labeled"]
        lines += [f"## {setting}  (fine-labeled train images: {n_f}, λ_sl = {best.get(setting)}, λ_eo = {best_eo.get(setting)})", "",
                  "| metric | " + " | ".join(f"{m} (n={len(rows[m])})" for m in methods) + " |",
                  "|---|" + "---|" * len(methods)]
        for key, label in METRICS:
            cells = []
            for m in methods:
                vals = [r["test"][key] for r in rows[m]]
                cells.append("—" if not vals or (m == "ce_fine" and key in USES_COARSE_HEAD) else fmt(vals, key))
            lines.append(f"| {label} | " + " | ".join(cells) + " |")
        lines.append("")

    lines += ["## λ tuning (validation fine acc, seed 0)", "", "| setting | " + " | ".join(
        f"λ={l}" for l in sorted({json.loads(p.read_text())["lam"] for p in (out_dir / "tune").glob("*_ce_both_sl_*.json")})) + " |"]
    tune = [json.loads(p.read_text()) for p in (out_dir / "tune").glob("*.json") if "_ce_both_sl_" in p.name]
    lams = sorted({r["lam"] for r in tune})
    lines.append("|---|" + "---|" * len(lams))
    for setting in SETTINGS:
        acc = {r["lam"]: r["val"]["fine_acc"] for r in tune if r["setting"] == setting}
        lines.append(f"| {setting} | " + " | ".join(f"{100 * acc[l]:.2f}" if l in acc else "—" for l in lams) + " |")

    text = "\n".join(lines) + "\n"
    (out_dir / "summary.md").write_text(text)
    print(text)


if __name__ == "__main__":
    main()
