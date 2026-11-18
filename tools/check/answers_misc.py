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

def poly_mul(p,q):
    r=[0]*(len(p)+len(q)-1)
    for i,a in enumerate(p):
        for j,b in enumerate(q): r[i+j]+=a*b
    return r
def quad(f,a,b,n=20000):
    h=(b-a)/n
    return h*(f(a)/2+f(b)/2+sum(f(a+i*h) for i in range(1,n)))
def pois_pmf(k,l): return math.exp(-l+k*math.log(l)-math.lgamma(k+1))
def mat_pow2(P): return [[sum(P[i][k]*P[k][j] for k in range(2)) for j in range(2)] for i in range(2)]
def stationary(P):
    v=[0.5,0.5]
    for _ in range(5000): v=[v[0]*P[0][0]+v[1]*P[1][0], v[0]*P[0][1]+v[1]*P[1][1]]
    return v
def mixture_var(groups):
    # группы: (вес, [(значение, вероятность внутри группы)])
    pts=[(w*pr, x) for w,vals in groups for x,pr in vals]
    m=sum(p*x for p,x in pts)
    return sum(p*(x-m)**2 for p,x in pts)
reg('pr.jointc.p1')(lambda s: 1/(s['a']*s['b']))
reg('pr.jointc.p2')(lambda s: (s['c']*s['d'])/(s['a']*s['b']))
reg('pr.jointc.p3')(lambda s: quad(lambda x: s['a']-x, 0, s['c'])/(s['a']**2/2))
reg('pr.trans.p1')(lambda s: sum(1 for x in range(-s['k'],s['k']+1) if x*x==1)/(2*s['k']+1))
reg('pr.trans.p2')(lambda s: sum(1 for a in range(1,7) for b in range(1,7) if a+b==s['s'])/36)
reg('pr.trans.p3')(lambda s: 1/(s['a']*s['c']))
reg('pr.trans.p4')(lambda s: math.sqrt((3*s['t'])**2+(4*s['t'])**2))
reg('pr.condexp.p1')(lambda s: sum(w*m for w,m in [(s['p'],s['m1']),(1-s['p'],s['m2'])]))
reg('pr.condexp.p2')(lambda s: (1*s['a']+2*s['b'])/(s['a']+s['b']))
reg('pr.condexp.p3')(lambda s: mixture_var([(0.5,[(s['m1']-math.sqrt(s['v1']),0.5),(s['m1']+math.sqrt(s['v1']),0.5)]),(0.5,[(s['m2']-math.sqrt(s['v2']),0.5),(s['m2']+math.sqrt(s['v2']),0.5)])]))
reg('pr.mgf.p1')(lambda s: (1-s['p'])+s['p']*math.exp(0))
reg('pr.mgf.p2')(lambda s: (lambda M: (M(1e-5)-M(-1e-5))/2e-5)(lambda t: s['a']+s['b']*math.exp(t)+(1-s['a']-s['b'])*math.exp(2*t)))
reg('pr.mgf.p3')(lambda s: poly_mul([1-s['p'],s['p']],[1-s['p'],s['p']])[1])
reg('pr.mvn.p1')(lambda s: s['c']/math.sqrt(4*16))
reg('pr.mvn.p2')(lambda s: sum(u*v*S for (u,row) in zip([1,1],[[s['sx2'],s['c']],[s['c'],s['sy2']]]) for v,S in zip([1,1],row)))
reg('pr.mvn.p3')(lambda s: sum(u*v*S for (u,row) in zip([s['k'],-1],[[s['sx2'],s['c']],[s['c'],s['sy2']]]) for v,S in zip([s['k'],-1],row)))
reg('pr.markov.p1')(lambda s: mat_pow2([[1-s['a'],s['a']],[s['b'],1-s['b']]])[0][0])
reg('pr.markov.p2')(lambda s: stationary([[1-s['a'],s['a']],[s['b'],1-s['b']]])[0])
reg('pr.markov.p3')(lambda s: sum(n*(1-s['a'])**(n-1)*s['a'] for n in range(1,3000)))
reg('pr.pois.p1')(lambda s: sum(k*pois_pmf(k,s['lam']*s['t']) for k in range(0,200)))
reg('pr.pois.p2')(lambda s: quad(lambda t: math.exp(-s['lam']*t), 0, 40/s['lam']))
reg('pr.pois.p3')(lambda s: 1-sum(pois_pmf(k,s['lam']*s['t']) for k in range(1,200)))

