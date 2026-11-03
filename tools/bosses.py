"""Rig and animate the boss models (all CC-BY-4.0 from Sketchfab, credited in the game) and export js/boss_<name>.js.
usage: python3 bosses.py <name> <out.js>"""
import sys, re, numpy as np
from scipy.spatial import cKDTree
from glb import simplify, triangles
from skin import Rig, skinned_mesh, pose as skpose
from rigkit import Skel, auto_weights, top4, export, smooth_weights, prune_bridges

def mir(v): return (v[0], -v[1], -v[2])
def mirt(v): return (-v[0], v[1], v[2])
def P(**b):
    out = {}
    for k, v in b.items():
        if isinstance(v, dict): out[k] = v
        else: out[k] = {'r': v}
    return out
def S(name, r=None, t=None, s=None, rR=None):
    """same pose on both sides (right side mirrored) for bones name+'L' / name+'R'"""
    L, R = {}, {}
    if r is not None: L['r'] = r; R['r'] = mir(r) if rR is None else rR
    if t is not None: L['t'] = t; R['t'] = mirt(t)
    if s is not None: L['s'] = s; R['s'] = s
    return {name + 'L': L, name + 'R': R}
def M(*ds):
    o = {}
    for d in ds:
        for k, v in d.items(): o.setdefault(k, {}).update(v)
    return o

# ---------------------------------------------------------------- humanoid skeleton and clip library
def hum(pv, extra=()):
    """pv: pivot dict (left side; right mirrored unless given). returns Skel"""
    g = lambda k: pv[k]
    B = [('root', None, (0, 0, 0), None), ('hips', 'root', g('hips'), None), ('spine', 'hips', g('spine'), None), ('chest', 'spine', g('chest'), None),
         ('neck', 'chest', g('neck'), None), ('head', 'neck', g('head'), pv.get('headtip'))]
    if 'jaw' in pv: B.append(('jaw', 'head', g('jaw'), pv.get('jawtip')))
    for sd, f in (('L', lambda p: p), ('R', lambda p: (-p[0], p[1], p[2]))):
        B += [('clav' + sd, 'chest', f(g('clav')), None), ('arm' + sd, 'clav' + sd, f(g('arm')), None), ('fore' + sd, 'arm' + sd, f(g('fore')), None), ('hand' + sd, 'fore' + sd, f(g('hand')), f(g('handtip'))),
              ('thigh' + sd, 'hips', f(g('thigh')), None), ('shin' + sd, 'thigh' + sd, f(g('shin')), None), ('foot' + sd, 'shin' + sd, f(g('foot')), f(g('toe')))]
    B += list(extra)
    return Skel(B)

def clip(d, keys, loop=False): return {'d': d, 'k': keys, 'loop': loop}
REST = {}

