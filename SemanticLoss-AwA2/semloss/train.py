"""Training runs for the five-animal AwA2 subset.

Outputs: 15 logits = 5 classes + 10 attributes (kb.CLASSES, kb.ATTRIBUTES).

Main experiment (run): label settings
  semi  10 % of training images have a class label, the rest have nothing.
  weak  10 % have a class label; every other image has answers to 2 random attribute questions
        (confident attributes only, answers derived from its class).
Methods
  ce            class CE on class-labeled images
  ce_attr       + attribute BCE on every known attribute answer (class-derived for class-labeled images)
  ce_attr_ent   + lambda * softmax entropy of the class logits (every image)          [confidence control]
  ce_attr_eo    + lambda * semantic loss, KB R1 (exactly-one over classes)
  ce_attr_r12   + lambda * semantic loss, KB R1+R2 (class -> attribute)
  ce_attr_r14   + lambda * semantic loss, KB R1+R4 (general commonsense only)
  ce_attr_all   + lambda * semantic loss, KB R1+R2+R3+R4

Zero-shot (run_zeroshot): one class is removed from training entirely; the other four are fully labeled.
At test time the class is the MAP world of the full KB given the attribute logits only.
"""
import math
import time

import torch
import torch.nn.functional as F

from . import kb
from .data import Augment, load_subset
from .losses import exactly_one_log_prob, log_prob_constraint, semantic_loss, softmax_entropy, world_log_prob
from .model import SmallCNN

NC, NA = len(kb.CLASSES), len(kb.ATTRIBUTES)
METHODS = ("ce", "ce_attr", "ce_attr_ent", "ce_attr_eo", "ce_attr_r12", "ce_attr_r14", "ce_attr_all")
SL_KB = {"ce_attr_r12": "R1R2", "ce_attr_r14": "R1R4", "ce_attr_all": "ALL"}
ZS_METHODS = ("zs_attr", "zs_r14", "zs_all")
ZS_KB = {"zs_r14": "R1R4", "zs_all": "ALL"}


def default_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


class Ctx:
    """Data, KB tensors and augmentation shared by every run (loaded once)."""

    def __init__(self, res=96, device=None):
        self.device = device or default_device()
        self.data = load_subset(96, res, self.device)
        k = kb.build()
        self.worlds = {n: torch.from_numpy(w).float().to(self.device) for n, w in k["worlds"].items()}
        self.targets = torch.from_numpy(k["targets"]).to(self.device)  # (5, 10), -1 unknown
        self.aug = Augment(self.data["train"][0])


def masked_bce(logits, target):
    """Mean BCE over entries with target in {0, 1}; target -1 = unknown."""
    m = target >= 0
    if not m.any():
        return logits.sum() * 0
    return F.binary_cross_entropy_with_logits(logits[m], target[m].float())


@torch.no_grad()
def evaluate(ctx, model, x, y, classes=None):
    """Metrics on (x, y). `classes`: if given, MAP decoding uses attribute logits only (zero-shot)."""
    model.eval()
    z = torch.cat([model(ctx.aug.normalize(x[i:i + 500])) for i in range(0, len(x), 500)])
    zc, za = z[:, :NC], z[:, NC:]
    W = ctx.worlds["ALL"]
    z_map = torch.cat([torch.zeros_like(zc), za], 1) if classes == "attr_only" else z
    map_cls = W[world_log_prob(z_map, W).argmax(1), :NC].argmax(1)
    tgt = ctx.targets[y]
    known = tgt >= 0
    hard = torch.cat([F.one_hot(zc.argmax(1), NC).float(), (za > 0).float()], 1)
    consistent = (hard[:, None, :] == W[None]).all(-1).any(-1)
    return {
        "class_acc": (zc.argmax(1) == y).float().mean().item(),
        "map_acc": (map_cls == y).float().mean().item(),
        "attr_acc": ((za > 0).long() == tgt)[known].float().mean().item(),
        "kb_consistency": consistent.float().mean().item(),
        "mean_log_pr_all": log_prob_constraint(z, W).mean().item(),
        "per_class_acc": [(zc.argmax(1)[y == c] == c).float().mean().item() for c in range(NC)],
        "per_class_map_acc": [(map_cls[y == c] == c).float().mean().item() for c in range(NC)],
        "map_pred": map_cls.tolist() if classes == "attr_only" else None,
    }


def _optim(model, steps, lr):
    opt = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, nesterov=True, weight_decay=5e-4)
    return opt, torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, total_steps=steps, pct_start=0.2)


def _regularizer(ctx, method, z, kb_name=None):
    if method.endswith("_ent"):
        return softmax_entropy(z[:, :NC])
    if method.endswith("_eo"):
        return -exactly_one_log_prob(z[:, :NC]).mean()
    return semantic_loss(z, ctx.worlds[kb_name])


