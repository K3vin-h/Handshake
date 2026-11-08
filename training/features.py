"""Feature extraction. MUST match frontend/src/cv/features.ts exactly (test_parity.py checks it).

Layout (88 numbers):
  [0..62]  normalized landmarks: wrist origin, scaled by wrist->middle knuckle,
           left hands mirrored, z * Z_WEIGHT
  [63..67] curl per finger (thumb, index, middle, ring, pinky)
  [68..77] pointing direction per finger, unit (x, y)
  [78..87] distances between every pair of fingertips
"""
import math

FEATURE_VERSION = 2
FEATURE_LENGTH = 88
Z_WEIGHT = 0.5

WRIST = 0
MIDDLE_MCP = 9
CHAINS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]
TIPS = [4, 8, 12, 16, 20]


def normalized_points(landmarks, handedness):
    """landmarks: list of 21 (x, y, z). handedness: 'Left' or 'Right'."""
    w = landmarks[WRIST]
    m = landmarks[MIDDLE_MCP]
    size = math.hypot(m[0] - w[0], m[1] - w[1], m[2] - w[2]) or 1.0
    flip = -1.0 if handedness == "Left" else 1.0
    return [
        (flip * (p[0] - w[0]) / size, (p[1] - w[1]) / size, (p[2] - w[2]) / size * Z_WEIGHT)
        for p in landmarks
    ]


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _len(a):
    return math.hypot(a[0], a[1], a[2])


def _angle(a, b, c):
    u, v = _sub(a, b), _sub(c, b)
    d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / ((_len(u) * _len(v)) or 1.0)
    return math.acos(max(-1.0, min(1.0, d)))


def extract_features(landmarks, handedness):
    pts = normalized_points(landmarks, handedness)
    out = []
    for p in pts:
        out.extend(p)
    for a, b, c, d in CHAINS:
        bend = ((math.pi - _angle(pts[a], pts[b], pts[c])) + (math.pi - _angle(pts[b], pts[c], pts[d]))) / 2
        out.append(bend / math.pi)
    for a, _, _, d in CHAINS:
        v = _sub(pts[d], pts[a])
        l = math.hypot(v[0], v[1]) or 1.0
        out.extend((v[0] / l, v[1] / l))
    for i in range(len(TIPS)):
        for j in range(i + 1, len(TIPS)):
            out.append(_len(_sub(pts[TIPS[i]], pts[TIPS[j]])))
    assert len(out) == FEATURE_LENGTH
    return out
