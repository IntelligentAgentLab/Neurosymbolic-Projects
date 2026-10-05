"""Aggregates results/ into results/summary.md (mean ± std over seeds)."""
import json
import statistics
from pathlib import Path

from semloss.kb import CLASSES
from semloss.train import METHODS, ZS_METHODS

OUT = Path("results")


def ms(v, scale=100, d=2):
    m = statistics.mean(v) * scale
    s = (statistics.stdev(v) if len(v) > 1 else 0.0) * scale
    return f"{m:.{d}f} ± {s:.{d}f}"


def load(dirname):
    return [json.loads(p.read_text()) for p in sorted((OUT / dirname).glob("*.json"))]


def main():
    best = json.loads((OUT / "best_lambda.json").read_text())
    main_runs = load("main")
    lines = ["# AwA2 five-animal results (test set, mean ± std over seeds, %)", ""]
    for setting in ("semi", "weak"):
        lines += [f"## {setting}", "", "| method | λ | n | class acc | class acc (KB MAP) | attribute acc | KB consistency | > ce_attr (seeds) |",
                  "|---|---|---|---|---|---|---|---|"]
        ref = sorted((r for r in main_runs if r["setting"] == setting and r["method"] == "ce_attr"), key=lambda r: r["seed"])
        for m in METHODS:
            lam = best.get(f"{setting}_{m}", 0.0)
            rs = sorted((r for r in main_runs if r["setting"] == setting and r["method"] == m and r["lam"] == lam), key=lambda r: r["seed"])
            if not rs:
                continue
            t = lambda k: [r["test"][k] for r in rs]  # noqa: E731
            wins = sum(a["test"]["class_acc"] > b["test"]["class_acc"] for a, b in zip(rs, ref)) if m != "ce_attr" else "—"
            lines.append(f"| {m} | {lam if m not in ('ce', 'ce_attr') else '—'} | {len(rs)} | {ms(t('class_acc'))} | {ms(t('map_acc'))} | "
                         f"{ms(t('attr_acc'))} | {ms(t('kb_consistency'))} | {wins} |")
        lines.append("")
        lines += [f"Per-class accuracy ({setting})", "", "| method | " + " | ".join(CLASSES) + " |", "|---|" + "---|" * len(CLASSES)]
        for m in METHODS:
            lam = best.get(f"{setting}_{m}", 0.0)
            rs = [r for r in main_runs if r["setting"] == setting and r["method"] == m and r["lam"] == lam]
            if rs:
                lines.append(f"| {m} | " + " | ".join(f"{100 * statistics.mean(r['test']['per_class_acc'][c] for r in rs):.1f}" for c in range(len(CLASSES))) + " |")
        lines.append("")

    tune = load("tune")
    lams = sorted({r["lam"] for r in tune})
    lines += ["## λ tuning (validation class acc %, seed 0)", "", "| setting | method | " + " | ".join(f"λ={l}" for l in lams) + " |",
              "|---|---|" + "---|" * len(lams)]
    for setting in ("semi", "weak"):
        for m in sorted({r["method"] for r in tune}):
            acc = {r["lam"]: r["val"]["class_acc"] for r in tune if r["setting"] == setting and r["method"] == m}
            lines.append(f"| {setting} | {m} | " + " | ".join(f"{100 * acc[l]:.1f}" if l in acc else "—" for l in lams) + " |")
    lines.append("")

    zs = load("zeroshot")
    if zs:
        lines += ["## Zero-shot (held-out class never seen in training; KB MAP from attribute logits)", "",
                  "| held-out | method | unseen acc | seen acc | harmonic mean |", "|---|---|---|---|---|"]
        for c in CLASSES:
            for m in ZS_METHODS:
                rs = [r for r in zs if r["heldout"] == c and r["method"] == m]
                if rs:
                    lines.append(f"| {c} | {m} | {ms([r['unseen_acc'] for r in rs])} | {ms([r['seen_acc'] for r in rs])} | {ms([r['harmonic'] for r in rs])} |")
        lines += ["", "| method | mean unseen acc | mean seen acc | mean harmonic |", "|---|---|---|---|"]
        for m in ZS_METHODS:
            rs = [r for r in zs if r["method"] == m]
            if rs:
                lines.append(f"| {m} | {ms([r['unseen_acc'] for r in rs])} | {ms([r['seen_acc'] for r in rs])} | {ms([r['harmonic'] for r in rs])} |")
    text = "\n".join(lines) + "\n"
    (OUT / "summary.md").write_text(text)
    print(text)


if __name__ == "__main__":
    main()
