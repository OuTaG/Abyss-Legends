"""Détoure une planche de pièces sur fond vert et sauve chaque pièce en PNG."""
import sys, json
from collections import deque
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
img = np.asarray(Image.open(src).convert("RGB")).astype(np.int16)
r, g, b = img[..., 0], img[..., 1], img[..., 2]
fond = (g > r + 40) & (g > b + 40)
# alpha progressif sur les bords (pas d'escalier)
d = g - np.maximum(r, b)
alpha = (np.clip((70 - d) / 40.0, 0, 1) * 255).astype(np.uint8)
# atténue le liseré vert sur les bords
spill = g > np.maximum(r, b)
img[..., 1] = np.where(spill, np.maximum(r, b), g)

# étiquetage des zones opaques sur une version réduite
k = 4
petit = ~fond[::k, ::k]
h, w = petit.shape
lab = np.zeros((h, w), np.int32)
n = 0
boites = []
for y in range(h):
    for x in range(w):
        if petit[y, x] and not lab[y, x]:
            n += 1
            q = deque([(y, x)]); lab[y, x] = n
            y0 = y1 = y; x0 = x1 = x; cnt = 0
            while q:
                cy, cx = q.popleft(); cnt += 1
                y0, y1, x0, x1 = min(y0, cy), max(y1, cy), min(x0, cx), max(x1, cx)
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    ny, nx = cy+dy, cx+dx
                    if 0 <= ny < h and 0 <= nx < w and petit[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; q.append((ny, nx))
            if cnt > 300:
                boites.append((n, y0*k, y1*k+k, x0*k, x1*k+k))

rgba = np.dstack([img.clip(0, 255).astype(np.uint8), alpha])
infos = []
for i, (lid, y0, y1, x0, x1) in enumerate(sorted(boites, key=lambda t: (t[1], t[3]))):
    m = 6
    y0, x0 = max(0, y0-m), max(0, x0-m)
    y1, x1 = min(rgba.shape[0], y1+m), min(rgba.shape[1], x1+m)
    piece = rgba[y0:y1, x0:x1].copy()
    # garde uniquement la composante courante
    bloc = np.kron(lab == lid, np.ones((k, k), bool))[:rgba.shape[0], :rgba.shape[1]][y0:y1, x0:x1]
    # élargit le masque de la pièce pour ne pas rogner ses bords en escalier
    masque = bloc.copy()
    for dy in range(-2 * k, 2 * k + 1, 2):
        for dx in range(-2 * k, 2 * k + 1, 2):
            masque |= np.roll(np.roll(bloc, dy, 0), dx, 1)
    piece[..., 3] = np.where(masque, piece[..., 3], 0)
    nom = f"piece_{i:02d}.png"
    Image.fromarray(piece).save(f"{out}/{nom}")
    infos.append({"fichier": nom, "x": int(x0), "y": int(y0), "w": int(x1-x0), "h": int(y1-y0)})
json.dump(infos, open(f"{out}/pieces.json", "w"), indent=1)
for p in infos: print(p)