def beta_mean(al,be,n=200000):
    h=1/n
    num=den=0.0
    for i in range(1,n):
        x=i*h
        w=x**(al-1)*(1-x)**(be-1)
        num+=x*w; den+=w
    return num/den
reg('st.mom.p1')(lambda s: 1/s['xb'])
reg('st.mom.p2')(lambda s: 2*s['xb'])
reg('st.mom.p3')(lambda s: s['xb']/s['n'])
reg('st.mom.p4')(lambda s: (s['xb']**2+s['d'])-s['xb']**2)
reg('st.mreg.p1')(lambda s: s['b0']+s['b1']*s['x1']+s['b2']*s['x2'])
reg('st.mreg.p2')(lambda s: s['b1']*s['d1']+s['b2']*s['d2'])
def ls_slope(xs,ys):
    mx=sum(xs)/len(xs); my=sum(ys)/len(ys)
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/sum((x-mx)**2 for x in xs)
reg('st.mreg.p3')(lambda s: ls_slope([-1,0,1],[s['y1'],s['y2'],s['y1']+2*s['k']]))
reg('st.diag.p1')(lambda s: s['y0']-(s['a']+s['b']*s['x0']))
reg('st.diag.p2')(lambda s: 1/(1-s['r2']))
reg('st.diag.p3')(lambda s: s['e']/s['s'])
reg('st.anova.p1')(lambda s: s['k']*s['n']-s['k'])
def ssb(means,n):
    g=sum(means)/len(means)
    return sum(n*(m-g)**2 for m in means)
