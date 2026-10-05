"""MNIST loading (no torchvision) and labeled/unlabeled splits."""
import gzip
import hashlib
import urllib.request
from pathlib import Path

import numpy as np
import torch

MIRROR = "https://ossci-datasets.s3.amazonaws.com/mnist/"  # mirror used by torchvision
FILES = {
    "train_x": ("train-images-idx3-ubyte.gz", "f68b3c2dcbeaaa9fbdd348bbdeb94873"),
    "train_y": ("train-labels-idx1-ubyte.gz", "d53e105ee54ea40749a09fcbcd1e9432"),
    "test_x": ("t10k-images-idx3-ubyte.gz", "9fb629c4189551a2d022fa330f9573f3"),
    "test_y": ("t10k-labels-idx1-ubyte.gz", "ec29112dd5afa0611ce80d1b7f02629c"),
}


def _fetch(root, name, md5):
    path = Path(root) / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading {MIRROR + name} ...")
        urllib.request.urlretrieve(MIRROR + name, path)
    got = hashlib.md5(path.read_bytes()).hexdigest()
    if got != md5:
        raise RuntimeError(f"MD5 mismatch for {path}: {got} != {md5}")
    return path


def _read_idx(path):
    with gzip.open(path, "rb") as f:
        data = f.read()
    ndim = data[3]
    shape = tuple(int.from_bytes(data[4 + 4 * i:8 + 4 * i], "big") for i in range(ndim))
    return np.frombuffer(data, dtype=np.uint8, offset=4 + 4 * ndim).reshape(shape)


def load_mnist(root="data"):
    """Returns {'train': {'x': uint8 (N,784), 'y': long (N,)}, 'test': {...}}."""
    arr = {k: _read_idx(_fetch(root, name, md5)) for k, (name, md5) in FILES.items()}
    out = {}
    for split in ("train", "test"):
        x = torch.from_numpy(arr[f"{split}_x"].reshape(-1, 784).copy())
        y = torch.from_numpy(arr[f"{split}_y"].astype(np.int64))
        out[split] = {"x": x, "y": y}
    return out


def stratified_pick(labels, per_class, generator):
    """Indices of `per_class` random items of every class."""
    picks = []
    for c in labels.unique():
        idx = (labels == c).nonzero().squeeze(1)
        picks.append(idx[torch.randperm(len(idx), generator=generator)[:per_class]])
    return torch.cat(picks)


def make_split(data, n_labeled, seed, val_per_class=500):
    """Fixed validation split (5,000 images), then `n_labeled` labeled training images (seed-dependent).

    n_labeled = None means every training image is labeled.
    """
    y = data["train"]["y"]
    val_idx = stratified_pick(y, val_per_class, torch.Generator().manual_seed(12345))
    mask = torch.ones(len(y), dtype=torch.bool)
    mask[val_idx] = False
    train_idx = mask.nonzero().squeeze(1)
    if n_labeled is None:
        labeled = torch.arange(len(train_idx))
    else:
        labeled = stratified_pick(y[train_idx], n_labeled // 10, torch.Generator().manual_seed(seed))
    return {"train_idx": train_idx, "val_idx": val_idx, "labeled": labeled}
