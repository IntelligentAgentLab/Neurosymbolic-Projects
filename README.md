# Neurosymbolic Projects

Experiments and lecture materials on neurosymbolic learning — injecting symbolic knowledge (logical
constraints) into neural network training. Each project is a self-contained folder.

| Project | Topic | Knowledge (constraint) | Lecture deck |
|---|---|---|---|
| [SemanticLoss-MNIST](SemanticLoss-MNIST/) | Semantic loss, semi-supervised MNIST (basic) | exactly-one over 10 digits | 44 slides, ~62 min |
| [SemanticLoss-CIFAR100](SemanticLoss-CIFAR100/) | Semantic loss with a class hierarchy on CIFAR-100 | exactly-one + 100 implications *fine → coarse* | 60 slides, ~80 min |
| [SemanticLoss-AwA2](SemanticLoss-AwA2/) | Attribute knowledge base on five AwA2 animals, semi/weak supervision, zero-shot | 80 clauses generated from the class-attribute matrix (incl. commonsense mined from 50 animals) | — |

Suggested order: MNIST first (one constraint, the three principles behind the closed form, a reproduction
study of the original paper), then CIFAR-100 (a richer constraint, full / semi / weak supervision, ablations),
then AwA2 (a generated commonsense rule base, exact semantic loss by world enumeration).

## Project layout

Every project follows the same structure:

```
<Project>/
├── README.md            # setup, results, how to run
├── semloss/             # library code (losses, data, model, training)
├── tests/               # unit tests (closed forms vs. brute-force enumeration)
├── run_experiments.py   # full experiment grid, cached per run (resumable)
├── summarize.py         # results/*.json -> results/summary.md
├── results/             # per-run JSON results
└── lecture/             # lecture deck (.pptx) and its generator (lecture/src)
```

## Running

Python 3.10+ with `torch` and `numpy` (no torchvision). Datasets are downloaded on first run into each
project's `data/` folder, which is not tracked.

```bash
cd SemanticLoss-MNIST
python3 -m pytest -q tests
python3 run_experiments.py
python3 summarize.py
```

## Adding a project

Create a new top-level folder with the layout above, add a row to the table, and keep datasets out of git
(`data/` is ignored repository-wide).

## Reference

J. Xu, Z. Zhang, T. Friedman, Y. Liang, G. Van den Broeck. *A Semantic Loss Function for Deep Learning with
Symbolic Knowledge.* ICML 2018.
