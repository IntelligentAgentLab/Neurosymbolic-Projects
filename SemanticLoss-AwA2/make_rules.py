"""Generates the knowledge base for the five-animal subset and checks it.

Writes kb/rules.json (clauses per rule family) and prints a report: the rules, whether every class's own
attribute vector satisfies them, and the number of satisfying worlds for each rule set.
"""
import json
import urllib.request
import zipfile
from pathlib import Path

from semloss import kb

ROOT = Path("data/Animals_with_Attributes2")


def fetch_base():
    """Downloads AwA2-base.zip (32 KB: classes, attributes, class-attribute matrices) if missing."""
    if ROOT.exists():
        return
    zpath = ROOT.parent / "AwA2-base.zip"
    zpath.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve("https://cvml.ista.ac.at/AwA2/AwA2-base.zip", zpath)
    zipfile.ZipFile(zpath).extractall(ROOT.parent)


def main():
    fetch_base()
    classes, attrs, binary, cont = kb.load_matrix(ROOT)
    fams = {"R1": kb.rules_r1(), "R2": kb.rules_r2(classes, attrs, cont),
            "R3": kb.rules_r3(classes, attrs, cont), "R4": kb.rules_r4(attrs, binary)}
    names = kb.var_names()
    n = len(names)
    print(f"variables ({n}): " + ", ".join(f"{i + 1}:{v}" for i, v in enumerate(names)))
    for f, rs in fams.items():
        print(f"\n{f}: {len(rs)} clauses")
        for _, _, desc in rs if f != "R1" else rs[:1]:
            print("   ", desc)
    rows = kb.class_rows(classes, attrs, binary)
    sets = {"R1": ["R1"], "R1+R2": ["R1", "R2"], "R1+R4": ["R1", "R4"], "R1+R2+R3+R4": ["R1", "R2", "R3", "R4"]}
    print(f"\nworlds: 2^{n} = {2 ** n}")
    report = {}
    for name, fs in sets.items():
        clauses = [cl for f in fs for _, cl, _ in fams[f]]
        sat = kb.satisfying_worlds(clauses, n)
        ok = {c: bool((sat == rows[i]).all(1).any()) for i, c in enumerate(kb.CLASSES)}
        report[name] = {"clauses": len(clauses), "satisfying_worlds": len(sat), "class_rows_satisfy": ok}
        print(f"  {name:12s} clauses {len(clauses):3d}  satisfying worlds {len(sat):6d}  class rows satisfy: {ok}")
    out = Path("kb"); out.mkdir(exist_ok=True)
    json.dump({"variables": names, "families": {f: [{"clause": cl, "desc": d} for _, cl, d in rs] for f, rs in fams.items()},
               "sets": report, "thresholds": {"pos": kb.POS, "neg": kb.NEG, "min_support": kb.MIN_SUPPORT}},
              open(out / "rules.json", "w"), indent=1)


if __name__ == "__main__":
    main()
