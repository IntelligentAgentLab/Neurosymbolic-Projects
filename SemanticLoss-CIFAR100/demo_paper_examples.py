"""Reproduces the worked examples of Section 2.1 (exactly-one table, penguin rules, gradients)
and shows a few gradient-descent steps driven by the semantic loss alone."""
import itertools
import math

import torch

from semloss.losses import exactly_one_cnf, wmc_bruteforce

torch.set_default_dtype(torch.float64)


def satisfies(world, clauses):
    return all(any((lit > 0) == bool(world[abs(lit) - 1]) for lit in clause) for clause in clauses)


def world_prob(world, p):
    return math.prod(pi if w else 1 - pi for w, pi in zip(world, p))


print("== 2.1.1 exactly-one ==")
eo = exactly_one_cnf([1, 2, 3])
for p in [(0.98, 0.01, 0.01), (0.8, 0.1, 0.1), (0.4, 0.4, 0.2)]:
    pr = wmc_bruteforce(torch.tensor(p), eo).item()
    print(f"p={p}  P(alpha)={pr:.3f}  semantic loss={-math.log(pr):.2f}")

print("\n== 2.1.2 penguin rules: (P -> B) & (P -> ~F), variables (B, F, P) ==")
cnf = [[-3, 1], [-3, -2]]
p = (0.9, 0.8, 0.8)
sat = viol = 0.0
for world in itertools.product([0, 1], repeat=3):
    w = world_prob(world, p)
    ok = satisfies(world, cnf)
    sat, viol = sat + w * ok, viol + w * (not ok)
    print(f"  world {world}  prob {w:.3f}  {'satisfies' if ok else 'VIOLATES'}")
print(f"Pr(alpha)={sat:.3f}  violation={viol:.3f}  L^s={-math.log(sat):.2f}")

probs = torch.tensor(p, requires_grad=True)
pr = wmc_bruteforce(probs, cnf)
pr.backward()
print("dPr/dp (B, F, P) =", [round(g, 2) for g in probs.grad.tolist()])
probs.grad = None
(-torch.log(wmc_bruteforce(probs, cnf))).backward()
print("dL/dp  (B, F, P) =", [round(g, 2) for g in probs.grad.tolist()], "(= -dPr/dp / Pr)")

print("\n== gradient descent on logits with the semantic loss only ==")
z = torch.logit(torch.tensor(p)).requires_grad_()
opt = torch.optim.SGD([z], lr=0.5)
for step in range(21):
    q = torch.sigmoid(z)
    loss = -torch.log(wmc_bruteforce(q, cnf))
    if step % 5 == 0:
        print(f"  step {step:2d}  p(B,F,P)={[round(v, 3) for v in q.tolist()]}  L^s={loss.item():.3f}")
    opt.zero_grad()
    loss.backward()
    opt.step()
