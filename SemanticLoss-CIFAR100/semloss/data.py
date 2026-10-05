"""CIFAR-100 loading (no torchvision), label-availability splits, and GPU augmentation."""
import hashlib
import pickle
import tarfile
import urllib.request
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

URL = "https://www.cs.toronto.edu/~kriz/cifar-100-python.tar.gz"
MD5 = "eb9058c3a382ffc7106e4002c42a8d85"
MEAN = (0.5071, 0.4865, 0.4409)
STD = (0.2673, 0.2564, 0.2762)

SETTINGS = ("full", "semi", "weak")


def download(root):
    root = Path(root)
    folder = root / "cifar-100-python"
    if folder.exists():
        return folder
    root.mkdir(parents=True, exist_ok=True)
    archive = root / "cifar-100-python.tar.gz"
    if not archive.exists():
        print(f"Downloading {URL} ...")
        urllib.request.urlretrieve(URL, archive)
    md5 = hashlib.md5(archive.read_bytes()).hexdigest()
    if md5 != MD5:
        raise RuntimeError(f"MD5 mismatch for {archive}: {md5} != {MD5}")
    with tarfile.open(archive) as tar:
        tar.extractall(root, filter="data")
    return folder


def load_cifar100(root="data"):
    """Returns dict with train/test uint8 images (N,3,32,32), fine/coarse labels, parent map, names."""
    folder = download(root)

    def read(name):
        with open(folder / name, "rb") as f:
            return pickle.load(f, encoding="latin1")

    out = {}
    for split in ("train", "test"):
        d = read(split)
        out[split] = {
            "x": torch.from_numpy(np.asarray(d["data"], dtype=np.uint8).reshape(-1, 3, 32, 32)),
            "fine": torch.tensor(d["fine_labels"]),
            "coarse": torch.tensor(d["coarse_labels"]),
        }
    meta = read("meta")
    parent = torch.full((100,), -1, dtype=torch.long)
    parent[out["train"]["fine"]] = out["train"]["coarse"]
    assert (parent >= 0).all()
    for split in ("train", "test"):  # the hierarchy must be a function fine -> coarse
        assert torch.equal(parent[out[split]["fine"]], out[split]["coarse"])
    out["parent"] = parent
    out["fine_names"] = meta["fine_label_names"]
    out["coarse_names"] = meta["coarse_label_names"]
    return out


def stratified_subset(labels, per_class_frac, generator):
    """Boolean mask selecting round(frac * n_c) random items of every class c."""
    mask = torch.zeros(len(labels), dtype=torch.bool)
    for c in labels.unique():
        idx = (labels == c).nonzero().squeeze(1)
        k = round(per_class_frac * len(idx))
        mask[idx[torch.randperm(len(idx), generator=generator)[:k]]] = True
    return mask


def make_split(data, setting, label_frac, seed, val_per_class=50):
    """Train/val split (val is fixed across seeds) and label-availability masks.

    full: every training image has fine and coarse labels.
    semi: a label_frac subset has fine (and hence coarse) labels; the rest is unlabeled.
    weak: a label_frac subset has fine labels; every image has a coarse label.
    """
    assert setting in SETTINGS
    fine = data["train"]["fine"]
    val_mask = stratified_subset(fine, val_per_class / 500, torch.Generator().manual_seed(12345))
    train_idx = (~val_mask).nonzero().squeeze(1)
    val_idx = val_mask.nonzero().squeeze(1)

    n = len(train_idx)
    if setting == "full":
        has_fine = torch.ones(n, dtype=torch.bool)
    else:
        has_fine = stratified_subset(fine[train_idx], label_frac, torch.Generator().manual_seed(seed))
    has_coarse = torch.ones(n, dtype=torch.bool) if setting in ("full", "weak") else has_fine.clone()
    return {"train_idx": train_idx, "val_idx": val_idx, "has_fine": has_fine, "has_coarse": has_coarse}


class GPUAugment:
    """Random crop (4px reflect padding) + horizontal flip + normalization, batched on device."""

    def __init__(self, device, pad=4):
        self.pad = pad
        self.mean = torch.tensor(MEAN, device=device).view(1, 3, 1, 1)
        self.std = torch.tensor(STD, device=device).view(1, 3, 1, 1)

    def normalize(self, x_uint8):
        return (x_uint8.float() / 255 - self.mean) / self.std

    def __call__(self, x_uint8):
        x = self.normalize(x_uint8)
        b, _, h, w = x.shape
        x = F.pad(x, (self.pad,) * 4, mode="reflect")
        oy = torch.randint(0, 2 * self.pad + 1, (b,), device=x.device)
        ox = torch.randint(0, 2 * self.pad + 1, (b,), device=x.device)
        rows = (oy[:, None] + torch.arange(h, device=x.device))[:, None, :, None]
        cols = (ox[:, None] + torch.arange(w, device=x.device))[:, None, None, :]
        bidx = torch.arange(b, device=x.device)[:, None, None, None]
        cidx = torch.arange(3, device=x.device)[None, :, None, None]
        x = x[bidx, cidx, rows, cols]
        flip = torch.rand(b, device=x.device) < 0.5
        return torch.where(flip[:, None, None, None], x.flip(3), x)