reg('st.anova.p2')(lambda s: ssb([s['gm']-s['d'],s['gm'],s['gm']+s['d']],s['n']))
reg('st.anova.p3')(lambda s: (s['ssb']/(3-1))/(s['ssw']/(18-3)))
reg('st.logit.p1')(lambda s: s['p']/(1-s['p']))
reg('st.logit.p2')(lambda s: 1/(1+math.exp(-math.log(s['o']))))
reg('st.logit.p3')(lambda s: math.exp(s['dx']*math.log(s['r'])))
reg('st.boot.p1')(lambda s: sum(1 for _ in itertools.product(range(s['n']),repeat=s['n'])))
reg('st.boot.p2')(lambda s: sum(1 for _ in itertools.combinations(range(s['a']+s['b']),s['a'])))
reg('st.boot.p3')(lambda s: s['r']/sum(1 for _ in itertools.combinations(range(6),3)))
reg('st.nonpar.p1')(lambda s: sum(range(1,s['N']+1)))
reg('st.nonpar.p2')(lambda s: (s['t']+(s['t']+1))/2)
reg('st.nonpar.p3')(lambda s: (s['n1']*(s['n1']+1)//2+s['ex'])-sum(range(1,s['n1']+1)))
reg('st.mult.p1')(lambda s: 1-(1-0.05)**s['m'])
reg('st.mult.p2')(lambda s: 0.05/s['m'])
reg('st.mult.p3')(lambda s: next(m for m in range(1,500) if 1-(1-s['al'])**m>0.5))
reg('st.ab.p1')(lambda s: (s['a0']+s['d']-s['a0'])/s['a0']*100)
reg('st.ab.p2')(lambda s: 16*s['s']**2/s['d']**2)
reg('st.ab.p3')(lambda s: 1-math.prod(1-0.05 for _ in range(s['k'])))
reg('st.bayes.p1')(lambda s: beta_mean(s['a']+s['k'], s['b']+10-s['k']))
reg('st.bayes.p2')(lambda s: s['b']+(10-s['k']))
reg('st.bayes.p3')(lambda s: ((s['a'])/(s['a']+s['b']+s['n']))*(s['a']+s['b'])/s['a'])
reg('st.theory.p1')(lambda s: s['p']*(1/s['p'])**2+(1-s['p'])*(1/(1-s['p']))**2)
reg('st.theory.p2')(lambda s: 1/(s['n']*(1/s['p']+1/(1-s['p']))))
reg('st.theory.p3')(lambda s: (s['b'])/(s['b']*s['f']))

import cmath
def taylor_coef(f,n,r=0.5,M=4096):
    # коэффициент Тейлора в нуле: интеграл Коши по окружности радиуса r
    tot=0
    for j in range(M):
        th=2*math.pi*j/M
        z=r*cmath.exp(1j*th)
        tot+=f(z)*cmath.exp(-1j*n*th)
    return (tot/M/(r**n)).real
def fint(f,a,b,n=20000):
    h=(b-a)/n
    return h*(f(a)/2+f(b)/2+sum(f(a+i*h) for i in range(1,n)))
reg('sr.num.p1')(lambda s: sum((1/s['k'])**n for n in range(0,200)))
reg('sr.num.p2')(lambda s: sum(1/(n*(n+1)) for n in range(1,s['N']+1)))
reg('sr.num.p3')(lambda s: sum(s['a']*(1/s['k'])**(n-1) for n in range(1,300)))
reg('sr.tests.p1')(lambda s: ((51*(s['p']/s['q'])**51)/(50*(s['p']/s['q'])**50))*(50/51))
reg('sr.tests.p2')(lambda s: next(p for p in range(1,10) if sum(1/n**p for n in range(1,20000))-sum(1/n**p for n in range(1,10000))<0.01 and p>1))
reg('sr.tests.p3')(lambda s: s['k']/(10**9+1))
reg('sr.alt.p1')(lambda s: 1/(s['N']+1))
reg('sr.alt.p2')(lambda s: next(N for N in range(1,500) if 1/(N+1)<s['eps']))
reg('sr.alt.p3')(lambda s: sum(abs((-1/s['k'])**n) for n in range(0,300)))
reg('sr.pow.p1')(lambda s: (lambda a: a(200)/a(201))(lambda n: 1/s['k']**n))
reg('sr.pow.p2')(lambda s: s['c']+((lambda a: a(200)/a(201))(lambda n: 1/s['k']**n)))
reg('sr.pow.p3')(lambda s: 1/math.sqrt(s['k']))
reg('sr.tay.p1')(lambda s: taylor_coef(lambda z: cmath.sin(s['k']*z),3))
reg('sr.tay.p2')(lambda s: taylor_coef(lambda z: cmath.exp(s['k']*z),4))
reg('sr.tay.p3')(lambda s: sum((-1)**(n+1)*s['t']**n/n for n in range(1,4)))
reg('sr.unif.p1')(lambda s: max((i/1000*s['a'])**s['n'] for i in range(0,1001)))
reg('sr.unif.p2')(lambda s: 1/s['k']**2)
reg('sr.unif.p3')(lambda s: s['L']/s['eps'])
reg('sr.four.p1')(lambda s: fint(lambda x: x*math.sin(s['n']*x),-math.pi,math.pi)/math.pi)
reg('sr.four.p2')(lambda s: fint(lambda x: s['c'],-math.pi,math.pi)/math.pi)
reg('sr.four.p3')(lambda s: (fint(lambda x: -math.sin(s['n']*x),-math.pi,0)+fint(lambda x: math.sin(s['n']*x),0,math.pi))/math.pi)

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