def run(ctx, setting, method, seed, lam=0.0, label_frac=0.1, steps=1500, b_lab=32, b_rest=64, lr=0.05,
        n_questions=2, warmup=0.1, log=print):
    assert setting in ("semi", "weak") and method in METHODS
    dev = ctx.device
    torch.manual_seed(seed)
    xtr, ytr = ctx.data["train"]
    g = torch.Generator().manual_seed(1000 + seed)
    ycpu = ytr.cpu()
    lab = torch.cat([torch.nonzero(ycpu == c).squeeze(1)[torch.randperm(int((ycpu == c).sum()), generator=g)[:round(label_frac * (ycpu == c).sum().item())]]
                     for c in range(NC)]).to(dev)
    is_lab = torch.zeros(len(ytr), dtype=torch.bool, device=dev)
    is_lab[lab] = True
    rest = torch.nonzero(~is_lab).squeeze(1)
    # Attribute answers: class-derived for labeled images; in `weak`, n_questions random confident ones elsewhere.
    attr_t = torch.full((len(ytr), NA), -1, dtype=torch.long, device=dev)
    attr_t[lab] = ctx.targets[ytr[lab]]
    if setting == "weak":
        full = ctx.targets[ytr[rest]].cpu()
        score = torch.rand(full.shape, generator=g)
        score[full < 0] = -1  # never ask an unknown attribute
        ask = score.topk(n_questions, dim=1).indices
        ans = torch.full_like(full, -1)
        ans.scatter_(1, ask, full.gather(1, ask))
        attr_t[rest] = ans.to(dev)

    model = SmallCNN(NC + NA).to(dev)
    opt, sched = _optim(model, steps, lr)
    perm, pos, t0 = torch.randperm(len(rest), device=dev), 0, time.time()
    for step in range(steps):
        model.train()
        if pos + b_rest > len(rest):
            perm, pos = torch.randperm(len(rest), device=dev), 0
        bl = lab[torch.randint(len(lab), (b_lab,), device=dev)]
        br = rest[perm[pos:pos + b_rest]]
        pos += b_rest
        idx = torch.cat([bl, br])
        z = model(ctx.aug(xtr[idx]))
        loss = F.cross_entropy(z[:b_lab, :NC], ytr[bl])
        if method != "ce":
            loss = loss + masked_bce(z[:, NC:], attr_t[idx])
        if method not in ("ce", "ce_attr"):
            lam_t = lam * min(1.0, step / (warmup * steps))
            loss = loss + lam_t * _regularizer(ctx, method, z, SL_KB.get(method))
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        sched.step()
    secs = time.time() - t0
    (xva, yva), (xte, yte) = ctx.data["val"], ctx.data["test"]
    return {"setting": setting, "method": method, "seed": seed, "lam": lam, "steps": steps,
            "n_class_labeled": int(len(lab)), "train_seconds": secs,
            "val": evaluate(ctx, model, xva, yva), "test": evaluate(ctx, model, xte, yte)}


def run_zeroshot(ctx, heldout, method, seed, lam=0.0, steps=1500, batch=96, lr=0.05, warmup=0.1):
    """Train on the four seen classes (all labeled, class CE over seen classes only + attribute BCE
    [+ semantic loss]); decode classes with the full KB from attribute logits only."""
    assert method in ZS_METHODS and 0 <= heldout < NC
    dev = ctx.device
    torch.manual_seed(seed)
    xtr, ytr = ctx.data["train"]
    seen = torch.nonzero(ytr != heldout).squeeze(1)
    seen_cls = torch.tensor([c for c in range(NC) if c != heldout], device=dev)
    remap = torch.full((NC,), -1, dtype=torch.long, device=dev)
    remap[seen_cls] = torch.arange(NC - 1, device=dev)
    model = SmallCNN(NC + NA).to(dev)
    opt, sched = _optim(model, steps, lr)
    t0 = time.time()
    for step in range(steps):
        model.train()
        idx = seen[torch.randint(len(seen), (batch,), device=dev)]
        z = model(ctx.aug(xtr[idx]))
        loss = F.cross_entropy(z[:, seen_cls], remap[ytr[idx]]) + masked_bce(z[:, NC:], ctx.targets[ytr[idx]])
        if method in ZS_KB:
            lam_t = lam * min(1.0, step / (warmup * steps))
            loss = loss + lam_t * semantic_loss(z, ctx.worlds[ZS_KB[method]])
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        sched.step()
    secs = time.time() - t0
    xte, yte = ctx.data["test"]
    m = evaluate(ctx, model, xte, yte, classes="attr_only")
    pred = torch.tensor(m.pop("map_pred"), device=dev)
    unseen = yte == heldout
    acc_u = (pred[unseen] == heldout).float().mean().item()
    acc_s = (pred[~unseen] == yte[~unseen]).float().mean().item()
    h = 0.0 if acc_u + acc_s == 0 else 2 * acc_u * acc_s / (acc_u + acc_s)
    return {"heldout": kb.CLASSES[heldout], "method": method, "seed": seed, "lam": lam, "steps": steps,
            "train_seconds": secs, "unseen_acc": acc_u, "seen_acc": acc_s, "harmonic": h,
            "unseen_confusion": [int((pred[unseen] == c).sum()) for c in range(NC)], "test": m}
