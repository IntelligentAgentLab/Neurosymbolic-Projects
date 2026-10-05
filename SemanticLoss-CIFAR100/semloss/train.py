"""One training run: (setting, method, lambda, seed) -> metrics on val and test."""
import math
import time

import torch
import torch.nn.functional as F

from .data import GPUAugment, make_split
from .losses import exactly_one_log_prob, hierarchy_log_prob, hierarchy_semantic_loss
from .model import ResNet9

METHODS = ("ce_fine", "ce_both", "ce_both_sl")
# Ablation: EO(f) & EO(c) without the 100 implications f_i -> c_par(i).
ABLATIONS = ("ce_both_eo",)
N_FINE = 100


def default_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@torch.no_grad()
def evaluate(model, x, fine, coarse, parent, aug, batch_size=1000):
    model.eval()
    logits = torch.cat([model(aug.normalize(x[i:i + batch_size])).float()
                        for i in range(0, len(x), batch_size)])
    f, c = logits[:, :N_FINE], logits[:, N_FINE:]
    pred_f = f.argmax(1)
    pred_c = c.argmax(1)
    # Hierarchical masking: fine prediction restricted to children of the predicted coarse class.
    masked = f.masked_fill(parent[None, :] != pred_c[:, None], float("-inf"))
    # MAP world under the constraint: argmax_i (f_i + c_par(i)), see hierarchy_log_prob.
    pred_joint = (f + c[:, parent]).argmax(1)
    wrong = pred_f != fine
    return {
        "fine_acc": (pred_f == fine).float().mean().item(),
        "coarse_acc": (pred_c == coarse).float().mean().item(),
        "coarse_acc_via_fine": (parent[pred_f] == coarse).float().mean().item(),
        "fine_acc_masked": (masked.argmax(1) == fine).float().mean().item(),
        "fine_acc_joint": (pred_joint == fine).float().mean().item(),
        "consistency": (parent[pred_f] == pred_c).float().mean().item(),
        "mean_log_pr_alpha": hierarchy_log_prob(f, c, parent).mean().item(),
        # Among fine errors, share that stays inside the true superclass (milder mistakes).
        "within_superclass_err": (parent[pred_f[wrong]] == coarse[wrong]).float().mean().item(),
    }


def run(data, setting, method, seed, lam=0.0, label_frac=0.1, epochs=30, batch_size=256,
        lr=0.1, weight_decay=5e-4, warmup_epochs=5, device=None, log=print):
    assert method in METHODS + ABLATIONS
    device = device or default_device()
    torch.manual_seed(seed)
    split = make_split(data, setting, label_frac, seed)
    tr, va = split["train_idx"], split["val_idx"]
    x_all, f_all, c_all = (data["train"][k].to(device) for k in ("x", "fine", "coarse"))
    x_tr, f_tr, c_tr = x_all[tr.to(device)], f_all[tr.to(device)], c_all[tr.to(device)]
    has_f, has_c = split["has_fine"].to(device), split["has_coarse"].to(device)
    parent = data["parent"].to(device)
    aug = GPUAugment(device)

    model = ResNet9().to(device)
    opt = torch.optim.SGD(model.parameters(), lr=lr, momentum=0.9, nesterov=True, weight_decay=weight_decay)
    steps_per_epoch = math.ceil(len(tr) / batch_size)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=lr, epochs=epochs, steps_per_epoch=steps_per_epoch,
                                                pct_start=0.25)
    total_steps = epochs * steps_per_epoch
    step, t0 = 0, time.time()
    for epoch in range(epochs):
        model.train()
        perm = torch.randperm(len(tr), device=device)
        sums = {"ce_f": 0.0, "ce_c": 0.0, "sl": 0.0}
        for i in range(0, len(tr), batch_size):
            b = perm[i:i + batch_size]
            x = aug(x_tr[b])
            with torch.autocast(device.type, dtype=torch.bfloat16):
                logits = model(x)
            logits = logits.float()
            f, c = logits[:, :N_FINE], logits[:, N_FINE:]
            mf, mc = has_f[b], has_c[b]
            # Masked means keep the graph static (no data-dependent branching / sync).
            ce_f = (F.cross_entropy(f, f_tr[b], reduction="none") * mf).sum() / mf.sum().clamp(min=1)
            loss = ce_f
            if method != "ce_fine":
                ce_c = (F.cross_entropy(c, c_tr[b], reduction="none") * mc).sum() / mc.sum().clamp(min=1)
                loss = loss + ce_c
                sums["ce_c"] += ce_c.detach()
            if method == "ce_both_sl":
                lam_t = lam * min(1.0, step / (warmup_epochs * steps_per_epoch))
                sl = hierarchy_semantic_loss(f, c, parent)  # label-free: uses every image in the batch
                loss = loss + lam_t * sl
                sums["sl"] += sl.detach()
            if method == "ce_both_eo":
                lam_t = lam * min(1.0, step / (warmup_epochs * steps_per_epoch))
                sl = -(exactly_one_log_prob(f) + exactly_one_log_prob(c)).mean()
                loss = loss + lam_t * sl
                sums["sl"] += sl.detach()
            sums["ce_f"] += ce_f.detach()
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            step += 1
        if epoch == 0 or (epoch + 1) % 5 == 0 or epoch + 1 == epochs:
            m = evaluate(model, x_all[va.to(device)], f_all[va.to(device)], c_all[va.to(device)], parent, aug)
            avg = {k: float(v) / steps_per_epoch for k, v in sums.items()}
            log(f"  ep {epoch + 1:3d}/{epochs} | ce_f {avg['ce_f']:.3f} ce_c {avg['ce_c']:.3f} sl {avg['sl']:.3f}"
                f" | val fine {m['fine_acc']:.4f} coarse {m['coarse_acc']:.4f} cons {m['consistency']:.4f}"
                f" | {time.time() - t0:.0f}s")

    val = evaluate(model, x_all[va.to(device)], f_all[va.to(device)], c_all[va.to(device)], parent, aug)
    te = data["test"]
    test = evaluate(model, te["x"].to(device), te["fine"].to(device), te["coarse"].to(device), parent, aug)
    return {"setting": setting, "method": method, "seed": seed, "lam": lam, "label_frac": label_frac,
            "epochs": epochs, "n_fine_labeled": int(split["has_fine"].sum()),
            "n_coarse_labeled": int(split["has_coarse"].sum()), "train_seconds": time.time() - t0,
            "val": val, "test": test}
