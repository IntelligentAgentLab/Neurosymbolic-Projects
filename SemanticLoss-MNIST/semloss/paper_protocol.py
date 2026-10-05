"""PyTorch port of the official semi-supervised MNIST code of Xu et al. (2018)
(github.com/UCLA-StarAI/Semantic-Loss, semi_supervised/semantic.py and mnist_input.py).

Deliberate fidelity points (all differ from our own protocol in train.py):
- per-image standardisation, then Gaussian noise (std 0.3) and a random 25x25 crop padded back to 28x28
  (training only);
- MLP 784-1000-500-250-250-250-10 with ReLU, Glorot-uniform init, no effective batch norm (TF1
  `tf.layers.batch_normalization` without `training=True` only applies its fixed initial statistics, i.e. a
  learnable affine map), dropout 0.5 before the output layer;
- supervised loss = sigmoid cross-entropy summed over the 10 outputs (not softmax CE);
- semantic loss weight 0.0005 on every image (labeled and unlabeled), loss averaged over the batch;
- each batch is half labeled, half unlabeled (the unlabeled pool is every training image);
- Adam, lr 1e-4, 50,000 steps.
The official code has no validation set and prints test accuracy during training; here only the final test
accuracy is reported, and the periodic test accuracy is logged for the learning curve only.
"""
import time

import torch
import torch.nn as nn
import torch.nn.functional as F

from .data import make_split
from .losses import exactly_one_log_prob, softmax_entropy


def standardize(x):
    """tf.image.per_image_standardization on flattened 28x28 images."""
    mean = x.mean(1, keepdim=True)
    std = x.std(1, unbiased=False, keepdim=True).clamp(min=1 / 28.0)
    return (x - mean) / std


def noise_and_crop(x, noise=0.3):
    """Gaussian noise, random 25x25 crop, then tf.image.resize_image_with_crop_or_pad back to 28x28
    (pads 1 pixel top/left and 2 bottom/right)."""
    b = x.shape[0]
    x = (x + noise * torch.randn_like(x)).view(b, 28, 28)
    oy = torch.randint(0, 4, (b,), device=x.device)
    ox = torch.randint(0, 4, (b,), device=x.device)
    ar = torch.arange(25, device=x.device)
    rows = (oy[:, None] + ar)[:, :, None]
    cols = (ox[:, None] + ar)[:, None, :]
    crop = x[torch.arange(b, device=x.device)[:, None, None], rows, cols]
    return F.pad(crop, (1, 2, 1, 2)).reshape(b, 784)


class PaperMLP(nn.Module):
    def __init__(self, dropout=0.5):
        super().__init__()
        dims = [784, 1000, 500, 250, 250, 250]
        self.hidden = nn.ModuleList(nn.Linear(a, b) for a, b in zip(dims[:-1], dims[1:]))
        self.affine_w = nn.Parameter(torch.ones(250))   # the never-updated TF1 batch norm = affine map
        self.affine_b = nn.Parameter(torch.zeros(250))
        self.drop = nn.Dropout(dropout)
        self.out = nn.Linear(250, 10)
        for lin in [*self.hidden, self.out]:
            nn.init.xavier_uniform_(lin.weight)
            nn.init.zeros_(lin.bias)

    def forward(self, x):
        for lin in self.hidden:
            x = F.relu(lin(x))
        x = x / (1 + 1e-3) ** 0.5 * self.affine_w + self.affine_b
        return self.out(self.drop(x))


@torch.no_grad()
def evaluate(model, x, y):
    model.eval()
    z = model(standardize(x))
    p = torch.sigmoid(z)
    return {
        "acc": (z.argmax(1) == y).float().mean().item(),
        "mean_log_pr_eo": exactly_one_log_prob(z).mean().item(),
        "mean_pr_eo": exactly_one_log_prob(z).exp().mean().item(),
        "onehot_rate": ((p > 0.5).sum(1) == 1).float().mean().item(),
        "softmax_entropy": softmax_entropy(z).item(),
    }


def run_paper(data, n_labeled, method, seed, weight=0.0005, steps=50000, batch_size=32, lr=1e-4,
              eval_every=2500, device=None, log=print):
    """method: 'ce' (sigmoid CE only), 'ce_eo' (+ semantic loss), 'ce_ent' (+ softmax entropy)."""
    assert method in ("ce", "ce_eo", "ce_ent")
    device = device or torch.device("cpu")
    torch.manual_seed(seed)
    split = make_split(data, n_labeled, seed)
    x_all = data["train"]["x"].to(device).float() / 255
    y_all = data["train"]["y"].to(device)
    tr = split["train_idx"].to(device)
    x_tr, y_tr = x_all[tr], y_all[tr]
    lab = split["labeled"].to(device)
    x_te, y_te = data["test"]["x"].to(device).float() / 255, data["test"]["y"].to(device)
    va = split["val_idx"].to(device)
    x_va, y_va = x_all[va], y_all[va]

    model = PaperMLP().to(device)
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    half = batch_size // 2
    n_lab = min(half, len(lab))
    eye = torch.eye(10, device=device)
    curve, t0 = [], time.time()
    lab_perm, lab_pos = torch.randperm(len(lab), device=device), 0
    unl_perm, unl_pos = torch.randperm(len(tr), device=device), 0
    for step in range(1, steps + 1):
        model.train()
        if lab_pos + n_lab > len(lab):  # epoch-wise shuffling, as in the official DataSet.next_batch
            lab_perm, lab_pos = torch.randperm(len(lab), device=device), 0
        if unl_pos + half > len(tr):
            unl_perm, unl_pos = torch.randperm(len(tr), device=device), 0
        bl = lab[lab_perm[lab_pos:lab_pos + n_lab]]
        bu = unl_perm[unl_pos:unl_pos + half]
        lab_pos += n_lab
        unl_pos += half
        x = noise_and_crop(standardize(torch.cat([x_tr[bl], x_tr[bu]])))
        z = model(x)
        is_lab = torch.zeros(len(x), device=device)
        is_lab[:n_lab] = 1
        bce = F.binary_cross_entropy_with_logits(z[:n_lab], eye[y_tr[bl]], reduction="none").sum(1)
        per_example = torch.zeros(len(x), device=device)
        per_example[:n_lab] = bce
        if method == "ce_eo":
            per_example = per_example - weight * exactly_one_log_prob(z)
        elif method == "ce_ent":
            logp = F.log_softmax(z, dim=-1)
            per_example = per_example + weight * (-(logp.exp() * logp).sum(-1))
        loss = per_example.mean()
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        if step % eval_every == 0 or step == steps:
            m = evaluate(model, x_te, y_te)
            curve.append({"step": step, **{f"test_{k}": v for k, v in m.items()}})
            if step % (eval_every * 4) == 0 or step == steps:
                log(f"  step {step:6d} | test acc {m['acc']:.4f} Pr(EO) {m['mean_pr_eo']:.3f} | {time.time() - t0:.0f}s")
    return {"protocol": "paper", "n_labeled": n_labeled, "method": method, "seed": seed, "weight": weight,
            "steps": steps, "batch_size": batch_size, "lr": lr, "train_seconds": time.time() - t0,
            "val": evaluate(model, x_va, y_va), "test": evaluate(model, x_te, y_te), "curve": curve}
