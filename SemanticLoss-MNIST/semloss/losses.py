"""Exactly-one semantic loss (Xu et al., 2018) and the entropy-minimisation control.

All semantic-loss probabilities are independent sigmoids of the logits. For a logit z:
log p = -softplus(-z), log(1-p) = -softplus(z), and p/(1-p) = e^z.
"""
import itertools

import torch
import torch.nn.functional as F


def wmc_bruteforce(probs, clauses):
    """Pr(alpha) by enumerating all 2^n worlds (reference implementation, small n only).

    probs:   (..., n) tensor of independent Bernoulli probabilities.
    clauses: CNF as a list of clauses, each a list of DIMACS-style literals
             (+k means X_k is true, -k means X_k is false, k is 1-based).
    """
    n = probs.shape[-1]
    total = probs.new_zeros(probs.shape[:-1])
    for world in itertools.product([0, 1], repeat=n):
        if all(any((lit > 0) == bool(world[abs(lit) - 1]) for lit in clause) for clause in clauses):
            w = torch.tensor(world, dtype=torch.bool, device=probs.device)
            total = total + torch.prod(torch.where(w, probs, 1 - probs), dim=-1)
    return total


def exactly_one_cnf(vars_):
    """CNF clauses for exactly-one over the given 1-based variable ids."""
    clauses = [list(vars_)]
    clauses += [[-a, -b] for a, b in itertools.combinations(vars_, 2)]
    return clauses


def exactly_one_log_prob(logits):
    """log Pr(exactly one X_i is true) = logsumexp(z) - sum softplus(z).

    Split the satisfying worlds by which variable is true (n disjoint cases); each case is a
    product of independent factors, and the common factor prod_j (1 - p_j) leaves the odds e^{z_i}.
    """
    return torch.logsumexp(logits, dim=-1) - F.softplus(logits).sum(dim=-1)


def exactly_one_semantic_loss(logits):
    """Batch mean of -log Pr(exactly-one)."""
    return -exactly_one_log_prob(logits).mean()


def softmax_entropy(logits):
    """Batch mean of the entropy of softmax(z) (entropy-minimisation control)."""
    logp = F.log_softmax(logits, dim=-1)
    return -(logp.exp() * logp).sum(dim=-1).mean()
