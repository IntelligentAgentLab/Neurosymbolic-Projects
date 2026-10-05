import math

import pytest
import torch

from semloss.losses import (exactly_one_cnf, exactly_one_log_prob, hierarchy_cnf,
                            hierarchy_log_prob, wmc_bruteforce)

# Penguin example variables: 1=B (bird), 2=F (can fly), 3=P (penguin)
PENGUIN_CNF = [[-3, 1], [-3, -2]]


def logit(p):
    p = torch.as_tensor(p, dtype=torch.float64)
    return torch.log(p) - torch.log1p(-p)


@pytest.mark.parametrize("p, pr, loss", [
    ((0.98, 0.01, 0.01), 0.961, 0.04),
    ((0.8, 0.1, 0.1), 0.684, 0.38),
    ((0.4, 0.4, 0.2), 0.456, 0.79),
])
def test_exactly_one_matches_paper_table(p, pr, loss):
    probs = torch.tensor(p, dtype=torch.float64)
    brute = wmc_bruteforce(probs, exactly_one_cnf([1, 2, 3]))
    closed = exactly_one_log_prob(logit(p)).exp()
    assert brute.item() == pytest.approx(pr, abs=5e-4)
    assert closed.item() == pytest.approx(brute.item(), rel=1e-12)
    assert -math.log(brute.item()) == pytest.approx(loss, abs=5e-3)


def test_penguin_probability_and_gradient():
    probs = torch.tensor([0.9, 0.8, 0.8], dtype=torch.float64, requires_grad=True)
    pr = wmc_bruteforce(probs, PENGUIN_CNF)
    assert pr.item() == pytest.approx(0.344, abs=1e-12)
    assert -math.log(pr.item()) == pytest.approx(1.07, abs=5e-3)
    pr.backward()
    assert probs.grad.tolist() == pytest.approx([0.16, -0.72, -0.82], abs=1e-12)


def test_hierarchy_closed_form_matches_bruteforce():
    torch.manual_seed(0)
    parent = torch.tensor([0, 0, 1, 1, 2])  # 5 fine classes, 3 coarse classes
    cnf = hierarchy_cnf(parent, 3)
    logits = torch.randn(4, 8, dtype=torch.float64) * 2
    f, c = logits[:, :5], logits[:, 5:]
    brute = wmc_bruteforce(torch.sigmoid(logits), cnf)
    closed = hierarchy_log_prob(f, c, parent).exp()
    assert torch.allclose(closed, brute, rtol=1e-10)


def test_hierarchy_log_prob_is_stable_for_large_logits():
    parent = torch.arange(100) // 5
    f = torch.full((2, 100), -40.0)
    c = torch.full((2, 20), -40.0)
    f[:, 7] = 40.0
    c[:, 1] = 40.0  # consistent: parent(7) == 1
    lp = hierarchy_log_prob(f, c, parent)
    assert torch.isfinite(lp).all() and lp.abs().max() < 1e-6
    c[:, 1], c[:, 2] = -40.0, 40.0  # now inconsistent
    assert (hierarchy_log_prob(f, c, parent) < -70).all()
