import numpy as np
import pytest
import torch

from semloss import kb
from semloss.losses import (exactly_one_log_prob, log_prob_constraint, map_world, wmc_bruteforce,
                            world_log_prob)


def worlds_of(clauses, n):
    return torch.from_numpy(kb.satisfying_worlds(clauses, n).astype(np.float64))


PENGUIN_CNF = [[-3, 1], [-3, -2]]  # 1=B, 2=F, 3=P


def test_penguin_matches_paper_and_bruteforce():
    p = torch.tensor([0.9, 0.8, 0.8], dtype=torch.float64)
    z = torch.log(p) - torch.log1p(-p)
    lp = log_prob_constraint(z, worlds_of(PENGUIN_CNF, 3))
    assert lp.exp().item() == pytest.approx(0.344, abs=1e-12)
    assert lp.exp().item() == pytest.approx(wmc_bruteforce(p, PENGUIN_CNF).item(), rel=1e-12)


def test_world_enumeration_matches_exactly_one_closed_form():
    n = 5
    clauses = [list(range(1, n + 1))] + [[-a, -b] for a in range(1, n + 1) for b in range(a + 1, n + 1)]
    z = torch.randn(7, n, dtype=torch.float64) * 3
    assert torch.allclose(log_prob_constraint(z, worlds_of(clauses, n)), exactly_one_log_prob(z), rtol=1e-10)


def test_random_cnf_matches_bruteforce():
    rng = np.random.default_rng(0)
    n = 6
    clauses = [[int(v) * int(s) for v, s in zip(rng.choice(np.arange(1, n + 1), 3, replace=False), rng.choice([-1, 1], 3))]
               for _ in range(5)]
    z = torch.randn(4, n, dtype=torch.float64) * 2
    brute = wmc_bruteforce(torch.sigmoid(z), clauses)
    assert torch.allclose(log_prob_constraint(z, worlds_of(clauses, n)).exp(), brute, rtol=1e-10)


def test_gradient_matches_bruteforce():
    z = (torch.randn(3, 3, dtype=torch.float64) * 2).requires_grad_()
    log_prob_constraint(z, worlds_of(PENGUIN_CNF, 3)).sum().backward()
    g1 = z.grad.clone()
    z2 = z.detach().clone().requires_grad_()
    wmc_bruteforce(torch.sigmoid(z2), PENGUIN_CNF).log().sum().backward()
    assert torch.allclose(g1, z2.grad, rtol=1e-8)


def test_map_world_and_stability():
    w = worlds_of(PENGUIN_CNF, 3)
    z = torch.tensor([[40.0, 40.0, 40.0]], dtype=torch.float64)  # penguin that flies: violates the rules
    best = w[map_world(z, w)]
    assert best.tolist() in ([[1, 1, 0]], [[1, 0, 1]])  # MAP drops one of the conflicting beliefs
    assert torch.isfinite(world_log_prob(z, w)).all()


def test_awa2_kb_is_consistent_with_class_rows():
    root = "data/Animals_with_Attributes2"
    classes, attrs, binary, cont = kb.load_matrix(root)
    clauses = [cl for _, cl, _ in kb.rules_r1() + kb.rules_r2(classes, attrs, cont) + kb.rules_r3(classes, attrs, cont)
               + kb.rules_r4(attrs, binary)]
    sat = kb.satisfying_worlds(clauses, len(kb.var_names()))
    rows = kb.class_rows(classes, attrs, binary)
    assert all((sat == r).all(1).any() for r in rows)
