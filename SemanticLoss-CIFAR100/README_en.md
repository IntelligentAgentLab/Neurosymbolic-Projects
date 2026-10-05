# Semantic Loss on CIFAR-100 with a class hierarchy

[한국어](README.md) | English

Implements the semantic loss of Xu et al. (2018) for the CIFAR-100 superclass hierarchy and
measures when the rule "fine class ⇒ its superclass" (e.g. *maple ⇒ tree*) helps.

## Constraint

The network has 120 sigmoid outputs: 100 fine classes `f` and 20 coarse classes `c`.

```
alpha = EO(f) ∧ EO(c) ∧ ⋀_i (f_i → c_par(i))
```

Exactly 100 worlds satisfy `alpha` (the fine class fixes the coarse class), which gives the closed form

```
log Pr(alpha) = logsumexp_i(f_i + c_par(i)) − Σ softplus(f) − Σ softplus(c)
L^s = −log Pr(alpha)
```

(`semloss/losses.py`; checked against brute-force 2^n enumeration in `tests/test_losses.py`).
The supervised terms are softmax cross-entropies over the same logits, as in Xu et al.

## Settings (label availability on the 45k training split)

| setting | fine labels | coarse labels | unlabeled |
|---|---|---|---|
| `full` | 100% | 100% | — |
| `semi` | 10% | same 10% | 90% |
| `weak` | 10% | 100% | — |

5,000 training images (50 per class) are held out as a fixed validation split, used only to pick λ.

## Methods

| method | loss |
|---|---|
| `ce_fine` | CE(fine) on fine-labeled images |
| `ce_both` | + CE(coarse) on coarse-labeled images (multi-task control) |
| `ce_both_sl` | + λ · L^s on **every** image, λ warmed up linearly over 5 epochs |

`ce_both` separates the effect of the coarse labels from the effect of the rule.

## Metrics (test set)

- `fine_acc`, `coarse_acc`: argmax of each head.
- `fine_acc_joint`: MAP world under the constraint, `argmax_i (f_i + c_par(i))`.
- `fine_acc_masked`: fine argmax restricted to children of the predicted coarse class (inference-time rule).
- `coarse_acc_via_fine`: parent of the fine prediction vs. true coarse class.
- `consistency`: parent(argmax f) == argmax c.
- `mean_log_pr_alpha`: average log Pr(alpha) under the sigmoid outputs.
- `within_superclass_err`: share of fine errors that stay inside the true superclass.

## Training

ResNet-9, SGD (Nesterov, momentum 0.9, weight decay 5e-4), one-cycle LR (max 0.1), batch 256,
30 epochs, bf16 autocast, random crop + flip done on the GPU. Each epoch passes over all 45k images, so every
method takes the same number of steps.

## Running

```bash
python3 -m pytest -q tests
python3 demo_paper_examples.py
python3 run_experiments.py
python3 summarize.py
```

`run_experiments.py` downloads CIFAR-100 to `data/` (MD5-checked), tunes λ ∈ {0.005, 0.02, 0.1, 0.5, 1, 2, 5} per setting
on validation (seed 0), and then runs 3 settings × 3 methods × 3 seeds. Each run is cached as
`results/*.json`, so an interrupted run resumes where it stopped. Requires only `torch` and `numpy`.

## Results (10% labels, 30 epochs, 3 seeds; test %, mean ± std)

Fine accuracy:

| setting | ce_fine | ce_both | ce_both_eo (EO only) | ce_both_sl (hierarchy) |
|---|---|---|---|---|
| full | 73.74 ± 0.26 | 73.20 ± 0.17 | 74.07 ± 0.19 | **74.11 ± 0.04** |
| semi | 36.84 ± 0.84 | 36.29 ± 1.46 | **39.84 ± 0.93** | 38.16 ± 1.00 |
| weak | 36.84 ± 0.84 | 52.16 ± 1.97 | 57.39 ± 0.48 | **57.84 ± 0.53** |

Consistency (parent(argmax f) == argmax c):

| setting | ce_both | ce_both_eo | ce_both_sl |
|---|---|---|---|
| full | 90.85 ± 0.34 | 90.87 ± 0.20 | **92.51 ± 0.26** |
| semi | 71.21 ± 1.41 | 73.82 ± 0.14 | **81.66 ± 0.21** |
| weak | 75.93 ± 1.43 | 82.57 ± 0.25 | **90.19 ± 0.44** |

Selected λ (validation, seed 0): hierarchy SL full 2 / semi 1 / weak 2; EO-only full 2 / semi 1 / weak 2.

Observations and caveats:
- The semantic loss helps more as supervision shrinks, but **most of the accuracy gain comes from the
  exactly-one part** (EO(f) ∧ EO(c)), i.e. from making outputs confidently one-hot. The 100 implications add
  +0.0 (full), −1.7 (semi), +0.5 (weak) points of fine accuracy over the EO-only ablation.
- **The implications are what raise rule compliance**: consistency +1.6 (full), +7.8 (semi), +7.6 (weak) points
  over EO-only, and a larger share of the remaining errors stays inside the true superclass.
- The initial hypothesis (the rule propagates coarse labels into the fine head and raises accuracy) is not
  supported; the EO-only ablation was needed to see this. A natural next comparison is entropy minimisation /
  pseudo-labelling.
- λ has a sharp upper cliff: λ = 5 collapses training (val fine acc 6–64%), and in `semi` λ = 2 already hurts.
- `mean log Pr(α)` for the CE-only models is very negative because softmax training leaves the absolute logit level
  free, so their sigmoids are not calibrated as independent probabilities; compare it only among SL models.
