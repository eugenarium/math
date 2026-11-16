import json, math, sys, itertools
from fractions import Fraction as Fr
data = json.load(open(sys.argv[1]))
C={}
def reg(name):
    def d(fn): C[name]=fn; return fn
    return d
TQ={9:2.2622,15:2.1314,24:2.0639}
# probability
reg('pr.space.p1')(lambda s: 1-s['p'])
reg('pr.space.p2')(lambda s: s['a']+s['b']-s['c'])
reg('pr.space.p3')(lambda s: 1-(s['a']+s['b']-s['c']))
reg('pr.cond.p1')(lambda s: s['c']/s['b'])
reg('pr.cond.p2')(lambda s: s['c']/s['b'])
reg('pr.cond.p5')(lambda s: s['b']*s['q'])
reg('pr.indep.p1')(lambda s: s['a']*s['b'])
reg('pr.indep.p2')(lambda s: 1-(1-s['a'])*(1-s['b']))
reg('pr.indep.p5')(lambda s: s['c']/s['a'])
reg('pr.bayes.p1')(lambda s: (s['q1']+s['q2'])/2)
reg('pr.rv.p1')(lambda s: 1-s['a']-s['b'])
reg('pr.rv.p2')(lambda s: s['a']+s['b'])
reg('pr.rv.p3')(lambda s: s['b']+(1-s['a']-s['b']))
reg('pr.exp.p2')(lambda s: s['a']*s['m']+s['b'])
reg('pr.var.p1')(lambda s: s['a']**2*s['s'])
reg('pr.var.p2')(lambda s: s['v1']+s['v2'])
reg('pr.var.p3')(lambda s: s['a']**2*s['v1']+s['b']**2*s['v2'])
reg('pr.discr.p1')(lambda s: s['n']*s['p'])
reg('pr.cont.p1')(lambda s: 1/s['L'])
reg('pr.cont.p3')(lambda s: s['b']**s['k']-s['a']**s['k'])
reg('pr.cdistr.p1')(lambda s: s['a']+s['d']/2)
reg('pr.norm.p1')(lambda s: (s['xv']-s['mu'])/s['s'])
reg('pr.norm.p3')(lambda s: 1-s['p'])
reg('pr.norm.p5')(lambda s: (1-s['c'])/2)
reg('pr.joint.p1')(lambda s: s['a']+s['b'])
reg('pr.joint.p2')(lambda s: s['a']+s['c'])
reg('pr.joint.p5')(lambda s: s['a']-(s['a']+s['b'])*(s['a']+s['c']))
reg('pr.cov.p1')(lambda s: s['e']-s['m1']*s['m2'])
reg('pr.cov.p2')(lambda s: s['cv']/(s['sx']*s['sy']))
reg('pr.cov.p3')(lambda s: s['v1']+s['v2']+2*s['cv'])
reg('pr.ineq.p1')(lambda s: s['m']/s['a'])
reg('pr.ineq.p2')(lambda s: s['s2']/s['t']**2)
reg('pr.ineq.p3')(lambda s: 1-1/s['k']**2)
reg('pr.ineq.p5')(lambda s: 1/s['k'])
reg('pr.lln.p1')(lambda s: s['m'])
reg('pr.lln.p2')(lambda s: s['s2']/s['n'])
reg('pr.lln.p3')(lambda s: s['s2']/(s['n']*s['e']**2))
reg('pr.clt.p1')(lambda s: s['s']/math.sqrt(s['n']))
reg('pr.clt.p2')(lambda s: 2*s['s']/math.sqrt(s['n']))
reg('pr.clt.p3')(lambda s: math.sqrt(s['n']*s['s']**2))
# statistics
def median(v): v=sorted(v); n=len(v); return (v[n//2] if n%2 else (v[n//2-1]+v[n//2])/2)
reg('st.descr.p2')(lambda s: median([s['a'],s['a']+s['g1'],s['a']+s['g1']+s['g2'],s['a']+s['g1']+s['g2']+s['g3']]))
def samp_var(v): m=sum(v)/len(v); return sum((x-m)**2 for x in v)/(len(v)-1)
reg('st.descr.p5')(lambda s: samp_var([s['m']-s['d'],s['m'],s['m']+s['d']]))
reg('st.est.p2')(lambda s: s['b']**2+s['vr'])
reg('st.est.p3')(lambda s: (s['c']-1)*s['t'])
reg('st.mle.p1')(lambda s: s['k']/s['n'])
reg('st.mle.p2')(lambda s: 1/s['m'])
reg('st.mle.p3')(lambda s: s['p']**s['k']*(1-s['p'])**(s['n']-s['k']))
reg('st.power.p1')(lambda s: 1-s['b'])
reg('st.power.p2')(lambda s: (2*s['s']/s['E'])**2)
reg('st.power.p3')(lambda s: s['d']/s['s'])
reg('st.samp.p2')(lambda s: s['s']/math.sqrt(s['n']))
reg('st.samp.p3')(lambda s: s['k']**2)
reg('st.t.p1')(lambda s: s['n']-1)
reg('st.t.p2')(lambda s: TQ[s['n']-1]*s['s']/math.sqrt(s['n']))
reg('st.t.p3')(lambda s: 2*TQ[s['n']-1]*s['s']/math.sqrt(s['n']))
reg('st.test.p1')(lambda s: 100*s['al'])
reg('st.test.p3')(lambda s: 2*s['q'])
reg('st.two.p1')(lambda s: s['a']-s['b'])
reg('st.two.p2')(lambda s: math.sqrt(s['s1']**2/s['n1']+s['s2']**2/s['n2']))
reg('st.two.p3')(lambda s: s['sd']/math.sqrt(s['n']))
reg('st.zt.p1')(lambda s: s['d']/s['se'])
reg('st.zt.p2')(lambda s: s['d']/(s['s']/math.sqrt(s['n'])))
reg('st.zt.p5')(lambda s: s['mu0']+1.96*s['s']/math.sqrt(s['n']))
reg('st.chi.p1')(lambda s: s['n']*s['p'])
reg('st.chi.p3')(lambda s: s['k']-1)
reg('st.reg.p1')(lambda s: s['r']*s['sy']/s['sx'])
reg('st.reg.p3')(lambda s: s['a']+s['b']*s['xv'])
# linear algebra leftovers
reg('la.vec.p1')(lambda s: s['k']*(s['u'][0]+s['u'][1]))
reg('la.sys.p1')(lambda s: s['x0'])
reg('la.sys.p5')(lambda s: 2)
reg('la.mat.p1')(lambda s: s['k']*s['A'][0][1])
reg('la.map.p1')(lambda s: s['A'][1][1])
reg('la.map.p4')(lambda s: s['r'])
reg('la.inv.p1')(lambda s: 1/s['a'])
reg('la.orth.p1')(lambda s: -s['a'])
reg('la.proj.p1')(lambda s: s['k'])
reg('la.rank.p2')(lambda s: 1)
reg('la.rank.p3')(lambda s: 2)
reg('la.rank.p5')(lambda s: 3-2)
reg('la.space.p1')(lambda s: s['n']-1)
reg('la.sym.p5')(lambda s: s['a']-s['b'])
reg('la.basis.p1')(lambda s: s['n'])
reg('la.basis.p3')(lambda s: s['m']*s['p'])
reg('la.basis.p5')(lambda s: (s['m']+s['n'])/2)
reg('la.diag.p1')(lambda s: s['l']**s['n'])
reg('la.diag.p5')(lambda s: 1)

def sv2(A):
    # сингулярные числа матрицы 2x2: корни из собственных значений A^T A (формула для 2x2)
    (a,b),(c,d)=A
    m=[[a*a+c*c, a*b+c*d],[a*b+c*d, b*b+d*d]]
    t=m[0][0]+m[1][1]; dt=m[0][0]*m[1][1]-m[0][1]**2
    disc=math.sqrt(max(0,t*t/4-dt))
    return [math.sqrt(max(0,t/2+disc)), math.sqrt(max(0,t/2-disc))]
def cross(u,v): return [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
def det3(M):
    return (M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]))
import cmath
def eig2(A):
    (a,b),(c,d)=A
    t=a+d; dt=a*d-b*c
    r=cmath.sqrt(t*t/4-dt)
    return [t/2+r, t/2-r]
reg('la.quad.p1')(lambda s: s['k']/2)
reg('la.quad.p2')(lambda s: s['x0']*(s['a']*s['x0']+s['b']*s['y0'])+s['y0']*(s['b']*s['x0']+s['c']*s['y0']))
reg('la.quad.p4')(lambda s: sum(1 for t in range(-20,21) if 1>0 and 1*s['m']**2-t*t>0))
reg('la.svd.p1')(lambda s: max(sv2([[-s['s'],0],[0,s['t']]])))
reg('la.svd.p2')(lambda s: max(sv2([[3*s['t'],4*s['t']],[-4*s['t'],3*s['t']]])))
reg('la.svd.p3')(lambda s: sum(1 for x in [1]*s['r']+[0]*(4-s['r']) if x>0))
reg('la.svd.p4')(lambda s: s['p']**2+s['q']**2)
reg('la.norm.p1')(lambda s: sum(abs(x) for x in (s['a'],s['b'])))
reg('la.norm.p2')(lambda s: max(abs(s['a']),abs(s['b'])))
reg('la.norm.p3')(lambda s: math.hypot(3*s['t'],4*s['t']))
reg('la.norm.p4')(lambda s: (lambda sv: max(sv)/min(sv))(sv2([[s['k']*s['m'],0],[0,s['m']]])))
reg('la.cross.p1')(lambda s: cross([s['a1'],s['a2'],0],[s['b1'],s['b2'],0])[2])
reg('la.cross.p2')(lambda s: abs(cross([s['a1'],s['a2'],0],[s['b1'],s['b2'],0])[2]))
reg('la.cross.p3')(lambda s: abs(det3([[s['a'],0,0],[s['b'],s['c'],0],[s['d'],s['e'],s['f']]])))
reg('la.cplx.p1')(lambda s: abs(eig2([[3*s['t'],-4*s['t']],[4*s['t'],3*s['t']]])[0]))
reg('la.cplx.p2')(lambda s: eig2([[s['a'],-s['b']],[s['b'],s['a']]])[0].real)
reg('la.cplx.p3')(lambda s: eig2([[s['u'],-s['s']**2],[1,s['u']]])[0].imag)
reg('la.jord.p1')(lambda s: 2-1)
reg('la.jord.p2')(lambda s: s['n'])
reg('la.jord.p3')(lambda s: 3-s['r'])

bad=0; checked=0; per={}
for r in data:
    key=f"{r['id']}.{r['pid']}"
    if key not in C: continue
    try: exp=C[key](r['scope'])
    except Exception as e:
        print('CHECKER-ERR', key, r['seed'], repr(e)); bad+=1; continue
    got=r['a']
    if isinstance(got,list): continue
    checked+=1; per[key]=per.get(key,0)+1
    tol=3e-3*max(1,abs(float(exp)))
    if abs(float(exp)-float(got))>tol:
        bad+=1
        if bad<=25: print('MISMATCH', key, 'seed',r['seed'], 'engine',got,'indep',float(exp),'|',r['q'][:110])
print('checked', checked, 'problem types', len(per), 'mismatches', bad)

sys.exit(1 if bad else 0)
