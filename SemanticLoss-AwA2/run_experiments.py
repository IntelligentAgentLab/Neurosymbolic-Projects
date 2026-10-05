"""AwA2 five-animal experiments. Each run is cached as JSON (resumable).

Phase 1  lambda tuning: semi / weak x {ent, eo, r12, r14, all} x lambda grid, seed 0, by validation class acc.
Phase 2  main grid: 2 settings x 7 methods x 5 seeds, test metrics.
Phase 3  zero-shot: 5 held-out classes x 3 methods x 5 seeds; lambda taken from the semi setting
         (never tuned on the held-out class).
"""
import json
from pathlib import Path

from semloss.train import METHODS, ZS_METHODS, Ctx, run, run_zeroshot

LAMBDAS = (0.03, 0.1, 0.3, 1.0, 3.0)
SEEDS = (0, 1, 2, 3, 4)
TUNED = ("ce_attr_ent", "ce_attr_eo", "ce_attr_r12", "ce_attr_r14", "ce_attr_all")
OUT = Path("results")


def cached(path, fn, **kw):
    if path.exists():
        return json.loads(path.read_text())
    print(f"=== {path.relative_to(OUT)}", flush=True)
    r = fn(**kw)
    path.write_text(json.dumps(r, indent=1))
    t = r.get("test", {})
    msg = (f"unseen {r['unseen_acc']:.3f} seen {r['seen_acc']:.3f} H {r['harmonic']:.3f}" if "unseen_acc" in r
           else f"val cls {r['val']['class_acc']:.4f} | test cls {t['class_acc']:.4f} map {t['map_acc']:.4f} "
                f"attr {t['attr_acc']:.4f} cons {t['kb_consistency']:.4f}")
    print(f"    {msg}  ({r['train_seconds']:.0f}s)", flush=True)
    return r


def main():
    for d in ("tune", "main", "zeroshot"):
        (OUT / d).mkdir(parents=True, exist_ok=True)
    ctx = Ctx()
    best = {}
    for setting in ("semi", "weak"):
        for m in TUNED:
            scores = {lam: cached(OUT / "tune" / f"{setting}_{m}_lam{lam}_seed0.json", lambda **k: run(ctx, **k),
                                  setting=setting, method=m, seed=0, lam=lam)["val"]["class_acc"] for lam in LAMBDAS}
            best[f"{setting}_{m}"] = max(scores, key=scores.get)
            print(f"*** {setting} {m}: {scores} -> lambda={best[f'{setting}_{m}']}", flush=True)
    (OUT / "best_lambda.json").write_text(json.dumps(best, indent=1))

    for seed in SEEDS:
        for setting in ("semi", "weak"):
            for m in METHODS:
                lam = best.get(f"{setting}_{m}", 0.0)
                cached(OUT / "main" / f"{setting}_{m}_lam{lam}_seed{seed}.json", lambda **k: run(ctx, **k),
                       setting=setting, method=m, seed=seed, lam=lam)

    zs_lam = {"zs_attr": 0.0, "zs_r14": best["semi_ce_attr_r14"], "zs_all": best["semi_ce_attr_all"]}
    for seed in SEEDS:
        for h in range(5):
            for m in ZS_METHODS:
                cached(OUT / "zeroshot" / f"h{h}_{m}_lam{zs_lam[m]}_seed{seed}.json", lambda **k: run_zeroshot(ctx, **k),
                       heldout=h, method=m, seed=seed, lam=zs_lam[m])
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    main()
