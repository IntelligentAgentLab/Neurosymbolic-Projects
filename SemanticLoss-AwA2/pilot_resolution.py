"""Pilot: same images at 64x64 and 96x96, supervised class CE only (all training labels).
Reports validation/test accuracy and time per run so the resolution can be chosen.
Usage: python pilot_resolution.py [--epochs 60] [--seeds 0 1]
"""
import argparse
import json
import time
from pathlib import Path

import torch
import torch.nn.functional as F

from semloss.data import Augment, load_subset
from semloss.model import SmallCNN


def device():
    return torch.device("mps" if torch.backends.mps.is_available() else "cuda" if torch.cuda.is_available() else "cpu")


@torch.no_grad()
def accuracy(model, aug, x, y):
    model.eval()
    z = torch.cat([model(aug.normalize(x[i:i + 500]))[:, :5] for i in range(0, len(x), 500)])
    pred = z.argmax(1)
    per_class = [(pred[y == c] == c).float().mean().item() for c in range(5)]
    return (pred == y).float().mean().item(), per_class


def run(res, seed, epochs, dev, batch=64, lr=0.05):
    torch.manual_seed(seed)
    d = load_subset(96, res, dev)
    (xtr, ytr), (xva, yva), (xte, yte) = d["train"], d["val"], d["test"]
    aug = Augment(xtr)
    model = SmallCNN(15).to(dev)
    opt = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, nesterov=True, weight_decay=5e-4)
    steps = epochs * ((len(xtr) + batch - 1) // batch)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps, pct_start=0.2)
    t0 = time.time()
    for _ in range(epochs):
        model.train()
        perm = torch.randperm(len(xtr), device=dev)
        for i in range(0, len(xtr), batch):
            b = perm[i:i + batch]
            loss = F.cross_entropy(model(aug(xtr[b]))[:, :5], ytr[b])
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
    secs = time.time() - t0
    va, _ = accuracy(model, aug, xva, yva)
    te, per = accuracy(model, aug, xte, yte)
    return {"res": res, "seed": seed, "epochs": epochs, "val_acc": va, "test_acc": te, "test_per_class": per, "seconds": secs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--seeds", type=int, nargs="+", default=[0, 1])
    args = ap.parse_args()
    dev = device()
    out = []
    for res in (64, 96):
        for seed in args.seeds:
            r = run(res, seed, args.epochs, dev)
            out.append(r)
            print(f"{res}x{res} seed {seed}: val {r['val_acc']:.4f} test {r['test_acc']:.4f} "
                  f"per-class {[round(v, 3) for v in r['test_per_class']]} ({r['seconds']:.0f}s)", flush=True)
    Path("results").mkdir(exist_ok=True)
    Path("results/pilot_resolution.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
