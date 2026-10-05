"""Builds the five-animal AwA2 subset.

1. Picks up to PER_CLASS random images per class (fixed seed) from the remote AwA2-data.zip, and downloads
   only those JPEGs and their license files (HTTP range requests) into CACHE (outside Dropbox).
2. Resizes every image (shorter side -> RES, center crop) and writes data/awa2_5_{RES}.npz with uint8 images,
   labels, file names, and a fixed stratified 60/20/20 train/val/test split.

Usage: python prepare_data.py [--res 96] [--per-class 700] [--workers 8]
"""
import argparse
import io
import struct
import time
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

from semloss.kb import CLASSES
from semloss.remote_zip import open_remote_zip

URL = "https://cvml.ista.ac.at/AwA2/AwA2-data.zip"
CACHE = Path.home() / ".cache" / "semloss-awa2"
PREFIX = "Animals_with_Attributes2/"


def fetch_member(info):
    """Downloads one zip member with a single range request (thread-safe, no shared file object)."""
    start = info.header_offset
    end = start + 30 + len(info.filename.encode()) + 1024 + info.compress_size  # local header + generous extra
    req = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{end - 1}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw = r.read()
    sig, *_rest = struct.unpack("<IHHHHHIIIHH", raw[:30])
    if sig != 0x04034B50:
        raise RuntimeError(f"bad local header for {info.filename}")
    name_len, extra_len = struct.unpack("<HH", raw[26:30])
    body = raw[30 + name_len + extra_len:30 + name_len + extra_len + info.compress_size]
    if info.compress_type == 0:
        data = body
    elif info.compress_type == 8:
        data = zlib.decompress(body, -15)
    else:
        raise RuntimeError(f"unsupported compression {info.compress_type}")
    if zlib.crc32(data) != info.CRC:
        raise RuntimeError(f"CRC mismatch for {info.filename}")
    return data


def download(per_class, workers, seed=0):
    z = open_remote_zip(URL)
    infos = {i.filename: i for i in z.infolist()}
    rng = np.random.default_rng(seed)
    todo, picked = [], {}
    for c in CLASSES:
        imgs = sorted(n for n in infos if n.startswith(f"{PREFIX}JPEGImages/{c}/") and n.endswith(".jpg"))
        sel = sorted(rng.choice(len(imgs), size=min(per_class, len(imgs)), replace=False))
        picked[c] = [imgs[k] for k in sel]
        for n in picked[c]:
            stem = Path(n).stem
            lic = f"{PREFIX}licenses/{c}/{stem}.txt"
            for member in (n, lic):
                if member in infos and not (CACHE / member[len(PREFIX):]).exists():
                    todo.append(infos[member])
    print(f"{sum(len(v) for v in picked.values())} images selected, {len(todo)} files to download", flush=True)
    t0, done = time.time(), 0

    def job(info):
        data = fetch_member(info)
        out = CACHE / info.filename[len(PREFIX):]
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(data)
        return len(data)

    with ThreadPoolExecutor(workers) as ex:
        for k, nbytes in enumerate(ex.map(job, todo), 1):
            done += nbytes
            if k % 250 == 0 or k == len(todo):
                print(f"  {k}/{len(todo)} files, {done / 1e6:.0f} MB, {time.time() - t0:.0f}s", flush=True)
    return picked


def to_array(path, res):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    s = res / min(w, h)
    im = im.resize((max(res, round(w * s)), max(res, round(h * s))), Image.BICUBIC)
    w, h = im.size
    left, top = (w - res) // 2, (h - res) // 2
    return np.asarray(im.crop((left, top, left + res, top + res)), dtype=np.uint8)


def build(picked, res, seed=0):
    xs, ys, names = [], [], []
    for ci, c in enumerate(CLASSES):
        for n in picked[c]:
            xs.append(to_array(CACHE / n[len(PREFIX):], res))
            ys.append(ci)
            names.append(Path(n).name)
    x, y = np.stack(xs), np.array(ys, dtype=np.int64)
    rng = np.random.default_rng(seed + 1)
    split = np.empty(len(y), dtype="<U5")
    for ci in range(len(CLASSES)):
        idx = rng.permutation(np.flatnonzero(y == ci))
        n_tr, n_va = int(0.6 * len(idx)), int(0.2 * len(idx))
        split[idx[:n_tr]], split[idx[n_tr:n_tr + n_va]], split[idx[n_tr + n_va:]] = "train", "val", "test"
    out = Path("data") / f"awa2_5_{res}.npz"
    out.parent.mkdir(exist_ok=True)
    np.savez_compressed(out, x=x, y=y, names=np.array(names), split=split, classes=np.array(CLASSES))
    print(f"wrote {out}: x {x.shape}, {out.stat().st_size / 1e6:.0f} MB, "
          + ", ".join(f"{s} {int((split == s).sum())}" for s in ("train", "val", "test")), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", type=int, default=96)
    ap.add_argument("--per-class", type=int, default=700)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    picked = download(args.per_class, args.workers)
    build(picked, args.res)


if __name__ == "__main__":
    main()
