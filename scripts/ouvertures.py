"""Repère et repeint les ouvertures sombres (manches, bottes, short) des pièces."""
import sys
import numpy as np
from PIL import Image

def morph(m, r, op):
    h, w = m.shape
    p = np.pad(m, r, constant_values=(op == "dil") is False)
    out = np.ones_like(m) if op == "ero" else np.zeros_like(m)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r:
                continue
            s = p[r + dy:r + dy + h, r + dx:r + dx + w]
            out = (out & s) if op == "ero" else (out | s)
    return out

def masque_ouverture(a, seuil, r):
    lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    opaque = a[..., 3] > 128
    sombre = opaque & (lum < seuil)
    # le contour extérieur touche la transparence : on ne garde que l'intérieur
    coeur = sombre & morph(opaque, r * 2, "ero")
    coeur = morph(morph(coeur, r, "ero"), r, "dil")
    zone = morph(coeur, r + 2, "dil") & sombre & morph(opaque, r, "ero")
    return zone

def repeindre(src, dst, seuil, r, apercu=None):
    a = np.array(Image.open(src).convert("RGBA")).astype(int)
    m = masque_ouverture(a, seuil, r)
    lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    tissu = (a[..., 3] > 128) & (lum > 30) & (lum < 60)
    couleur = np.median(a[tissu][:, :3], axis=0) if tissu.any() else np.array([30, 55, 65])
    b = a.copy()
    b[m, :3] = couleur.astype(int)
    Image.fromarray(b.astype(np.uint8)).save(dst)
    if apercu:
        c = a.copy(); c[m, :3] = [255, 0, 0]
        bg = Image.new("RGBA", (a.shape[1], a.shape[0]), (40, 60, 80, 255))
        bg.paste(Image.fromarray(c.astype(np.uint8)), (0, 0), Image.fromarray(c.astype(np.uint8)))
        bg.save(apercu)
    return int(m.sum())

if __name__ == "__main__":
    print(repeindre(sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), sys.argv[5] if len(sys.argv) > 5 else None))
