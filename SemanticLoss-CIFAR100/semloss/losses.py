"""Semantic loss (Xu et al., 2018) for the constraints used in this project.

All probabilities are independent sigmoids of the network logits. Working in
log space, for a logit x: log p = -softplus(-x), log(1-p) = -softplus(x),
and log p - log(1-p) = x. This makes the closed forms below numerically stable.
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


def exactly_one_log_prob(logits):
    """log Pr(exactly one X_i is true) = logsumexp(x) - sum softplus(x)."""
    return torch.logsumexp(logits, dim=-1) - F.softplus(logits).sum(dim=-1)


def hierarchy_log_prob(fine_logits, coarse_logits, parent):
    """log Pr(EO(fine) & EO(coarse) & AND_i (fine_i -> coarse_parent(i))).

    Exactly one world per fine class satisfies the constraint, so
    Pr = sum_i p_fi p_c,par(i) prod_{j!=i}(1-p_fj) prod_{k!=par(i)}(1-p_ck), i.e.
    log Pr = logsumexp_i(f_i + c_par(i)) - sum softplus(f) - sum softplus(c).
    """
    joint = fine_logits + coarse_logits[..., parent]
    return (torch.logsumexp(joint, dim=-1)
            - F.softplus(fine_logits).sum(dim=-1)
            - F.softplus(coarse_logits).sum(dim=-1))


def hierarchy_semantic_loss(fine_logits, coarse_logits, parent):
    """Batch mean of -log Pr(alpha) for the fine/coarse hierarchy constraint."""
    return -hierarchy_log_prob(fine_logits, coarse_logits, parent).mean()


def exactly_one_cnf(vars_):
    """CNF clauses for exactly-one over the given 1-based variable ids."""
    clauses = [list(vars_)]
    clauses += [[-a, -b] for a, b in itertools.combinations(vars_, 2)]
    return clauses


def hierarchy_cnf(parent, n_coarse):
    """CNF for the hierarchy constraint; fine vars are 1..F, coarse vars F+1..F+C."""
    n_fine = len(parent)
    fine = list(range(1, n_fine + 1))
    coarse = list(range(n_fine + 1, n_fine + n_coarse + 1))
    clauses = exactly_one_cnf(fine) + exactly_one_cnf(coarse)
    clauses += [[-(i + 1), n_fine + 1 + int(parent[i])] for i in range(n_fine)]
    return clauses
