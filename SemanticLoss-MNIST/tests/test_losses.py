import math

import pytest
import torch

from semloss.losses import (exactly_one_cnf, exactly_one_log_prob, softmax_entropy,
                            wmc_bruteforce)


def logit(p):
    p = torch.as_tensor(p, dtype=torch.float64)
    return torch.log(p) - torch.log1p(-p)


@pytest.mark.parametrize("p, pr, loss", [
    ((0.98, 0.01, 0.01), 0.961, 0.04),
    ((0.8, 0.1, 0.1), 0.684, 0.38),
    ((0.4, 0.4, 0.2), 0.456, 0.79),
    ((0.5, 0.5, 0.5), 0.375, 0.98),
])
def test_exactly_one_matches_paper_table(p, pr, loss):
    brute = wmc_bruteforce(torch.tensor(p, dtype=torch.float64), exactly_one_cnf([1, 2, 3]))
    closed = exactly_one_log_prob(logit(p)).exp()
    assert brute.item() == pytest.approx(pr, abs=5e-4)
    assert closed.item() == pytest.approx(brute.item(), rel=1e-12)
    assert -math.log(brute.item()) == pytest.approx(loss, abs=5e-3)


def test_closed_form_matches_bruteforce_for_ten_classes():
    torch.manual_seed(0)
    logits = torch.randn(5, 10, dtype=torch.float64) * 3
    brute = wmc_bruteforce(torch.sigmoid(logits), exactly_one_cnf(list(range(1, 11))))  # 2^10 worlds
    assert torch.allclose(exactly_one_log_prob(logits).exp(), brute, rtol=1e-10)


def test_closed_form_gradient_matches_bruteforce():
    p = torch.tensor([0.6, 0.3, 0.2, 0.1], dtype=torch.float64, requires_grad=True)
    wmc_bruteforce(p, exactly_one_cnf([1, 2, 3, 4])).log().backward()
    z = logit(p.detach()).requires_grad_()
    exactly_one_log_prob(z).backward()
    # chain rule through the sigmoid: dz = dp * p (1 - p)
    assert torch.allclose(z.grad, p.grad * p.detach() * (1 - p.detach()), rtol=1e-10)


def test_exactly_one_log_prob_is_stable_for_large_logits():
    z = torch.full((2, 10), -50.0)
    z[:, 3] = 50.0
    assert exactly_one_log_prob(z).abs().max() < 1e-6
    z[:, 4] = 50.0  # two confident "true" outputs violate exactly-one
    assert (exactly_one_log_prob(z) < -40).all()


def test_softmax_entropy_bounds():
    assert softmax_entropy(torch.zeros(1, 10)).item() == pytest.approx(math.log(10))
    z = torch.full((1, 10), -30.0)
    z[0, 0] = 30.0
    assert softmax_entropy(z).item() < 1e-6
