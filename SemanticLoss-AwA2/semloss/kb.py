"""Knowledge base for the five-animal AwA2 subset: variables, rule generation, and satisfying-world enumeration.

Variables (all Boolean, one network output each): the 5 classes followed by the selected attributes.
Rules are CNF clauses over 1-based variable ids (DIMACS-style literals).

Rule families
  R1  exactly-one over the classes.
  R2  class -> attribute literal, from the AwA2 class-attribute matrix. A literal is used only when the
      annotators were confident: continuous score >= POS (attribute present) or <= NEG (absent). Scores in
      between are left unconstrained (partial knowledge).
  R3  attribute -> disjunction of classes, implied within the subset (e.g. stripes -> zebra v tiger).
  R4  attribute -> (not) attribute implications that hold for **all 50** AwA2 classes in the binary matrix,
      with support >= MIN_SUPPORT classes on the premise (general commonsense, not tied to the subset).
"""
import itertools
from pathlib import Path

import numpy as np

CLASSES = ("zebra", "tiger", "giraffe", "leopard", "dolphin")
ATTRIBUTES = ("stripes", "spots", "hooves", "paws", "longneck", "flippers", "furry", "quadrapedal", "water", "meatteeth")
POS, NEG = 50.0, 10.0
MIN_SUPPORT = 5


def load_matrix(root):
    root = Path(root)
    classes = [line.split()[1] for line in open(root / "classes.txt")]
    attrs = [line.split()[1] for line in open(root / "predicates.txt")]
    binary = np.loadtxt(root / "predicate-matrix-binary.txt", dtype=int)
    cont = np.loadtxt(root / "predicate-matrix-continuous.txt")
    return classes, attrs, binary, cont


def var_names():
    return list(CLASSES) + list(ATTRIBUTES)


def var(name):
    return var_names().index(name) + 1


def rules_r1():
    ids = [var(c) for c in CLASSES]
    return [("R1", ids, "at least one class")] + [("R1", [-a, -b], "not two classes") for a, b in itertools.combinations(ids, 2)]


def rules_r2(classes, attrs, cont):
    out = []
    for c in CLASSES:
        for a in ATTRIBUTES:
            s = cont[classes.index(c), attrs.index(a)]
            if s >= POS:
                out.append(("R2", [-var(c), var(a)], f"{c} -> {a} ({s:.0f})"))
            elif s <= NEG:
                out.append(("R2", [-var(c), -var(a)], f"{c} -> not {a} ({s:.0f})"))
    return out


def rules_r3(classes, attrs, cont):
    """attribute -> OR of the subset classes that may have it (derived from the confident R2 literals)."""
    out = []
    for a in ATTRIBUTES:
        allowed = [c for c in CLASSES if cont[classes.index(c), attrs.index(a)] > NEG]
        if 0 < len(allowed) < len(CLASSES):
            out.append(("R3", [-var(a)] + [var(c) for c in allowed], f"{a} -> " + " v ".join(allowed)))
    return out


def rules_r4(attrs, binary):
    """a -> b and a -> not b over the selected attributes, exceptionless on all 50 AwA2 classes."""
    out = []
    col = {a: binary[:, attrs.index(a)].astype(bool) for a in ATTRIBUTES}
    for a, b in itertools.permutations(ATTRIBUTES, 2):
        prem = col[a]
        if prem.sum() < MIN_SUPPORT:
            continue
        if (col[b][prem]).all():
            out.append(("R4", [-var(a), var(b)], f"{a} -> {b} (support {prem.sum()}/50)"))
        elif (~col[b][prem]).all() and a < b:  # a -> not b is symmetric; keep one direction
            out.append(("R4", [-var(a), -var(b)], f"not ({a} and {b}) (support {prem.sum()}/50)"))
    return out


def satisfying_worlds(clauses, n):
    """All assignments in {0,1}^n satisfying every clause, as an (S, n) uint8 array."""
    worlds = np.array(list(itertools.product([0, 1], repeat=n)), dtype=np.uint8)
    ok = np.ones(len(worlds), dtype=bool)
    for cl in clauses:
        sat = np.zeros(len(worlds), dtype=bool)
        for lit in cl:
            v = worlds[:, abs(lit) - 1]
            sat |= (v == 1) if lit > 0 else (v == 0)
        ok &= sat
    return worlds[ok]


def class_rows(classes, attrs, binary):
    """The binary attribute vector of each subset class, as full worlds (one-hot class + attributes)."""
    rows = []
    for i, c in enumerate(CLASSES):
        w = [int(j == i) for j in range(len(CLASSES))] + [int(binary[classes.index(c), attrs.index(a)]) for a in ATTRIBUTES]
        rows.append(w)
    return np.array(rows, dtype=np.uint8)


KB_SETS = {"R1": ("R1",), "R1R2": ("R1", "R2"), "R1R4": ("R1", "R4"), "ALL": ("R1", "R2", "R3", "R4")}


def build(root="data/Animals_with_Attributes2"):
    """Everything training needs: satisfying worlds per KB set, and per-class attribute targets.

    targets[c, a] = 1 / 0 for the confident R2 literals (continuous >= POS / <= NEG), -1 when unknown.
    """
    classes, attrs, binary, cont = load_matrix(root)
    fams = {"R1": rules_r1(), "R2": rules_r2(classes, attrs, cont), "R3": rules_r3(classes, attrs, cont),
            "R4": rules_r4(attrs, binary)}
    n = len(var_names())
    worlds = {k: satisfying_worlds([cl for f in fs for _, cl, _ in fams[f]], n) for k, fs in KB_SETS.items()}
    targets = np.full((len(CLASSES), len(ATTRIBUTES)), -1, dtype=np.int64)
    for i, c in enumerate(CLASSES):
        for j, a in enumerate(ATTRIBUTES):
            s = cont[classes.index(c), attrs.index(a)]
            targets[i, j] = 1 if s >= POS else 0 if s <= NEG else -1
    return {"worlds": worlds, "targets": targets, "families": fams}