def lib(A=1.0, heavy=1.0, armdown=0.0):
    """generic humanoid clips. A scales the motion, armdown: extra arm offset (deg rz) used to bring wide arms in"""
    a = lambda v: tuple(x * A for x in v)
    C = {}
    C['idle'] = clip(2.4, [(0, M(P(chest={'s': 1.0}), S('arm', (0, 0, 3)), S('fore', (-6, 0, 0)))),
                           (1.2, M(P(chest={'r': (-3, 0, 0), 's': 1.035}, hips={'t': (0, -.008, 0)}, head=(-4, 8, 0), spine=(2, 0, 0)), S('arm', (-4, 0, 7)), S('fore', (-12, 0, 0)), S('thigh', (-3, 0, 0)), S('shin', (6, 0, 0)))),
                           (2.4, M(P(chest={'s': 1.0}), S('arm', (0, 0, 3)), S('fore', (-6, 0, 0))))], loop=True)
    stepL = M(P(hips={'t': (0, -.012, 0), 'r': (0, 9, 0)}, chest=(5, -8, 0), head=(0, 4, 0)), {'thighL': {'r': (-28, 0, 0)}, 'thighR': {'r': (24, 0, 0)}, 'shinL': {'r': (8, 0, 0)}, 'shinR': {'r': (30, 0, 0)}, 'footL': {'r': (-12, 0, 0)}, 'footR': {'r': (10, 0, 0)},
                                                                                      'armL': {'r': (22, 0, 4)}, 'armR': {'r': (-22, 0, -4)}, 'foreL': {'r': (-8, 0, 0)}, 'foreR': {'r': (-30, 0, 0)}})
    def flip(p):
        o = {}
        for k, v in p.items():
            k2 = k[:-1] + ('R' if k.endswith('L') else 'L') if k[-1] in 'LR' and k not in ('root',) else k
            v2 = {}
            for kk, vv in v.items():
                if kk == 'r': v2[kk] = mir(vv) if k[-1] in 'LR' else (vv[0], -vv[1], -vv[2])
                elif kk == 't': v2[kk] = mirt(vv)
                else: v2[kk] = vv
            o[k2] = v2
        return o
    passL = M(P(hips={'t': (0, .014, 0)}, chest=(4, 0, 0)), {'thighL': {'r': (0, 0, 0)}, 'thighR': {'r': (-20, 0, 0)}, 'shinL': {'r': (5, 0, 0)}, 'shinR': {'r': (55, 0, 0)}})
    C['walk'] = clip(1.1, [(0, stepL), (.275, passL), (.55, flip(stepL)), (.825, flip(passL)), (1.1, stepL)], loop=True)
    crouch = M(P(hips={'t': (0, -.07 * heavy, .01)}), S('thigh', (-32, 0, 0)), S('shin', (52, 0, 0)), S('foot', (-20, 0, 0)))
    C['roar'] = clip(2.2, [(0, {}), (.45, M(P(chest={'r': a((-26, 0, 0)), 's': 1.04}, head=a((-30, 0, 0)), jaw=(30, 0, 0), spine=a((-8, 0, 0)), hips={'t': (0, -.02, 0)}), S('arm', a((-40, 0, 55))), S('fore', (-40, 0, 0)))),
                           (.8, M(P(chest={'r': a((18, 0, 0)), 's': 1.07}, head=a((22, 0, 0)), jaw=(38, 0, 0), spine=a((8, 0, 0))), crouch, S('arm', a((-25, 0, 70))), S('fore', (-30, 0, 0)), S('hand', (0, 0, 20)))),
                           (1.0, M(P(chest={'r': a((18, 5, 0)), 's': 1.07}, head=a((24, 8, 6)), jaw=(42, 0, 0)), crouch, S('arm', a((-27, 0, 73))), S('fore', (-26, 0, 0)))),
                           (1.2, M(P(chest={'r': a((18, -5, 0)), 's': 1.07}, head=a((24, -8, -6)), jaw=(40, 0, 0)), crouch, S('arm', a((-23, 0, 68))), S('fore', (-32, 0, 0)))),
                           (1.45, M(P(chest={'r': a((16, 4, 0)), 's': 1.06}, head=a((20, 6, 4)), jaw=(36, 0, 0)), crouch, S('arm', a((-25, 0, 70))), S('fore', (-28, 0, 0)))),
                           (2.2, {})])
    C['hurt'] = clip(.75, [(0, {}), (.12, M(P(chest=a((-20, 0, 9)), head=a((-28, 12, 0)), hips={'t': (0, 0, -.035)}, jaw=(20, 0, 0)), S('arm', a((-30, 0, 30))), S('fore', (-40, 0, 0)))), (.4, M(P(chest=a((-6, 0, 3)), head=a((-8, 4, 0))), S('arm', (-8, 0, 8)))), (.75, {})])
    hunch = M(P(chest={'r': a((26, 0, 0))}, head=a((28, 0, 0)), spine=a((10, 0, 0)), hips={'t': (0, -.06 * heavy, 0)}, jaw=(14, 0, 0)), S('thigh', (-26, 0, 0)), S('shin', (42, 0, 0)), S('arm', (-8, 0, 4)), S('fore', (-6, 0, 0)))
    C['stagger'] = clip(1.6, [(0, hunch), (.4, M(hunch, P(chest={'r': a((26, 0, -9))}, head=a((30, 0, -12))))), (.8, hunch), (1.2, M(hunch, P(chest={'r': a((26, 0, 9))}, head=a((30, 0, 12))))), (1.6, hunch)], loop=True)
    over = M(S('clav', a((-22, 0, 8))), S('arm', a((-135, 0, 10))), S('fore', a((-25, 0, 0))), P(chest={'r': a((-22, 0, 0)), 's': 1.04}, head=a((-14, 0, 0)), hips={'t': (0, .02, 0)}, jaw=(20, 0, 0)))
    hit = M(S('arm', a((-42, 0, 10))), S('fore', (0, 0, 0)), P(chest={'r': a((36, 0, 0))}, head=a((22, 0, 0)), spine=a((10, 0, 0)), jaw=(30, 0, 0)), crouch, P(hips={'t': (0, -.09 * heavy, .03)}))
    C['slam'] = clip(1.0, [(0, {}), (.18, M(crouch, S('arm', (10, 0, 15)))), (.55, over), (.72, M(over, P(chest={'r': a((-28, 0, 0))}), S('arm', a((-145, 0, 10))))), (.84, hit), (.9, M(hit, P(hips={'t': (0, -.075 * heavy, .03)}))), (1.0, hit)])
    rup = {'clavR': {'r': a((-20, 0, -8))}, 'armR': {'r': a((-140, 0, -5))}, 'foreR': {'r': a((-30, 0, 0))}}
    C['smash'] = clip(1.0, [(0, {}), (.5, M(rup, P(chest={'r': a((-16, -22, 0))}, head=(-10, -10, 0), hips={'t': (0, .01, 0)}), {'armL': {'r': (15, 0, 20)}})),
                            (.82, M({'armR': {'r': a((-45, 0, 5))}, 'foreR': {'r': (0, 0, 0)}, 'armL': {'r': (25, 0, 25)}}, P(chest={'r': a((34, 26, 0))}, head=a((15, 15, 0)), jaw=(28, 0, 0)), crouch, P(hips={'t': (0, -.08 * heavy, .04)}))),
                            (1.0, M({'armR': {'r': a((-40, 0, 5))}, 'armL': {'r': (25, 0, 25)}}, P(chest={'r': a((32, 24, 0))}, head=a((12, 12, 0))), crouch))])
    lift = {'thighR': {'r': a((-75, 0, -8))}, 'shinR': {'r': a((75, 0, 0))}, 'footR': {'r': (-15, 0, 0)}}
    C['stomp'] = clip(1.0, [(0, {}), (.5, M(lift, P(chest={'r': a((-12, 0, -8))}, hips={'t': (0, .02, 0), 'r': (0, 0, -6)}), S('arm', a((-30, 0, 45))))),
                            (.66, M(lift, {'thighR': {'r': a((-85, 0, -8))}}, P(chest={'r': a((-16, 0, -8))}), S('arm', a((-40, 0, 55))))),
                            (.8, M(P(chest={'r': a((24, 0, 0))}, head=(14, 0, 0), jaw=(30, 0, 0), hips={'t': (0, -.07 * heavy, 0)}), S('thigh', (-25, 0, 0)), S('shin', (35, 0, 0)), S('arm', a((-15, 0, 60))))),
                            (1.0, M(P(chest={'r': a((20, 0, 0))}, hips={'t': (0, -.05 * heavy, 0)}), S('thigh', (-20, 0, 0)), S('shin', (28, 0, 0)), S('arm', a((-10, 0, 50)))))])
    C['throw'] = clip(1.0, [(0, {}), (.3, M(crouch, {'armR': {'r': a((-30, 0, -10))}, 'foreR': {'r': (-60, 0, 0)}}, P(chest={'r': (20, 10, 0)}))),
                            (.62, M({'armR': {'r': a((-165, 0, -15))}, 'foreR': {'r': a((-70, 0, 0))}, 'armL': {'r': a((-60, 0, 20))}}, P(chest={'r': a((-26, -32, 0))}, head=(-12, -10, 0), hips={'r': (0, -12, 0)}))),
                            (.8, M({'armR': {'r': a((-75, 0, 0))}, 'foreR': {'r': (-5, 0, 0)}, 'armL': {'r': (10, 0, 20)}}, P(chest={'r': a((28, 30, 0))}, head=(10, 15, 0), jaw=(30, 0, 0), hips={'r': (0, 14, 0), 't': (0, -.03, .02)}))),
                            (1.0, M({'armR': {'r': a((-25, 0, 10))}, 'foreR': {'r': (-10, 0, 0)}, 'armL': {'r': (15, 0, 20)}}, P(chest={'r': a((34, 34, 0))}, head=(14, 18, 0), hips={'r': (0, 16, 0), 't': (0, -.05, .03)})))])
    deep = M(P(hips={'t': (0, -.13 * heavy, 0)}, chest={'r': a((36, 0, 0))}, head=(-20, 0, 0)), S('thigh', (-55, 0, 0)), S('shin', (85, 0, 0)), S('foot', (-30, 0, 0)), S('arm', a((35, 0, 25))))
    C['leap'] = clip(1.0, [(0, {}), (.28, deep), (.42, M(P(root={'t': (0, .45, .05)}, chest={'r': a((-15, 0, 0))}, head=(-15, 0, 0)), S('clav', a((-18, 0, 8))), S('arm', a((-140, 0, 15))), S('thigh', (-30, 0, 0)), S('shin', (40, 0, 0)))),
                           (.58, M(P(root={'t': (0, .75, .12)}, chest={'r': a((-20, 0, 0))}, jaw=(30, 0, 0)), S('clav', a((-20, 0, 8))), S('arm', a((-145, 0, 10))), S('thigh', (-65, 0, 0)), S('shin', (70, 0, 0)))),
                           (.74, M(P(root={'t': (0, .4, .2)}, chest={'r': a((20, 0, 0))}), S('arm', a((-130, 0, 10))), S('thigh', (-45, 0, 0)), S('shin', (50, 0, 0)))),
                           (.85, M(deep, P(root={'t': (0, 0, .22)}, chest={'r': a((42, 0, 0))}, head=(20, 0, 0), jaw=(36, 0, 0)), S('arm', a((-55, 0, 30))))),
                           (1.0, M(deep, P(root={'t': (0, 0, .22)}, chest={'r': a((38, 0, 0))}), S('arm', a((-45, 0, 30)))))])
    up = M(S('clav', a((-15, 0, 12))), S('arm', a((-130, 0, 28))), S('fore', a((-15, 0, 0))), S('hand', (0, 0, 25)), P(chest={'r': a((-26, 0, 0)), 's': 1.05}, head=a((-36, 0, 0)), jaw=(30, 0, 0), spine=a((-8, 0, 0)), hips={'t': (0, .015, 0)}))
    C['summon'] = clip(1.2, [(0, {}), (.35, M(crouch, S('arm', (-20, 0, 30)))), (.7, up), (.85, M(up, P(head=a((-40, 6, 0))), S('arm', a((-155, 0, 36))))), (1.0, M(up, P(head=a((-36, -6, 0))))), (1.2, up)])
    fw = M(S('arm', a((-82, 0, 12))), S('fore', (-10, 0, 0)), S('hand', (0, 0, 15)), P(chest={'r': a((16, 0, 0))}, head=(8, 0, 0), jaw=(20, 0, 0)), crouch)
    bk = M(S('arm', a((-62, 0, 22))), S('fore', a((-95, 0, 0))), P(chest={'r': a((-8, 0, 0))}, head=(-6, 0, 0), jaw=(30, 0, 0)), crouch)
    C['pull'] = clip(1.0, [(0, fw), (.5, bk), (1.0, fw)], loop=True)
    open_ = M(S('arm', a((30, 0, 72))), S('fore', (-20, 0, 0)), P(chest={'r': a((-28, 0, 0)), 's': 1.07}, head=a((-18, 0, 0)), jaw=(26, 0, 0), spine=(-8, 0, 0)))
    thrust = M(S('arm', a((-92, 0, 16))), S('fore', (0, 0, 0)), S('hand', (0, 0, 10)), P(chest={'r': a((26, 0, 0)), 's': 1.02}, head=(12, 0, 0), jaw=(36, 0, 0)), crouch)
    C['blast'] = clip(1.0, [(0, {}), (.5, open_), (.7, M(open_, S('arm', a((36, 0, 78))))), (.82, thrust), (1.0, thrust)])
    run = M(P(chest={'r': a((42, 0, 0))}, head=a((-24, 0, 0)), spine=(10, 0, 0), hips={'t': (0, -.06 * heavy, .02)}, jaw=(24, 0, 0)), S('arm', a((48, 0, 22))), S('fore', (-20, 0, 0)))
    C['dashprep'] = clip(1.0, [(0, {}), (.6, M(run, S('thigh', (-40, 0, 0)), S('shin', (60, 0, 0)))), (1.0, M(run, {'thighL': {'r': (-50, 0, 0)}, 'thighR': {'r': (10, 0, 0)}, 'shinL': {'r': (40, 0, 0)}, 'shinR': {'r': (50, 0, 0)}}))])
    C['charge'] = clip(.5, [(0, M(run, {'thighL': {'r': (-50, 0, 0)}, 'thighR': {'r': (30, 0, 0)}, 'shinL': {'r': (30, 0, 0)}, 'shinR': {'r': (70, 0, 0)}})),
                            (.25, M(run, {'thighR': {'r': (-50, 0, 0)}, 'thighL': {'r': (30, 0, 0)}, 'shinR': {'r': (30, 0, 0)}, 'shinL': {'r': (70, 0, 0)}})),
                            (.5, M(run, {'thighL': {'r': (-50, 0, 0)}, 'thighR': {'r': (30, 0, 0)}, 'shinL': {'r': (30, 0, 0)}, 'shinR': {'r': (70, 0, 0)}}))], loop=True)
    wide = M(S('arm', (-5, 0, 85)), S('fore', (-5, 0, 0)), crouch)
    C['spin'] = clip(1.2, [(0, {}), (.25, M(wide, P(root={'r': (0, -30, 0)}))), (.5, M(wide, P(root={'r': (0, 100, 0)}))), (.75, M(wide, P(root={'r': (0, 230, 0)}))), (.95, M(wide, P(root={'r': (0, 340, 0)}))), (1.2, P(root={'r': (0, 360, 0)}))])
    curl = M(S('arm', a((-70, 0, -30))), S('fore', a((-100, 0, 0))), P(chest={'r': a((40, 0, 0)), 's': .95}, head=(30, 0, 0), spine=(14, 0, 0)), deep)
    burst = M(S('arm', a((-120, 0, 80))), S('fore', (0, 0, 0)), S('hand', (0, 0, 30)), P(chest={'r': a((-30, 0, 0)), 's': 1.1}, head=(-35, 0, 0), jaw=(45, 0, 0), hips={'t': (0, .03, 0)}), S('thigh', (-5, 0, 10)))
    C['nova'] = clip(1.0, [(0, {}), (.4, curl), (.78, M(curl, P(chest={'s': .9}))), (.86, burst), (1.0, burst)])
    back = M(P(head=a((-34, 0, 0)), neck=a((-14, 0, 0)), chest={'r': a((-18, 0, 0)), 's': 1.05}, jaw=(10, 0, 0)), S('arm', (10, 0, 25)))
    fwd = M(P(head=a((32, 0, 0)), neck=a((22, 0, 0)), chest={'r': a((18, 0, 0))}, jaw=(44, 0, 0), hips={'t': (0, -.03, .03)}), S('arm', (-30, 0, 30)))
    C['spit'] = clip(1.0, [(0, {}), (.55, back), (.82, fwd), (.9, M(fwd, P(head=a((36, 0, 0))))), (1.0, fwd)])
    return C

