"""The 'is this a retina at all?' check in front of the quality gate.

Regression for a real incident: a sharp, evenly lit screenshot of browser instructions
passed focus, illumination and field-of-view, and was graded ICDR 4 at 99% confidence.
"""
from pathlib import Path

import cv2
import numpy as np
import pytest

from src.quality.gate import NOT_FUNDUS_MESSAGE, assess, fundus_likeness

SAMPLES = Path(__file__).resolve().parents[1] / "web" / "public" / "samples"
REAL = sorted(SAMPLES.glob("aptos-*.png"))


def _screenshot_like():
    """White page, dark text, coloured UI chrome: what a screenshot looks like."""
    img = np.full((720, 1100, 3), 242, np.uint8)
    cv2.rectangle(img, (0, 0), (1100, 60), (60, 60, 60), -1)
    cv2.rectangle(img, (40, 120), (520, 600), (255, 255, 255), -1)
    cv2.rectangle(img, (600, 120), (1060, 600), (230, 120, 40), -1)          # blue panel
    cv2.rectangle(img, (640, 480), (800, 540), (80, 180, 60), -1)            # green button
    for y in range(160, 580, 40):
        cv2.putText(img, "Open this link and click Add", (60, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (30, 30, 30), 2)
    return img


NON_FUNDUS = {
    "screenshot": _screenshot_like(),
    "document": np.full((800, 600, 3), 250, np.uint8),
    "noise": np.random.default_rng(1).integers(0, 256, (400, 400, 3), dtype=np.uint8),
    "grey_disc": cv2.circle(np.zeros((400, 400, 3), np.uint8), (200, 200), 160,
                            (190, 190, 190), -1),
    "green_landscape": np.dstack([np.full((300, 500), c, np.uint8) for c in (60, 150, 70)]),
}


@pytest.mark.skipif(not REAL, reason="sample fundus images not present")
@pytest.mark.parametrize("path", REAL, ids=lambda p: p.stem)
def test_every_real_fundus_sample_is_recognised(path):
    q = assess(cv2.imread(str(path)))
    assert q["is_fundus"] is True, (path.name, q["fundus_score"])
    # ...and the original quality messages still apply to the deliberately bad ones
    if "ungradeable" in path.stem:
        assert q["gradeable"] is False
        assert q["recapture_instruction"] != NOT_FUNDUS_MESSAGE


@pytest.mark.parametrize("name", list(NON_FUNDUS))
def test_non_fundus_images_are_refused_not_graded(name):
    q = assess(NON_FUNDUS[name])
    assert q["is_fundus"] is False, (name, q["fundus_score"])
    assert q["gradeable"] is False
    assert q["recapture_instruction"] == NOT_FUNDUS_MESSAGE


def test_fundus_likeness_is_a_fraction():
    for img in NON_FUNDUS.values():
        assert 0.0 <= fundus_likeness(img) <= 1.0
