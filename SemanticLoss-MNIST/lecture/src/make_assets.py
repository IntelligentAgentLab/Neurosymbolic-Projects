"""Assets for the MNIST lecture: digit mosaic, and sigmoid outputs of the three trained models (100 labels, seed 0)."""
import json
import sys
from pathlib import Path

import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from semloss.data import load_mnist, make_split  # noqa: E402
from semloss.model import MLP  # noqa: E402
from semloss import train as T  # noqa: E402

OUT = Path(__file__).resolve().parent / "assets"
OUT.mkdir(exist_ok=True)
data = load_mnist(str(ROOT / "data"))

# Mosaic of 4 x 16 training digits.
g = torch.Generator().manual_seed(1)
idx = torch.randperm(60000, generator=g)[:64]
m = Image.new("L", (16 * 56, 4 * 56), 255)
for j, k in enumerate(idx.tolist()):
    im = Image.fromarray(255 - data["train"]["x"][k].view(28, 28).numpy()).resize((56, 56), Image.NEAREST)
    m.paste(im, ((j % 16) * 56, (j // 16) * 56))
m.save(OUT / "mosaic.png")

# Retrain the three 100-label models (same settings as the main grid) and keep the models.
best = json.loads((ROOT / "results" / "best_lambda.json").read_text())
dev = T.default_device()
models = {}
orig_mlp = T.MLP


class Keep(orig_mlp):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        models["last"] = self


T.MLP = Keep
for method in ("ce", "ce_ent", "ce_eo"):
    lam = best.get(f"100_{method}", 0.0)
    r = T.run(data, 100, method, seed=0, lam=lam, epochs=30, device=dev, log=lambda s: None)
    models[method] = models.pop("last").eval()
    print(method, lam, r["test"]["acc"])

x_te = data["test"]["x"].to(dev).float() / 255
y_te = data["test"]["y"].to(dev)
with torch.no_grad():
    probs = {m: torch.sigmoid(models[m](x_te)).cpu() for m in models}
    preds = {m: models[m](x_te).argmax(1).cpu() for m in models}

# Distribution of the number of outputs above 0.5.
counts = {m: [int(((p > 0.5).sum(1) == c).sum()) if c < 3 else int(((p > 0.5).sum(1) >= 3).sum())
              for c in range(4)] for m, p in probs.items()}

# Example test images: one where CE has no output above 0.5, one with two, and one clean case.
y = y_te.cpu()
n_ce = (probs["ce"] > 0.5).sum(1)
picks = []
for cond in (n_ce == 0, n_ce >= 2, n_ce == 1):
    ok = cond & (preds["ce_eo"] == y)
    cand = ok.nonzero() if ok.any() else cond.nonzero()
    if len(cand):
        picks.append(int(cand[0]))
examples = []
for k in picks:
    Image.fromarray(255 - data["test"]["x"][k].view(28, 28).numpy()).resize((140, 140), Image.NEAREST).save(OUT / f"test_{k}.png")
    examples.append({"index": k, "label": int(y[k]), "image": f"test_{k}.png",
                     **{m: [round(float(v), 4) for v in probs[m][k]] for m in probs}})

json.dump({"counts": counts, "examples": examples, "n_test": len(y)}, open(OUT / "outputs.json", "w"), indent=1)
print(json.dumps(counts))