# ---------------------------------------------------------------- loading helpers
def norm_tf(T, drop_below=None):
    if drop_below is not None: T = T[T[:, :, 1].min(1) > drop_below]
    P_ = T.reshape(-1, 3); lo, hi = P_.min(0), P_.max(0); h = hi[1] - lo[1]
    c = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]); return c, h

def prep_static(nm, target, drop_below=None, drop=None):
    z = np.load('user2/%s_tri.npz' % nm); T, C = z['T'].astype(float), z['C'].astype(float)
    if drop_below is not None: k = T[:, :, 1].min(1) > drop_below; T, C = T[k], C[k]
    if drop is not None: k = ~drop(T); T, C = T[k], C[k]
    c, h = norm_tf(T); T = (T - c) / h
    V, F, FC, _ = simplify(T, C, target)
    VC = np.zeros((len(V), 3)); cnt = np.zeros(len(V))
    for k in range(3): np.add.at(VC, F[:, k], FC); np.add.at(cnt, F[:, k], 1)
    return V, F, VC / np.maximum(cnt, 1)[:, None]

def prep_skinned(path, target, mapfn):
    R = Rig(path); P0, Jn, W, C, F0 = skinned_mesh(R); Q = skpose(P0, Jn, W, R.skin_mats(0.0)); T = Q[F0]
    c, h = norm_tf(T); Qn = (Q - c) / h
    V, F, FC, _ = simplify(Qn[F0], C[F0].mean(1), target)
    VC = np.zeros((len(V), 3)); cnt = np.zeros(len(V))
    for k in range(3): np.add.at(VC, F[:, k], FC); np.add.at(cnt, F[:, k], 1)
    _, near = cKDTree(Qn).query(V)
    Wd = R.world(0.0); names = [R.J['nodes'][j].get('name', '') for j in R.joints]; jpos = np.array([(Wd[j][:3, 3] - c) / h for j in R.joints])
    return V, F, VC / np.maximum(cnt, 1)[:, None], Jn[near], W[near], names, jpos, (c, h)

