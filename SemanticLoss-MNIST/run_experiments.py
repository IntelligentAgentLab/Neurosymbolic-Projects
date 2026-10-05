"""Semi-supervised MNIST: tune lambda on validation, then 3 label budgets x 3 methods x 5 seeds,
plus a fully supervised CE reference. Each run is cached in results/ (resumable).
Usage: python run_experiments.py [--epochs 30]
"""
import argparse
import json
from pathlib import Path

from semloss.data import load_mnist
from semloss.train import run

LABELS = (100, 500, 1000)
LAMBDAS = (0.01, 0.03, 0.1, 0.3, 1.0, 3.0)
SEEDS = (0, 1, 2, 3, 4)


def run_cached(data, path, **kw):
    if path.exists():
        return json.loads(path.read_text())
    print(f"=== {path.stem}", flush=True)
    res = run(data, log=lambda s: print(s, flush=True), **kw)
    path.write_text(json.dumps(res, indent=1))
    t = res["test"]
    print(f"    test acc {t['acc']:.4f}  Pr(EO) {t['mean_pr_eo']:.3f}  one-hot {t['onehot_rate']:.3f}"
          f"  ({res['train_seconds']:.0f}s)", flush=True)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--out", default="results")
    args = ap.parse_args()
    out = Path(args.out)
    (out / "tune").mkdir(parents=True, exist_ok=True)
    data = load_mnist("data")

    # Phase 1: lambda per (label budget, method) by validation accuracy, seed 0.
    best = {}
    for n in LABELS:
        for method in ("ce_eo", "ce_ent"):
            scores = {}
            for lam in LAMBDAS:
                r = run_cached(data, out / "tune" / f"n{n}_{method}_lam{lam}_seed0.json",
                               n_labeled=n, method=method, seed=0, lam=lam, epochs=args.epochs)
                scores[lam] = r["val"]["acc"]
            best[f"{n}_{method}"] = max(scores, key=scores.get)
            print(f"*** n={n} {method}: val acc by lambda {scores} -> lambda={best[f'{n}_{method}']}", flush=True)
    (out / "best_lambda.json").write_text(json.dumps(best, indent=1))

    # Phase 2: test-set evaluation.
    for seed in SEEDS:
        for n in LABELS:
            for method in ("ce", "ce_eo", "ce_ent"):
                lam = best.get(f"{n}_{method}", 0.0)
                tag = f"_lam{lam}" if method != "ce" else ""
                run_cached(data, out / f"n{n}_{method}{tag}_seed{seed}.json",
                           n_labeled=n, method=method, seed=seed, lam=lam, epochs=args.epochs)
        run_cached(data, out / f"nall_ce_seed{seed}.json", n_labeled=None, method="ce", seed=seed, epochs=args.epochs)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
