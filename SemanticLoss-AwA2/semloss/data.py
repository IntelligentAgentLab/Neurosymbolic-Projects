"""Loads the prepared five-animal subset and does augmentation on the device."""
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F


def load_subset(res_file=96, res=None, device="cpu", root="data"):
    """Returns dict of split -> (x float [0,1] (N,3,R,R), y long). `res` < stored size downsamples once
    (antialiased), so 64x64 and 96x96 runs use exactly the same images."""
    d = np.load(Path(root) / f"awa2_5_{res_file}.npz")
    x = torch.from_numpy(d["x"]).permute(0, 3, 1, 2).float().div(255)
    if res and res != res_file:
        x = F.interpolate(x, size=(res, res), mode="bilinear", antialias=True, align_corners=False)
    y = torch.from_numpy(d["y"])
    split = d["split"]
    out = {}
    for s in ("train", "val", "test"):
        m = torch.from_numpy(split == s)
        out[s] = (x[m].to(device), y[m].to(device))
    out["classes"] = [str(c) for c in d["classes"]]
    return out


class Augment:
    """Random crop (pad 1/8 of the size, reflect) + horizontal flip + per-channel normalization."""

    def __init__(self, x_train):
        self.mean = x_train.mean((0, 2, 3), keepdim=True)
        self.std = x_train.std((0, 2, 3), keepdim=True)

    def normalize(self, x):
        return (x - self.mean) / self.std

    def __call__(self, x):
        b, _, h, w = x.shape
        pad = h // 8
        x = F.pad(self.normalize(x), (pad,) * 4, mode="reflect")
        oy = torch.randint(0, 2 * pad + 1, (b,), device=x.device)
        ox = torch.randint(0, 2 * pad + 1, (b,), device=x.device)
        rows = (oy[:, None] + torch.arange(h, device=x.device))[:, None, :, None]
        cols = (ox[:, None] + torch.arange(w, device=x.device))[:, None, None, :]
        x = x[torch.arange(b, device=x.device)[:, None, None, None], torch.arange(3, device=x.device)[None, :, None, None], rows, cols]
        flip = torch.rand(b, device=x.device) < 0.5
        return torch.where(flip[:, None, None, None], x.flip(3), x)