def collapse(Jo, Wo, names, jpos, skel, rules):
    """map original joints onto our bones by name rules [(regex, bone)], fallback: nearest pivot"""
    tgt = []
    for n, p in zip(names, jpos):
        b = None
        for rx, bn in rules:
            if re.search(rx, n): b = bn; break
        if b is None: b = skel.names[int(np.argmin(np.linalg.norm(skel.piv - p, axis=1)))]
        tgt.append(skel.idx[b])
    tgt = np.array(tgt); W = np.zeros((len(Jo), len(skel.names)))
    for k in range(4): np.add.at(W, (np.arange(len(Jo)), tgt[Jo[:, k]]), Wo[:, k])
    return W

CRED = {'golem': 'Ricky the Golem by Agustin Ruella (sketchfab.com/agustinruella), CC-BY-4.0',
        'colossus': 'Stonebound Colossus by antromar3 (sketchfab.com/antromar3), CC-BY-4.0',
        'kraken': 'Octopus Blue Animal by 3dUVpro (sketchfab.com/3dUVpro), CC-BY-4.0',
        'cherub': 'Red Cherub by Spinnee (sketchfab.com/Spinnee), CC-BY-4.0',
        'queen': 'Xenomorph Queen Alien by M0RPH0 (sketchfab.com/morphurer), CC-BY-4.0',
        'blight': 'Fireborne Blight Queen by HighPolyDensity (sketchfab.com/HighPolyDensity), CC-BY-4.0',
        'plant': 'Sci-Fi Plant Capsule by Berk Gedik (sketchfab.com/berkgedik), CC-BY-4.0'}

def side_lock(skel):
    def f(i, V):
        n = skel.names[i]
        if n.endswith('L') and n not in ('root',): return V[:, 0] > -0.02
        if n.endswith('R'): return V[:, 0] < 0.02
        return np.ones(len(V), bool)
    return f

