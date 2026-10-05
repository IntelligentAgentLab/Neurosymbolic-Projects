# Semantic Loss with an attribute knowledge base on AwA2 (five animals)

Third project of the series: a richer propositional knowledge base, generated from the Animals with Attributes 2
class-attribute matrix, on a small five-animal image subset. Compared with the MNIST (exactly-one) and
CIFAR-100 (hierarchy) projects, the rules here are not a single structural constraint but a set of
commonsense implications, and the semantic loss is computed exactly for an arbitrary CNF by enumerating its
satisfying worlds.

## Data

- AwA2 (Xian et al., TPAMI 2018): 37,322 images, 50 classes, 85 attributes per class.
- Subset: **zebra, tiger, giraffe, leopard, dolphin** — stripes/spots × hooves/paws form a 2×2 grid, dolphin is
  the outlier (flippers, water, no legs).
- 700 random images per class (3,500 ≈ 1/10 of AwA2), 96×96 (shorter side resized, center crop), stratified
  60/20/20 train/val/test split.
- `prepare_data.py` reads the 13.9 GB `AwA2-data.zip` with HTTP range requests and downloads only the selected
  images and their license files (~1.4 GB) into `~/.cache/semloss-awa2/` (outside Dropbox); the resized array
  goes to `data/awa2_5_96.npz` (86 MB, not tracked).

## Knowledge base (`semloss/kb.py`, `make_rules.py` → `kb/rules.json`)

15 Boolean variables = 5 classes + 10 attributes
(stripes, spots, hooves, paws, longneck, flippers, furry, quadrapedal, water, meatteeth).

| family | meaning | how it is generated | clauses |
|---|---|---|---|
| R1 | exactly one class | fixed | 11 |
| R2 | class → (¬)attribute | AwA2 continuous scores: ≥ 50 present, ≤ 10 absent, otherwise unknown | 44 |
| R3 | attribute → OR of classes | derived within the subset (e.g. stripes → zebra ∨ tiger) | 10 |
| R4 | attribute → (¬)attribute | exceptionless on **all 50** AwA2 classes, premise support ≥ 5 | 15 |

| rule set | clauses | satisfying worlds (of 2¹⁵ = 32,768) |
|---|---|---|
| R1 | 11 | 5,120 |
| R1+R2 | 55 | 13 |
| R1+R4 | 26 | 580 |
| R1+R2+R3+R4 | 80 | 10 |

Every class's own attribute vector satisfies every rule set. R2 leaves gaps where annotators disagreed
(e.g. giraffe hooves 48); general commonsense from R4 fills some of them (longneck → hooves).

## Semantic loss for an arbitrary CNF (`semloss/losses.py`)

With the satisfying worlds W (S × 15) listed once,
`log Pr(α) = logsumexp_s [ W_s · logσ(z) + (1 − W_s) · logσ(−z) ]` — one matrix product, exact for any rule set,
no hand derivation. The constrained MAP prediction is the arg-max world. Tests compare against brute-force
enumeration (penguin example, exactly-one closed form, random CNFs, gradients).

## Experiments

Small CNN (4 conv blocks, 1.2 M parameters) trained from scratch, 1,500 steps, batch 32 class-labeled + 64 other
images, SGD one-cycle. λ tuned on validation (seed 0) over {0.03, 0.1, 0.3, 1, 3}; test results over 5 seeds.

- **semi**: 10 % of training images (42 per class) have a class label; the rest have nothing.
- **weak**: 10 % have a class label; every other image has answers to **2 random attribute questions** only.

Methods: `ce` (class CE) · `ce_attr` (+ attribute BCE) · `+ent` (entropy minimisation, control) · `+eo`
(semantic loss R1) · `+r12`, `+r14`, `+all` (semantic loss with that rule set).

### Results (test, 5 seeds, %)

| method | semi: class acc | semi: KB consistency | weak: class acc | weak: KB consistency |
|---|---|---|---|---|
| ce | 89.94 ± 0.52 | 0.8 | 90.00 ± 0.72 | 0.8 |
| ce_attr | 90.46 ± 0.57 | 79.0 | 95.20 ± 0.39 | 81.5 |
| + entropy (λ 3 / 1) | 92.63 ± 0.63 | 78.3 | 94.97 ± 0.89 | 81.9 |
| + SL R1 (λ 3 / 0.03) | 94.14 ± 1.18 | 78.0 | 95.40 ± 0.80 | 82.5 |
| + SL R1+R2 (λ 0.3) | **94.97 ± 0.54** | 91.3 | **97.09 ± 0.26** | 90.1 |
| + SL R1+R4 (λ 1) | 94.49 ± 1.11 | 91.4 | 96.49 ± 0.76 | 94.7 |
| + SL all (λ 0.3) | 94.77 ± 0.79 | **97.3** | 96.09 ± 0.47 | **98.1** |

KB consistency = share of test images whose hard prediction (arg-max class, attributes > 0.5) satisfies the
full rule set. Full per-class tables and λ tuning: `results/summary.md`.

Paired differences (same seed):

| comparison | semi | weak |
|---|---|---|
| SL R1 − entropy | +1.51 (4/5 seeds) | +0.43 (5/5) |
| SL R1+R2 − SL R1 | +0.83 (4/5) | **+1.69 (5/5)** |
| SL R1+R4 − SL R1 | +0.34 (2/5) | +1.09 (5/5) |
| SL all − SL R1 | +0.63 (4/5) | +0.69 (4/5) |

Observations:
- Unlike MNIST and CIFAR-100, the attribute rules add accuracy **on top of** exactly-one, most clearly in the
  `weak` setting, where cheap attribute answers and the rules together identify the class
  (R1+R2: +1.7 points over R1, every seed). Tiger and leopard, the most confused pair, gain the most.
- The rules raise rule compliance from ~78–82 % (entropy, R1) to 91–98 %, as in the earlier projects.
- Stronger rule sets collapse at large λ (R1+R2 and the full set: 39–57 % validation accuracy at λ = 3), looser
  ones (R1, R1+R4) do not.
- The general-commonsense set R1+R4, which contains no class-specific knowledge, already helps in `weak`.

### Zero-shot (negative result)

One class is removed from training; the other four are fully labeled; at test time the class is the MAP world
of the full rule set given the attribute logits only. Over 5 held-out classes × 5 seeds, unseen-class accuracy
is **0.5–2.2 %** for all three methods (seen-class accuracy 98–99 %). With only four seen classes each attribute
is carried by one or two classes, so the network learns "stripes" as a proxy for *tiger*: unseen zebras are
labeled tiger, unseen tigers leopard. Attributes that only the unseen class has (dolphin: flippers, water) are
never predicted, so its worlds are never chosen. Rules cannot supply a concept the network never learned; the
standard remedy is more seen classes per attribute (e.g. other AwA2 animals with hooves, stripes or spots).

## Running

```bash
python3 make_rules.py            # knowledge base report -> kb/rules.json (needs data/Animals_with_Attributes2)
python3 prepare_data.py          # ~20 min download, -> data/awa2_5_96.npz
python3 -m pytest -q tests
python3 pilot_resolution.py      # 64x64 vs 96x96 pilot
python3 run_experiments.py       # ~3.5 h on Apple M4 Max (MPS), resumable
python3 summarize.py             # -> results/summary.md
```

`make_rules.py` downloads `AwA2-base.zip` (32 KB) into `data/` if it is missing. Images are Flickr photos
licensed for free use and redistribution; per-image license files are downloaded alongside the images.
