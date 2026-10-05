# Exactly-one Semantic Loss on semi-supervised MNIST

The most basic semantic-loss example (Xu et al., 2018): with only a few hundred labeled digits, add the
knowledge "exactly one of the 10 outputs is true" as a loss on **unlabeled** images, and compare it with
entropy minimisation, which only makes predictions confident.

## Constraint and loss

10 sigmoid outputs X₁..X₁₀, constraint α = EO(X₁..X₁₀) (1 + 45 = 46 CNF clauses, 10 satisfying worlds).

```
log Pr(α) = logsumexp(z) − Σ softplus(z)        L^s = −log Pr(α)
```

Derivation: split the satisfying worlds by which output is true (10 disjoint cases, summed); each case is a
product of independent factors; the common factor ∏(1 − p_j) leaves the odds e^{z_i}.
Checked against brute-force enumeration (2¹⁰ worlds) in `tests/test_losses.py`.

## Setup

- Data: MNIST, 5,000 training images held out for validation (fixed), 55,000 for training, 10,000 test.
  Labeled budgets 100 / 500 / 1,000 (balanced per class, chosen by seed); all other training images unlabeled.
- Model: MLP 784-1000-500-250-250-250-10, batch norm, ReLU, Gaussian input noise σ = 0.3 (ladder-network setup).
- Training: each step = 100 labeled (sampled with replacement) + 250 unlabeled images; 30 passes over the
  unlabeled stream (6,600 steps); Adam, one-cycle LR (max 2e-3); λ warm-up over the first 10 % of steps.

| method | loss |
|---|---|
| `ce` | CE on labeled images |
| `ce_eo` | + λ · exactly-one semantic loss on every image (sigmoid reading of the logits) |
| `ce_ent` | + λ · entropy of softmax(z) on every image (control) |

λ ∈ {0.01, 0.03, 0.1, 0.3, 1, 3} chosen per (budget, method) on validation with seed 0; then 5 seeds on test.

## Results (test, mean ± std over 5 seeds)

Fully supervised reference (55,000 labels): **98.80 ± 0.10 %**.

| labels | ce | ce_eo (λ) | ce_ent (λ) |
|---|---|---|---|
| 100 | 76.19 ± 2.22 | **80.59 ± 3.10** (0.1) | 79.60 ± 3.32 (0.3) |
| 500 | 90.85 ± 0.55 | **93.00 ± 0.53** (1) | 92.60 ± 0.66 (0.3) |
| 1,000 | 93.90 ± 0.22 | **94.98 ± 0.20** (3) | 94.80 ± 0.14 (0.3) |

| labels | mean Pr(exactly-one): ce / ce_eo / ce_ent | one-hot rate %: ce / ce_eo / ce_ent |
|---|---|---|
| 100 | 0.26 / 0.97 / 0.81 | 64 / 99.2 / 85 |
| 500 | 0.40 / 0.99 / 0.80 | 76 / 99.8 / 87 |
| 1,000 | 0.43 / 0.99 / 0.78 | 78 / 99.9 / 87 |

Observations:
- The semantic loss beats CE in every budget and every seed (+4.4, +2.2, +1.1 points); the gain shrinks as labels grow.
- Against entropy minimisation the edge is small (+1.0, +0.4, +0.2 points; ahead in 4/5, 5/5, 4/5 seeds) and,
  at 100 labels, well inside the seed spread. Most of the accuracy gain is shared with "be confident".
- The two regularisers make different things confident: entropy minimisation acts on the softmax distribution,
  which ignores the absolute logit level, so the sigmoid outputs still violate exactly-one on ~13–15 % of test
  images; the semantic loss drives exactly-one compliance to > 99 %.
- Our 100-label semantic-loss result is far below the 98.38 % reported by Xu et al. (2018); see
  "Reproducing the paper's protocol" below.

## Reproducing the paper's protocol

`semloss/paper_protocol.py` ports the official code (github.com/UCLA-StarAI/Semantic-Loss,
`semi_supervised/semantic.py`, `mnist_input.py`) to PyTorch: per-image standardisation, Gaussian noise 0.3 and a
random 25×25 crop (training only), MLP with ReLU, Glorot init, dropout 0.5 and no effective batch norm, sigmoid
cross-entropy for the labeled part, semantic loss on every image, half-labeled/half-unlabeled batches, Adam 1e-4,
50,000 steps. Differences from the paper text found in the code: the crop augmentation (the paper calls the task
permutation-invariant), lr 1e-4 instead of 0.002, 50,000 steps instead of 20 epochs, no validation set, and test
accuracy printed during training. The official README itself warns that the 100-label results are "very volatile".

`run_paper_protocol.py` tunes batch size ∈ {10, 32, 128} and the loss weight ∈ {0.0005, 0.005, 0.05, 0.5, 1}
per method on our 5,000-image validation split (seed 0), then runs 5 seeds; only the final-step test accuracy
is reported.

| labels | method | selected (batch, weight) | test acc (final step) | paper (Table 1) |
|---|---|---|---|---|
| 100 | CE (sigmoid) | 32, — | 84.48 ± 2.55 | 78.46 ± 1.94 |
| 100 | + entropy | 128, 0.5 | 84.21 ± 3.52 | 96.27 ± 0.64 |
| 100 | + semantic loss | 32, 1.0 | 85.42 ± 2.84 | **98.38 ± 0.51** |
| 1,000 | CE (sigmoid) | 128, — | 95.63 ± 0.43 | 94.26 ± 0.31 |
| 1,000 | + entropy | 128, 0.05 | 95.52 ± 0.34 | 98.32 ± 0.34 |
| 1,000 | + semantic loss | 10, 1.0 | 95.29 ± 0.42 | 98.78 ± 0.17 |

- The port's baselines match or exceed the paper's baselines, but neither unlabeled-data regulariser comes close
  to the reported 96–99 %. The semantic loss is ahead of CE in all 5 seeds at 100 labels, by only +0.9 points.
- Even the best test accuracy seen anywhere on the training curve (test-set peeking) averages 87.8 % at
  100 labels, so reporting the best intermediate test accuracy would not explain the gap either.
- With sigmoid cross-entropy the supervised loss already pushes the outputs toward one-hot (Pr(exactly-one)
  0.96 for plain CE), leaving the semantic loss little to add.
- Not covered: noise std and learning-rate tuning, TensorFlow-1 numerical details, 10 seeds / 10,000 validation
  images as in the paper. We cannot rule out that some setting reproduces the paper; we did not find one.
  Full per-seed numbers: `results_paper/`.

## Running

```bash
python3 -m pytest -q tests
python3 run_experiments.py      # ~30 min on Apple M4 Max (MPS), resumable
python3 summarize.py            # -> results/summary.md
python3 run_paper_protocol.py   # official-code protocol, ~2.5 h, -> results_paper/
```

Requires only `torch` and `numpy`; MNIST is downloaded from the torchvision S3 mirror and MD5-checked.

## Rebuilding the lecture deck

```bash
cd lecture/src
npm install
node build.js ../SemanticLoss_MNIST_Lecture.pptx
```

The generator reads the numbers from `results/`. Theme colors are written only when `APPLY_THEME_JS` points to
an `apply_theme.js` module; otherwise the deck is built with Office's default theme colors.
