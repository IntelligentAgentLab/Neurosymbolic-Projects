"""Semantic loss for an arbitrary CNF over a small number of variables, via satisfying-world enumeration.

With n <= ~20 variables the satisfying worlds W (S x n, 0/1) can be listed once. Then, for logits z,
    log Pr(alpha) = logsumexp_s [ sum_i W_si log sigma(z_i) + (1 - W_si) log sigma(-z_i) ]
                  = logsumexp_s [ W_s . logsigmoid(z) + (1 - W_s) . logsigmoid(-z) ],
i.e. one matrix product and a logsumexp: exact for any constraint, no hand derivation needed.
"""
import itertools

import torch
import torch.nn.functional as F


def world_log_prob(logits, worlds):
    """log Pr of each world: (B, n) logits, (S, n) 0/1 worlds -> (B, S)."""
    w = worlds.to(logits.dtype)
    return F.logsigmoid(logits) @ w.T + F.logsigmoid(-logits) @ (1 - w).T


def log_prob_constraint(logits, worlds):
    """log Pr(alpha) given the satisfying worlds of alpha."""
    return torch.logsumexp(world_log_prob(logits, worlds), dim=-1)


def semantic_loss(logits, worlds):
    return -log_prob_constraint(logits, worlds).mean()


def map_world(logits, worlds):
    """Index of the most probable satisfying world for each example (constrained MAP decoding)."""
    return world_log_prob(logits, worlds).argmax(dim=-1)


def exactly_one_log_prob(logits):
    """Closed form for exactly-one (used as a cross-check): logsumexp(z) - sum softplus(z)."""
    return torch.logsumexp(logits, dim=-1) - F.softplus(logits).sum(dim=-1)


def wmc_bruteforce(probs, clauses):
    """Pr(alpha) by enumerating all 2^n worlds (reference implementation, small n only)."""
    n = probs.shape[-1]
    total = probs.new_zeros(probs.shape[:-1])
    for world in itertools.product([0, 1], repeat=n):
        if all(any((lit > 0) == bool(world[abs(lit) - 1]) for lit in clause) for clause in clauses):
            w = torch.tensor(world, dtype=torch.bool, device=probs.device)
            total = total + torch.prod(torch.where(w, probs, 1 - probs), dim=-1)
    return total


def softmax_entropy(logits):
    logp = F.log_softmax(logits, dim=-1)
    return -(logp.exp() * logp).sum(dim=-1).mean()
