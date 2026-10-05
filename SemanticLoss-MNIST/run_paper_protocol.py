"""Official-code protocol (semloss/paper_protocol.py).

Phase 1: tune (batch size, loss weight) for each method at 100 and 1,000 labels on the validation split, seed 0.
Phase 2: 5 seeds of each method with its selected setting; test accuracy at the final step.
Results are cached in results_paper/ (resumable).
"""
import json
from pathlib import Path

import torch

from semloss.data import load_mnist
from semloss.paper_protocol import run_paper

LABELS = (100, 1000)
BATCHES = (10, 32, 128)
WEIGHTS = {"ce": (0.0,), "ce_eo": (0.0005, 0.005, 0.05, 0.5, 1.0), "ce_ent": (0.0005, 0.005, 0.05, 0.5, 1.0)}
SEEDS = (0, 1, 2, 3, 4)
OUT = Path("results_paper")


def cached(data, name, **kw):
    path = OUT / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text())
    print(f"=== {name}", flush=True)
    r = run_paper(data, device=torch.device("mps"), log=lambda s: print(s, flush=True), **kw)
    path.write_text(json.dumps(r, indent=1))
    print(f"    val {r['val']['acc']:.4f}  test {r['test']['acc']:.4f}  ({r['train_seconds']:.0f}s)", flush=True)
    return r


def main():
    (OUT / "tune").mkdir(parents=True, exist_ok=True)
    data = load_mnist("data")
    best = {}
    for n in LABELS:
        for m, ws in WEIGHTS.items():
            scores = {}
            for b in BATCHES:
                for w in ws:
                    r = cached(data, f"tune/n{n}_{m}_b{b}_w{w}_seed0", n_labeled=n, method=m, seed=0, weight=w, batch_size=b)
                    scores[(b, w)] = r["val"]["acc"]
            b, w = max(scores, key=scores.get)
            best[f"{n}_{m}"] = {"batch_size": b, "weight": w}
            print(f"*** n={n} {m}: best batch={b} weight={w} val={scores[(b, w)]:.4f}", flush=True)
    (OUT / "best.json").write_text(json.dumps(best, indent=1))
    for seed in SEEDS:
        for n in LABELS:
            for m in WEIGHTS:
                cfg = best[f"{n}_{m}"]
                cached(data, f"n{n}_{m}_b{cfg['batch_size']}_w{cfg['weight']}_seed{seed}",
                       n_labeled=n, method=m, seed=seed, **cfg)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