def build(nm, out):
    if nm == 'golem':
        pv = dict(hips=(0, .36, -.05), spine=(0, .48, -.06), chest=(0, .64, -.03), neck=(0, .78, .08), head=(0, .84, .18), headtip=(0, .95, .32),
                  clav=(.12, .77, 0), arm=(.33, .80, .04), fore=(.58, .56, .12), hand=(.56, .25, .16), handtip=(.55, .02, .18),
                  thigh=(.11, .33, -.04), shin=(.15, .18, 0), foot=(.14, .06, .02), toe=(.14, 0, .1))
        sk = hum(pv); V, F, VC = prep_static('golem', 11000)
        VC = VC * np.array([.92, 1.0, 1.12])  # a cool moon-rock tint
        W = auto_weights(V, F, sk, side_lock(sk), bones=[n for n in sk.names if n != 'root'])
        C = lib(A=.9, heavy=1.1); keep = ['idle', 'walk', 'roar', 'hurt', 'stagger', 'slam', 'smash', 'blast', 'throw', 'stomp', 'leap']
        anc = [('head', (0, .86, .3)), ('chest', (0, .62, .2)), ('handL', (.55, .05, .18)), ('handR', (-.55, .05, .18))]
    elif nm == 'colossus':
        pv = dict(hips=(0, .50, 0), spine=(0, .58, 0), chest=(0, .70, .01), neck=(0, .84, .03), head=(0, .89, .07), headtip=(0, .99, .1),
                  clav=(.05, .80, 0), arm=(.17, .80, 0), fore=(.30, .61, 0), hand=(.385, .45, .02), handtip=(.43, .36, .03),
                  thigh=(.08, .49, 0), shin=(.10, .27, -.01), foot=(.11, .065, -.02), toe=(.12, 0, .09))
        sk = hum(pv); V, F, VC = prep_static('colossus', 11000)
        VC = VC * 1.35 + np.array([.04, .03, .02])
        W = auto_weights(V, F, sk, side_lock(sk), bones=[n for n in sk.names if n != 'root'])
        C = lib(A=1.0); keep = ['idle', 'walk', 'roar', 'hurt', 'stagger', 'slam', 'throw', 'stomp', 'summon', 'pull', 'blast']
        anc = [('head', (0, .92, .1)), ('chest', (0, .72, .12)), ('handL', (.42, .37, .04)), ('handR', (-.42, .37, .04))]
    elif nm == 'cherub':
        R = Rig('user2/cherub.glb'); tmp = prep_skinned('user2/cherub.glb', 9000, None); V, F, VC, Jo, Wo, names, jpos, _ = tmp
        J = {n.rsplit('_', 1)[0] if re.search(r'_\d+$', n) else n: p for n, p in zip(names, jpos)}
        g = lambda k: tuple(J[k])
        pv = dict(hips=g('Hip'), spine=g('Spine_2'), chest=g('Spine_3'), neck=g('Chest'), head=g('Head'), headtip=tuple(np.array(g('Head')) + (0, .12, .05)),
                  clav=g('Arm_Left_1'), arm=g('Arm_Left_2'), fore=g('Arm_Left_4'), hand=g('Arm_Left_5'), handtip=g('Middle_Left_3'),
                  thigh=g('Leg_Left_1'), shin=g('Knee_Left_2'), foot=g('Foot_Left_1'), toe=g('Foot_Left_2'))
        sk = hum(pv)
        rules = [(r'_rootJoint|^Hip', 'hips'), (r'Spine_[12]', 'spine'), (r'Spine_3|Fragment', 'chest'), (r'^Chest', 'neck'), (r'^Head', 'head'),
                 (r'Arm_Left_1_', 'clavL'), (r'Arm_Left_[23]_', 'armL'), (r'Arm_Left_4', 'foreL'), (r'Arm_Left_5|_Left_\d', 'handL'),
                 (r'Arm_Right_1_', 'clavR'), (r'Arm_Right_[23]_', 'armR'), (r'Arm_Right_4', 'foreR'), (r'Arm_Right_5|_Right_\d', 'handR'),
                 (r'Leg_Left|Knee_Left_1', 'thighL'), (r'Knee_Left_2|Foot_Left_1', 'shinL'), (r'Foot_Left_2', 'footL'),
                 (r'Leg_Right|Knee_Right_1', 'thighR'), (r'Knee_Right_2|Foot_Right_1', 'shinR'), (r'Foot_Right_2', 'footR')]
        W = collapse(Jo, Wo, names, jpos, sk, rules); W = smooth_weights(W, F, 1, .7)
        VC = VC * 1.25
        C = lib(A=1.0, heavy=.8); keep = ['idle', 'walk', 'roar', 'hurt', 'stagger', 'dashprep', 'charge', 'blast', 'slam', 'summon', 'spin', 'nova']
        hd = np.array(g('Head')); anc = [('head', tuple(hd + (0, .06, .1))), ('chest', tuple(np.array(g('Spine_3')) + (0, 0, .15))), ('handL', g('Middle_Left_3')), ('handR', g('Middle_Right_3'))]
    elif nm == 'queen':
        V, F, VC, Jo, Wo, names, jpos, (c, h) = prep_skinned('user2/queen.glb', 12000, None)
        nrm = lambda p: tuple((np.array(p) - c) / h)
        pv = dict(hips=nrm((0, 1.28, -.05)), spine=nrm((0, 1.41, -.03)), chest=nrm((0, 1.67, -.02)), neck=nrm((0, 1.98, .06)), head=nrm((0, 2.08, .19)), headtip=nrm((0, 2.6, -.3)),
                  jaw=nrm((0, 2.0, .25)), jawtip=nrm((0, 1.88, .42)),
                  clav=nrm((.08, 1.86, .06)), arm=nrm((.2, 1.88, -.02)), fore=nrm((.43, 1.46, .05)), hand=nrm((.58, 1.22, .34)), handtip=nrm((.62, 1.0, .55)),
                  thigh=nrm((.13, 1.25, -.08)), shin=nrm((.16, .80, .27)), foot=nrm((.18, .49, -.2)), toe=nrm((.18, .03, .12)))
        tails = [nrm((0, 1.18, -.11)), nrm((0, .71, -.51)), nrm((0, .35, -1.06)), nrm((0, .11, -1.7)), nrm((0, .05, -2.02))]
        extra = [('tail0', 'hips', tails[0], None), ('tail1', 'tail0', tails[1], None), ('tail2', 'tail1', tails[2], None), ('tail3', 'tail2', tails[3], None), ('tail4', 'tail3', tails[4], nrm((0, .03, -2.4))),
                 ('imouth', 'head', nrm((0, 2.04, .26)), nrm((0, 1.9, .5)))]
        sk = hum(pv, extra)
        rules = [(r'MiniMouth', 'imouth'), (r'tong|jaw|lips_bot|teeth_bot|chin', 'jaw'), (r'^head|lips|teeth', 'head'), (r'^neck', 'neck'), (r'dupli', 'chest'),
                 (r'breast|spine_02', 'chest'), (r'spine_01', 'spine'), (r'^root|c_root|c_p_root|c_pos|c_traj', 'hips'),
                 (r'tail_0[01]', 'tail0'), (r'tail_0[23]', 'tail1'), (r'tail_0[45]', 'tail2'), (r'tail_06', 'tail3'), (r'tail_0[78]', 'tail4')]
        for sd, S_ in (('l', 'L'), ('r', 'R')):
            rules += [(r'(foot|toes).*\.%s' % sd, 'foot' + S_), (r'shoulder.*\.%s' % sd, 'clav' + S_), (r'forearm.*\.%s' % sd, 'fore' + S_), (r'arm.*\.%s' % sd, 'arm' + S_), (r'(hand|index|middle|ring|pinky|thumb).*\.%s' % sd, 'hand' + S_),
                      (r'thigh.*\.%s' % sd, 'thigh' + S_), (r'leg.*\.%s' % sd, 'shin' + S_), (r'(foot|toes).*\.%s' % sd, 'foot' + S_)]
        W = collapse(Jo, Wo, names, jpos, sk, rules); W = smooth_weights(W, F, 1, .7)
        VC = VC * 1.6 + np.array([.02, .03, .03])
        C = lib(A=1.0, heavy=.9)
        def tl(r, k=1.0): return {'tail%d' % i: {'r': tuple(x * k * (1 + i * .15) for x in r)} for i in range(5)}
        sw = lambda v: M(tl((0, v, 0)))
        for cn in ('idle',):
            C[cn]['k'] = [(t, M(p, tl((0, 7 * np.sin(t / 2.4 * 6.283), 0)), tl((3 * np.cos(t / 2.4 * 6.283), 0, 0)))) for t, p in C[cn]['k']]
        C['walk']['k'] = [(t, M(p, tl((0, 9 * np.sin(t / 1.1 * 6.283), 0)))) for t, p in C['walk']['k']]
        C['tail'] = clip(1.0, [(0, {}), (.5, M(sw(-22), P(hips={'r': (0, -25, 0)}, chest={'r': (10, 30, 0)}, head=(0, 20, 0)), S('thigh', (-25, 0, 0)), S('shin', (40, 0, 0)))),
                               (.8, M(sw(30), P(hips={'r': (0, 40, 0)}, chest={'r': (10, -35, 0)}, head=(0, -25, 0), jaw=(30, 0, 0)), S('thigh', (-25, 0, 0)), S('shin', (40, 0, 0)))),
                               (1.0, M(sw(24), P(hips={'r': (0, 30, 0)}, chest={'r': (6, -25, 0)}), S('thigh', (-20, 0, 0)), S('shin', (32, 0, 0))))])
        C['tailslam'] = clip(1.0, [(0, {}), (.55, M(tl((26, 0, 0)), P(chest={'r': (24, 0, 0)}, head=(10, 0, 0)), S('arm', (-40, 0, 30)))),
                                   (.82, M(tl((-3, 0, 0)), P(chest={'r': (-14, 0, 0)}, head=(-20, 0, 0), jaw=(40, 0, 0)), S('arm', (-20, 0, 50)))), (1.0, M(tl((0, 0, 0)), P(chest={'r': (-10, 0, 0)})))])
        im = lambda d: {'imouth': {'t': (0, -d * .4, d)}}
        C['spit']['k'] = [(t, M(p, im(.07 if .78 < t < .95 else 0))) for t, p in C['spit']['k']]
        C['roar']['k'] = [(t, M(p, im(.05 if .7 < t < 1.6 else 0), tl((12 if .4 < t < 1.6 else 0, 0, 0)))) for t, p in C['roar']['k']]
        keep = ['idle', 'walk', 'roar', 'hurt', 'stagger', 'spit', 'dashprep', 'charge', 'tail', 'tailslam', 'slam', 'summon']
        anc = [('jaw', pv['jawtip']), ('chest', tuple(np.array(pv['chest']) + (0, 0, .08))), ('handL', pv['handtip']), ('handR', mirt(pv['handtip'])), ('tail4', nrm((0, .03, -2.4)))]
    elif nm == 'kraken':
        V, F, VC = prep_static('kraken', 12000, drop_below=-0.6)
        VC = VC * 1.3 + np.array([.0, .02, .05])
        ctr = np.array([0.0, 0, 0]); body = (np.hypot(V[:, 0], V[:, 2]) < .28) & (V[:, 1] > .35)
        ctr[0], ctr[2] = V[body, 0].mean(), V[body, 2].mean()
        r = np.hypot(V[:, 0] - ctr[0], V[:, 2] - ctr[2]); th = np.arctan2(V[:, 2] - ctr[2], V[:, 0] - ctr[0])
        # 8 arm directions: k-means on the angle of far vertices
        far = r > .45; cen = np.linspace(-np.pi, np.pi, 8, endpoint=False) + .2
        for _ in range(30):
            d = np.angle(np.exp(1j * (th[far][:, None] - cen[None]))); lab = np.argmin(np.abs(d), 1)
            for k in range(8):
                if (lab == k).any(): cen[k] = np.angle(np.exp(1j * th[far][lab == k]).mean())
        cen = np.sort(cen); print('arm angles', np.degrees(cen).round(0))
        yb = V[:, 1].min(); radii = [.26, .52, .78]
        bones = [('root', None, (ctr[0], 0, ctr[2]), None), ('body', 'root', (ctr[0], .3, ctr[2]), None), ('mantle', 'body', (ctr[0], .55, ctr[2]), (ctr[0], 1.0, ctr[2]))]
        armdir = []
        for k, a in enumerate(cen):
            dv = np.array([np.cos(a), 0, np.sin(a)]); armdir.append(dv); prev = 'body'
            for s, rr in enumerate(radii):
                sel = (np.abs(np.angle(np.exp(1j * (th - a)))) < .3) & (np.abs(r - rr) < .06)
                yy = np.median(V[sel, 1]) if sel.sum() > 3 else .1
                bones.append(('a%d_%d' % (k, s), prev, (ctr[0] + dv[0] * rr, yy, ctr[2] + dv[2] * rr), None)); prev = 'a%d_%d' % (k, s)
        sk = Skel(bones)
        W = np.zeros((len(V), len(sk.names)))
        d = np.angle(np.exp(1j * (th[:, None] - cen[None]))); ak = np.argmin(np.abs(d), 1)
        for v in range(len(V)):
            rv = r[v]
            if rv < .2 or (rv < .3 and V[v, 1] > .3):
                W[v, sk.idx['mantle' if V[v, 1] > .45 else 'body']] = 1; continue
            k = ak[v]; segs = [sk.idx['a%d_%d' % (k, s)] for s in range(3)]
            if rv < radii[0]: u = (rv - .2) / (radii[0] - .2); W[v, sk.idx['body']] = 1 - u; W[v, segs[0]] = u
            elif rv < radii[1]: u = (rv - radii[0]) / (radii[1] - radii[0]); W[v, segs[0]] = 1 - u; W[v, segs[1]] = u
            elif rv < radii[2]: u = (rv - radii[1]) / (radii[2] - radii[1]); W[v, segs[1]] = 1 - u; W[v, segs[2]] = u
            else: W[v, segs[2]] = 1
        W = smooth_weights(W, F, 2, .6)
        def arms(fn):
            o = {}
            for k, dv in enumerate(armdir):
                lift = np.array([-dv[2], 0, dv[0]]); side = np.array([0, 1.0, 0])
                for s in range(3):
                    l, sw_ = fn(k, s, dv); o['a%d_%d' % (k, s)] = {'r': tuple(lift * l + side * sw_)}
            return o
        front = lambda dv: max(0, dv[2])
        C = {}
        C['idle'] = clip(3.0, [(t, M(arms(lambda k, s, dv, t=t: (9 * np.sin(t / 3 * 6.283 + k * .8 + s * .9), 6 * np.sin(t / 3 * 6.283 + k * 1.3 + s))),
                                     P(body={'t': (0, .02 * np.sin(t / 3 * 6.283), 0)}, mantle={'s': 1 + .04 * np.sin(t / 3 * 6.283), 'r': (4 * np.sin(t / 3 * 6.283 + 1), 0, 0)}))) for t in np.linspace(0, 3, 7)], loop=True)
        C['smash'] = clip(1.0, [(0, {}), (.55, M(arms(lambda k, s, dv: (front(dv) * (55 - s * 12) + 8, 0)), P(body={'r': (-12, 0, 0), 't': (0, .05, 0)}, mantle={'s': 1.06}))),
                                (.82, M(arms(lambda k, s, dv: (-front(dv) * 14, 0)), P(body={'r': (16, 0, 0), 't': (0, -.04, .04)}))), (1.0, M(arms(lambda k, s, dv: (-front(dv) * 10, 0)), P(body={'r': (12, 0, 0)})))])
        C['ring'] = clip(1.0, [(0, {}), (.55, M(arms(lambda k, s, dv: (40 + s * 15, 0)), P(body={'t': (0, .08, 0)}, mantle={'s': 1.08}))), (.85, M(arms(lambda k, s, dv: (-12, 0)), P(body={'t': (0, -.05, 0)}))), (1.0, arms(lambda k, s, dv: (-8, 0)))])
        C['beam'] = clip(1.0, [(0, {}), (.5, M(arms(lambda k, s, dv: (-6 + 20 * (dv[2] < 0), 0)), P(body={'r': (-28, 0, 0), 't': (0, .22, -.04)}, mantle={'s': 1.1}))),
                               (.82, M(arms(lambda k, s, dv: (-10, 0)), P(body={'r': (22, 0, 0), 't': (0, .14, .04)}, mantle={'s': 1.12}))), (1.0, M(arms(lambda k, s, dv: (-8, 0)), P(body={'r': (18, 0, 0), 't': (0, .1, .03)})))])
        C['spit'] = clip(1.0, [(0, {}), (.6, M(P(mantle={'s': 1.18}, body={'r': (-10, 0, 0), 't': (0, .05, 0)}), arms(lambda k, s, dv: (6, 0)))), (.82, M(P(mantle={'s': .9}, body={'r': (14, 0, 0)}), arms(lambda k, s, dv: (-6, 0)))), (1.0, P(mantle={'s': .97}))])
        C['quake'] = clip(1.0, [(0, {}), (.35, M(P(body={'t': (0, -.04, 0)}), arms(lambda k, s, dv: (-10, 0)))), (.6, M(P(root={'t': (0, .35, 0)}, mantle={'s': 1.05}), arms(lambda k, s, dv: (35 - s * 20, 0)))),
                                (.8, M(P(root={'t': (0, -.04, 0)}, mantle={'s': .92}), arms(lambda k, s, dv: (-18, 0)))), (1.0, M(P(mantle={'s': 1.0}), arms(lambda k, s, dv: (-12, 0))))])
        C['swirl'] = clip(1.2, [(0, {})] + [(t, M(P(root={'r': (0, 140 * t / 1.2, 0)}, mantle={'s': 1.05}), arms(lambda k, s, dv, t=t: (18 + 10 * np.sin(t * 9 + k), -22 - s * 6)))) for t in (.3, .6, .9)] + [(1.2, P(root={'r': (0, 140, 0)}))])
        C['roar'] = clip(2.0, [(0, {}), (.5, M(P(body={'r': (-25, 0, 0), 't': (0, .25, 0)}, mantle={'s': 1.15}), arms(lambda k, s, dv: (45 + s * 10, 0)))),
                               (.9, M(P(body={'r': (-18, 6, 0), 't': (0, .25, 0)}, mantle={'s': 1.18}), arms(lambda k, s, dv: (50 + s * 10, 8)))), (1.3, M(P(body={'r': (-18, -6, 0), 't': (0, .25, 0)}, mantle={'s': 1.15}), arms(lambda k, s, dv: (48 + s * 10, -8)))), (2.0, {})])
        C['hurt'] = clip(.7, [(0, {}), (.12, M(P(body={'r': (-16, 0, 8), 't': (0, .06, -.04)}, mantle={'s': .92}), arms(lambda k, s, dv: (20, 0)))), (.7, {})])
        dr = M(P(body={'t': (0, -.06, 0), 'r': (10, 0, 0)}, mantle={'s': .95}), arms(lambda k, s, dv: (-12, 0)))
        C['stagger'] = clip(1.6, [(0, dr), (.4, M(dr, P(body={'r': (10, 0, -8)}))), (.8, dr), (1.2, M(dr, P(body={'r': (10, 0, 8)}))), (1.6, dr)], loop=True)
        keep = list(C.keys())
        anc = [('mantle', (ctr[0], .55, ctr[2] + .28)), ('body', (ctr[0], .3, ctr[2])), ('a0_2', tuple(np.array(sk.piv[sk.idx['a0_2']]))), ('a4_2', tuple(np.array(sk.piv[sk.idx['a4_2']])))]
        Jn, Wq = top4(W); export(nm, V, F, VC, Jn, Wq, sk, {k: C[k] for k in keep}, anc, credit=CRED[nm], path=out); return
    elif nm == 'blight':
        R = Rig('user2/blight.glb'); P0, Jo, Wo, Co, F0 = skinned_mesh(R)
        names = [a.get('name') for a in R.J['animations']]
        def mats(ai, fps=12, t0=0, t1=None):
            R2 = Rig('user2/blight.glb', anim=ai); t1 = R2.dur if t1 is None else t1; n = int((t1 - t0) * fps) + 1; out = []
            for i in range(n):
                Wd = R2.world(t0 + i / fps); out.append(np.stack([Wd[j] @ R2.ibm[k] for k, j in enumerate(R2.joints)]))
            return np.array(out)
        rest = mats(0, t1=0)[0]; Q = skpose(P0, Jo, Wo, rest); c, h = norm_tf(Q[F0]); Qn = (Q - c) / h
        V, F, FC, _ = simplify(Qn[F0], Co[F0].mean(1), 12000)
        VC = np.zeros((len(V), 3)); cnt = np.zeros(len(V))
        for k in range(3): np.add.at(VC, F[:, k], FC); np.add.at(cnt, F[:, k], 1)
        VC = VC / np.maximum(cnt, 1)[:, None] * 1.4 + np.array([.03, .01, .0])
        _, near = cKDTree(Qn).query(V); J4, W4 = Jo[near], Wo[near]
        # bind-space verts are the original (un-normalized, un-posed) mesh positions: re-derive bind positions for the simplified verts
        Nm = np.eye(4); Nm[:3, :3] /= h; Nm[:3, 3] = -c / h; Ni = np.linalg.inv(Nm)
        # use normalized rest positions as the bind space: matrix' = N * M * rest^-1 * N^-1 (per bone, blend-safe since weights sum to 1)
        clipsel = {'idle': ('Basic Idle', None), 'walk': ('Walk Cycle', None), 'hurt': ('Take Damage', None), 'stagger': ('Scared Idle', None), 'roar': ('Cautious Idle', None),
                   'leap': ('Leap', None), 'burrow': ('Burrow', None), 'spray': ('Spray Fire', None), 'sweep': ('Fire Sweep Attack', None), 'vomit': ('Vomit Attack', None),
                   'egg': ('Lay Egg', None), 'block': ('Shield Block', None)}
        restinv = np.linalg.inv(rest); C = {}
        for cn, (an, _) in clipsel.items():
            Ms = mats(names.index(an)); Ms = np.einsum('ij,fbjk,bkl,lm->fbim', Nm, Ms, restinv, Ni)
            C[cn] = {'mats': Ms, 'loop': cn in ('idle', 'walk', 'stagger')}
            print(cn, an, len(Ms), 'frames')
        Jn, Wq = top4(_w4(J4, W4, len(R.joints)))
        hj = [i for i, j in enumerate(R.joints) if R.J['nodes'][j]['name'].startswith('Head')][0]
        jw = [i for i, j in enumerate(R.joints) if R.J['nodes'][j]['name'].startswith('Jaw_Left')][0]
        Wd = R.world(0); jp = lambda i: (Wd[R.joints[i]][:3, 3] - c) / h
        anc = [(jw, tuple(jp(jw) + (-.11, 0, .12))), (hj, tuple(jp(hj) + (0, .1, .2))), (2, tuple(jp(2))), (hj, tuple(jp(hj)))]
        export(nm, V, F, VC, Jn, Wq, None, C, anc, credit=CRED[nm], path=out, extra={'nb': len(R.joints)}); return
    elif nm == 'plant':
        z = triangles('user2/plant.glb'); T, Cc, Nn = z
        k = np.array([('Ground' not in n) and ('Cylinder_40' not in n) for n in Nn]); T, Cc = T[k], Cc[k]
        c, h = norm_tf(T); T = (T - c) / h
        V, F, FC, _ = simplify(T, Cc, 9000)
        VC = np.zeros((len(V), 3)); cnt = np.zeros(len(V))
        for kk in range(3): np.add.at(VC, F[:, kk], FC); np.add.at(cnt, F[:, kk], 1)
        VC = VC / np.maximum(cnt, 1)[:, None] * 1.25
        sk = Skel([('root', None, (0, 0, 0), None)]); Jn = np.zeros((len(V), 4), np.uint8); Wq = np.zeros((len(V), 4), np.uint8); Wq[:, 0] = 255
        export(nm, V, F, VC, Jn, Wq, sk, {'idle': {'d': 1, 'k': [(0, {}), (1, {})], 'loop': True}}, [], fps=1, credit=CRED[nm], path=out); return
    F = prune_bridges(F, W, sk)
    Jn, Wq = top4(W)
    export(nm, V, F, VC, Jn, Wq, sk, {k: C[k] for k in keep}, anc, credit=CRED[nm], path=out)

def _w4(J4, W4, nb):
    Wf = np.zeros((len(J4), nb))
    for k in range(4): np.add.at(Wf, (np.arange(len(J4)), J4[:, k]), W4[:, k])
    return Wf

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2])
