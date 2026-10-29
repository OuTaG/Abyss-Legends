"""Construit les pièces finales du plongeur à partir de la planche découpée."""
import sys, os, shutil
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from ouvertures import masque_ouverture, morph
from genou import couper

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
noms = {0: "tete", 1: "torse", 2: "bras_arriere", 3: "bras_avant", 4: "ceinture", 5: "main_arriere",
        6: "main_avant", 7: "bassin", 8: "harpon", 9: "bouteille", 10: "jambe_avant", 11: "jambe_arriere",
        12: "botte_arriere", 13: "botte_avant"}
P = {n: os.path.join(src, f"piece_{i:02d}.png") for i, n in noms.items()}
lire = lambda n: np.array(Image.open(P[n]).convert("RGBA")).astype(int)
ecrire = lambda a, n: Image.fromarray(a.astype(np.uint8)).save(os.path.join(dst, n + ".png"))

def trouer(a, seuil, r, haut=None):
    m = masque_ouverture(a, seuil, r)
    m = morph(morph(m, 5, "dil"), 5, "ero") & morph(a[..., 3] > 128, 4, "ero")
    if haut is not None:
        m[int(a.shape[0] * haut):] = False
    b = a.copy(); b[m, 3] = 0
    return b

def poignet_plein(a, part=0.32):
    """Peint le haut de la main (coupe du poignet) en peau unie, contour extérieur conservé."""
    op = a[..., 3] > 128
    lum = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    peau = op & (lum > 120)
    col = np.median(a[peau][:, :3], axis=0)
    zone = morph(op, 5, "ero")
    zone[int(a.shape[0] * part):] = False
    b = a.copy(); b[zone, :3] = col
    return b

for n in ("main_avant", "main_arriere"):
    ecrire(poignet_plein(lire(n)), n)
for n in ("tete", "torse", "bouteille", "harpon"):
    shutil.copy(P[n], os.path.join(dst, n + ".png"))
for n in ("bras_avant", "bras_arriere"):
    ecrire(trouer(lire(n), 22, 4), n)
for n in ("botte_avant", "botte_arriere"):
    ecrire(trouer(lire(n), 30, 3, haut=0.38), n)

# bassin : trou de jambe transparent + ceinture coupée net sous la bande
bas = trouer(lire("bassin"), 22, 4)
c = lire("ceinture"); op = c[..., 3] > 128
lum = c[..., 0] * .3 + c[..., 1] * .59 + c[..., 2] * .11
gris = op & (abs(c[..., 0] - c[..., 2]) < 25) & (lum > 110)
cut = np.where(gris.any(axis=1))[0].min() - 6
c[:cut, :, 3] = 0
for x in range(c.shape[1]):
    ys = np.where(op[cut:, x])[0]
    if len(ys) and ys.min() == 0:
        c[cut:cut + 4, x, :3] = [25, 15, 10]
belt = Image.fromarray(c.astype(np.uint8)); belt = belt.crop(belt.getbbox())
basI = Image.fromarray(bas.astype(np.uint8))
off = int(belt.height * 0.25)
W = max(basI.width, belt.width); H = basI.height + off
out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
out.paste(basI, ((W - basI.width) // 2, off), basI)
out.paste(belt, ((W - belt.width) // 2 + 4, 0), belt)
out.save(os.path.join(dst, "bassin_ceinture.png"))

couper(P["jambe_avant"], os.path.join(dst, "cuisse_avant.png"), os.path.join(dst, "tibia_avant.png"), 0.47)
couper(P["jambe_arriere"], os.path.join(dst, "cuisse_arriere.png"), os.path.join(dst, "tibia_arriere.png"), 0.47)
print(sorted(os.listdir(dst)))
