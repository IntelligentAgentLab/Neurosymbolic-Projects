"""Full experiment: tune lambda on the validation split, then 3 settings x 3 methods x 3 seeds.

Each run writes results/<name>.json and is skipped if that file already exists (resumable).
Usage: python run_experiments.py [--epochs 30] [--label-frac 0.1]
"""
import argparse
import json
import warnings
from pathlib import Path

from semloss.data import SETTINGS, load_cifar100
from semloss.train import ABLATIONS, METHODS, run

LAMBDAS = (0.005, 0.02, 0.1, 0.5, 1.0, 2.0, 5.0)
EO_LAMBDAS = (0.5, 1.0, 2.0)
SEEDS = (0, 1, 2)


def run_cached(data, out_dir, name, **kw):
    path = out_dir / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    print(f"=== {name}", flush=True)
    res = run(data, log=lambda s: print(s, flush=True), **kw)
    path.write_text(json.dumps(res, indent=2))
    t = res["test"]
    print(f"    test fine {t['fine_acc']:.4f} coarse {t['coarse_acc']:.4f} cons {t['consistency']:.4f}", flush=True)
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--label-frac", type=float, default=0.1)
    ap.add_argument("--out", default="results")
    args = ap.parse_args()
    warnings.filterwarnings("ignore", message=r"dtype\(\): align")  # numpy 2.4 vs. old CIFAR pickle
    out_dir = Path(args.out)
    (out_dir / "tune").mkdir(parents=True, exist_ok=True)
    data = load_cifar100("data")
    common = dict(epochs=args.epochs, label_frac=args.label_frac)

    # Phase 1: choose lambda per setting by validation fine accuracy (seed 0).
    best = {}
    for setting in SETTINGS:
        scores = {}
        for lam in LAMBDAS:
            r = run_cached(data, out_dir / "tune", f"{setting}_ce_both_sl_lam{lam}_seed0",
                           setting=setting, method="ce_both_sl", seed=0, lam=lam, **common)
            scores[lam] = r["val"]["fine_acc"]
        best[setting] = max(scores, key=scores.get)
        print(f"*** {setting}: val fine acc by lambda {scores} -> lambda={best[setting]}", flush=True)
    (out_dir / "best_lambda.json").write_text(json.dumps(best, indent=2))

    # Phase 2: main grid evaluated on the test set.
    for seed in SEEDS:
        for setting in SETTINGS:
            for method in METHODS:
                lam = best[setting] if method == "ce_both_sl" else 0.0
                tag = f"_lam{lam}" if method == "ce_both_sl" else ""
                run_cached(data, out_dir, f"{setting}_{method}{tag}_seed{seed}",
                           setting=setting, method=method, seed=seed, lam=lam, **common)

    # Phase 3: exactly-one-only ablation (same protocol: tune lambda on val, then 3 seeds on test).
    best_eo = {}
    for setting in SETTINGS:
        scores = {}
        for lam in EO_LAMBDAS:
            r = run_cached(data, out_dir / "tune", f"{setting}_ce_both_eo_lam{lam}_seed0",
                           setting=setting, method="ce_both_eo", seed=0, lam=lam, **common)
            scores[lam] = r["val"]["fine_acc"]
        best_eo[setting] = max(scores, key=scores.get)
        print(f"*** {setting} (eo): val fine acc by lambda {scores} -> lambda={best_eo[setting]}", flush=True)
    (out_dir / "best_lambda_eo.json").write_text(json.dumps(best_eo, indent=2))
    for seed in SEEDS:
        for setting in SETTINGS:
            for method in ABLATIONS:
                run_cached(data, out_dir, f"{setting}_{method}_lam{best_eo[setting]}_seed{seed}",
                           setting=setting, method=method, seed=seed, lam=best_eo[setting], **common)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
