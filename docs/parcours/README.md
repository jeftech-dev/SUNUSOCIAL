# Parcours — source of the flow chart

`docs/PARCOURS.md` (Mermaid, for GitHub) and the interactive page shared with the board are both generated from `data.py`.
Edit `data.py` (scenarios, steps, buttons, gaps), then regenerate:

```bash
python3 docs/parcours/gen.py docs/PARCOURS.md /tmp/parcours.json /tmp/parcours.mmd
python3 -c "t=open('docs/parcours/template.html').read(); d=open('/tmp/parcours.json').read(); open('/tmp/parcours.html','w').write(t.replace('__DATA__', d.replace('</','<\\\\/')))"
```

`/tmp/parcours.html` is the interactive page (republished by JefTech to the same link).
Keep Mermaid-safe text in `data.py`: no `;` or `#` (the generator replaces them anyway).
