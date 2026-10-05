"""One training run: (n_labeled, method, lambda, seed) -> metrics on val and test, plus a training history."""
import math
import time

import torch
import torch.nn.functional as F

from .data import make_split
from .losses import exactly_one_log_prob, exactly_one_semantic_loss, softmax_entropy
from .model import MLP

METHODS = ("ce", "ce_eo", "ce_ent")


def default_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@torch.no_grad()
def evaluate(model, x, y):
    model.eval()
    z = model(x)
    p = torch.sigmoid(z)
    return {
        "acc": (z.argmax(1) == y).float().mean().item(),
        # Rule compliance under the independent-sigmoid reading of the outputs.
        "mean_log_pr_eo": exactly_one_log_prob(z).mean().item(),
        "mean_pr_eo": exactly_one_log_prob(z).exp().mean().item(),
        "onehot_rate": ((p > 0.5).sum(1) == 1).float().mean().item(),
        "softmax_entropy": softmax_entropy(z).item(),
    }


def run(data, n_labeled, method, seed, lam=0.0, epochs=20, batch_labeled=100, batch_unlabeled=250,
        lr=2e-3, warmup_frac=0.1, device=None, log=print):
    """Each step uses a labeled batch (sampled with replacement) and an unlabeled batch drawn from all
    training images; one epoch = one pass over the unlabeled stream. Every method takes the same steps."""
    assert method in METHODS
    device = device or default_device()
    torch.manual_seed(seed)
    split = make_split(data, n_labeled, seed)
    x_all = data["train"]["x"].to(device).float() / 255
    y_all = data["train"]["y"].to(device)
    tr, va = split["train_idx"].to(device), split["val_idx"].to(device)
    x_tr, y_tr = x_all[tr], y_all[tr]
    lab = split["labeled"].to(device)
    x_va, y_va = x_all[va], y_all[va]
    x_te = data["test"]["x"].to(device).float() / 255
    y_te = data["test"]["y"].to(device)

    model = MLP().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    steps_per_epoch = math.ceil(len(tr) / batch_unlabeled)
    total = epochs * steps_per_epoch
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=total, pct_start=0.1)
    history, step, t0 = [], 0, time.time()
    for epoch in range(epochs):
        model.train()
        perm = torch.randperm(len(tr), device=device)
        sums = {"ce": 0.0, "reg": 0.0}
        for i in range(0, len(tr), batch_unlabeled):
            bl = lab[torch.randint(len(lab), (min(batch_labeled, len(lab)),), device=device)]
            bu = perm[i:i + batch_unlabeled]
            x = torch.cat([x_tr[bl], x_tr[bu]])
            z = model(x)
            zl = z[:len(bl)]
            ce = F.cross_entropy(zl, y_tr[bl])
            loss = ce
            lam_t = lam * min(1.0, step / (warmup_frac * total))
            if method == "ce_eo":
                reg = exactly_one_semantic_loss(z)        # knowledge only, no labels: every image
            elif method == "ce_ent":
                reg = softmax_entropy(z)                  # control: just make predictions confident
            if method != "ce":
                loss = loss + lam_t * reg
                sums["reg"] += reg.detach()
            sums["ce"] += ce.detach()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            step += 1
        m = evaluate(model, x_va, y_va)
        history.append({"epoch": epoch + 1, "ce": float(sums["ce"]) / steps_per_epoch,
                        "reg": float(sums["reg"]) / steps_per_epoch, **{f"val_{k}": v for k, v in m.items()}})
        if epoch == 0 or (epoch + 1) % 5 == 0:
            log(f"  ep {epoch + 1:2d}/{epochs} | ce {history[-1]['ce']:.3f} reg {history[-1]['reg']:.3f}"
                f" | val acc {m['acc']:.4f} Pr(EO) {m['mean_pr_eo']:.3f} | {time.time() - t0:.0f}s")

    return {"n_labeled": n_labeled, "method": method, "seed": seed, "lam": lam, "epochs": epochs,
            "train_seconds": time.time() - t0, "val": evaluate(model, x_va, y_va),
            "test": evaluate(model, x_te, y_te), "history": history}
