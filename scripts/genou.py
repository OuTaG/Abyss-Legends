"""Coupe une jambe en cuisse + tibia au genou, avec des bouts arrondis contourés."""
import sys
import numpy as np
from PIL import Image

def couper(src, cuisse_dst, tibia_dst, ratio, recouvrement=18, trait=5):
    a = np.array(Image.open(src).convert("RGBA")).astype(int)
    h, w = a.shape[:2]
    op = a[..., 3] > 128
    yk = int(h * ratio)
    xs = np.where(op[yk])[0]
    x0, x1 = xs.min(), xs.max()
    cx, rx = (x0 + x1) / 2, (x1 - x0) / 2
    ry = recouvrement
    Y, X = np.mgrid[0:h, 0:w]
    dans_ellipse = ((X - cx) / rx) ** 2 + ((Y - yk) / ry) ** 2 <= 1
    contour = dans_ellipse & ~(((X - cx) / (rx - trait)) ** 2 + ((Y - yk) / (ry - trait)) ** 2 <= 1)
    for haut, dst in ((True, cuisse_dst), (False, tibia_dst)):
        garde = (Y < yk) | dans_ellipse if haut else (Y > yk) | dans_ellipse
        b = a.copy()
        b[..., 3] = np.where(garde & op, a[..., 3], 0)
        bord = contour & op & ((Y > yk) if haut else (Y < yk))
        b[bord, :3] = [12, 18, 24]
        ys = np.where(b[..., 3].any(axis=1))[0]
        Image.fromarray(b[ys.min():ys.max() + 1].astype(np.uint8)).save(dst)

if __name__ == "__main__":
    couper(sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]))
