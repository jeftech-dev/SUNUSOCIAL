import json, re, sys, textwrap, os
sys.path.insert(0, os.path.dirname(__file__))
from data import LANES, SCENARIOS, GAPS

ORDER = [k for k, _ in LANES]
NAME = dict(LANES)

def walk(steps):
    for st in steps:
        yield st
        if st["k"] == "alt":
            for br in st["br"]:
                yield from walk(br["steps"])

def lanes_of(sc):
    used = set()
    for st in walk(sc["steps"]):
        if st["k"] == "msg":
            used |= {st["frm"], st["to"]}
        if st["k"] == "alt":
            used.add(st["by"])
    idx = sorted(ORDER.index(x) for x in used)
    return ORDER[idx[0]], ORDER[idx[-1]]

# ---------------------------------------------------------------- Mermaid
def clean(t):
    t = t.replace(";", ",").replace("#", "n°")
    return t

def wrap(t, w=46):
    return "<br/>".join(textwrap.wrap(clean(t), w))

def msg_text(st):
    t = st["t"]
    if st["btn"]:
        t = "▶ " + st["btn"] + " · " + t
    return wrap(t)

def mm_steps(steps, span, ind):
    out = []
    a, b = span
    for st in steps:
        if st["k"] == "msg":
            out.append(f'{ind}{st["frm"]}->>{st["to"]}: {msg_text(st)}')
        elif st["k"] == "note":
            out.append(f'{ind}Note over {a},{b}: {wrap(st["t"], 70)}')
        elif st["k"] == "gap":
            g = GAPS[st["id"]]
            out.append(f'{ind}Note over {a},{b}: ⚠ {st["id"]} non décidé · {wrap(g[0], 60)}')
        elif st["k"] == "alt":
            for i, br in enumerate(st["br"]):
                kw = "alt" if i == 0 else "else"
                out.append(f'{ind}{kw} {NAME[st["by"]]} · {clean(br["label"])}')
                out += mm_steps(br["steps"], span, ind + "  ")
            out.append(f"{ind}end")
    return out

def mermaid():
    L = ["sequenceDiagram", "  autonumber"]
    for k, n in LANES:
        L.append(f"  participant {k} as {n}")
    for sc in SCENARIOS:
        span = lanes_of(sc)
        L.append("  rect rgba(128, 128, 128, 0.08)")
        head = f'{sc["id"]} · {sc["title"]}'
        if sc["pre"]:
            head += f'<br/>Point de départ : {sc["pre"]}'
        L.append(f"  Note over D,H: {clean(head)}")
        L += mm_steps(sc["steps"], span, "  ")
        L.append("  end")
    return "\n".join(L)

# ---------------------------------------------------------------- Markdown
def buttons():
    rows = []
    for sc in SCENARIOS:
        for st in walk(sc["steps"]):
            if st["k"] == "msg" and st["btn"]:
                rows.append((NAME[st["frm"]], st["btn"], st["t"], sc["id"]))
    return rows

def gap_refs():
    refs = {}
    for sc in SCENARIOS:
        for st in walk(sc["steps"]):
            if st["k"] == "gap":
                refs.setdefault(st["id"], [])
                if sc["id"] not in refs[st["id"]]:
                    refs[st["id"]].append(sc["id"])
    return refs

def markdown(mm):
    refs = gap_refs()
    md = []
    md.append("# SUNUSOCIAL — Parcours des utilisateurs\n")
    md.append("| | |\n|---|---|\n| **Date** | 29 octobre 2026 |\n| **Pour** | JËFTECH et le bureau de SUNUSOCIAL |\n| **Version interactive** | page partagée par JËFTECH (même contenu, avec recherche et filtre par rôle) |\n")
    md.append("Ce document décrit **tout ce qui va être développé**, sous la forme d'un seul schéma. Chaque colonne est un type d'utilisateur. Chaque flèche est une action ou une conséquence : on voit qui clique sur quoi, et ce que voient ensuite les autres utilisateurs. Les décisions du modérateur ouvrent des branches (« alt / else ») qui montrent chaque résultat possible.\n")
    md.append("**Les colonnes :** Donateur · Structure · **Système** (la plateforme, NabooPay, les SMS et les tâches automatiques comme les dates limites) · Modérateur · Hôpital.\n")
    md.append("**Les repères :** `▶ Bouton` indique le bouton cliqué. ⚠ **Gn** signale un point **non décidé** : la proposition de JËFTECH figure dans le tableau sous le schéma.\n")
    md.append(f"Le schéma couvre {len(SCENARIOS)} scénarios, {len(buttons())} boutons et {len(GAPS)} points à trancher.\n")
    md.append("## Le schéma complet\n")
    md.append("```mermaid\n" + mm + "\n```\n")
    md.append("## Points non décidés — propositions à valider\n")
    md.append("Pour chaque point, JËFTECH propose une règle. Cochez « OK » ou indiquez votre décision.\n")
    md.append("| Point | Scénarios | Question | Proposition | Décision |\n|---|---|---|---|---|")
    for gid, (title, q, p) in GAPS.items():
        md.append(f"| **{gid}** · {title} | {', '.join(refs.get(gid, []))} | {q} | {p} | ☐ OK · ☐ Autre : |")
    md.append("")
    md.append("## Index des scénarios\n")
    md.append("| N° | Scénario | Thème |\n|---|---|---|")
    for sc in SCENARIOS:
        md.append(f'| {sc["id"]} | {sc["title"]} | {sc["group"]} |')
    md.append("")
    md.append("## Index des boutons\n")
    md.append("Chaque bouton du produit, qui le voit, et le scénario du schéma où ses conséquences sont décrites.\n")
    md.append("| Bouton | Qui | Effet | Scénario |\n|---|---|---|---|")
    for who, btn, t, sid in sorted(buttons(), key=lambda r: (r[0], r[1])):
        md.append(f"| {btn} | {who} | {t} | {sid} |")
    md.append("")
    return "\n".join(md)

if __name__ == "__main__":
    out_md, out_json, out_mmd = sys.argv[1:4]
    mm = mermaid()
    open(out_mmd, "w").write(mm)
    open(out_md, "w").write(markdown(mm))
    refs = gap_refs()
    json.dump({"lanes": LANES, "scenarios": SCENARIOS,
               "gaps": {k: {"title": v[0], "q": v[1], "p": v[2], "refs": refs.get(k, [])} for k, v in GAPS.items()}},
              open(out_json, "w"), ensure_ascii=False)
    print("mermaid chars:", len(mm), "| scenarios:", len(SCENARIOS), "| buttons:", len(buttons()), "| gaps:", len(GAPS))
