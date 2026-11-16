import json, math, itertools, sys
from fractions import Fraction as Fr
from math import comb, factorial
data = json.load(open(sys.argv[1]))

def mat(M): return [[Fr(x) for x in r] for r in M]
def det2(M): return M[0][0]*M[1][1]-M[0][1]*M[1][0]
def mul(A,B): return [[sum(A[i][k]*B[k][j] for k in range(len(B))) for j in range(len(B[0]))] for i in range(len(A))]
def inv2(M):
    d=det2(M); return [[M[1][1]/d,-M[0][1]/d],[-M[1][0]/d,M[0][0]/d]]
def count_assign(n, pred):
    return sum(1 for bits in itertools.product([0,1], repeat=n) if pred(bits))

def dice_sum(s): return sum(1 for a in range(1,7) for b in range(1,7) if a+b==s)/36
def poly_coef(a,n,k):
    # (1+a x)^n by repeated multiplication
    p=[1]
    for _ in range(n):
        q=[0]*(len(p)+1)
        for i,c in enumerate(p):
            q[i]+=c; q[i+1]+=c*a
        p=q
    return p[k]

def rec_seq(first, f, n):
    seq=list(first)
    while len(seq)<n: seq.append(f(seq))
    return seq

C={}
def reg(name):
    def d(fn): C[name]=fn; return fn
    return d

reg('lg.prop.p1')(lambda s: 2**s['n'])
reg('lg.prop.p2')(lambda s: count_assign(s['n'], lambda b: b[0] or b[1]))
reg('lg.prop.p3')(lambda s: count_assign(s['n'], lambda b: (b[0] or b[1]) and b[2]))
reg('lg.impl.p1')(lambda s: count_assign(s['n'], lambda b: (not b[0]) or b[1]))
reg('lg.impl.p4')(lambda s: sum(1 for x in range(1,6*s['k']+1) if x%3==0 and x%2==1))
reg('lg.equiv.p1')(lambda s: count_assign(s['n'], lambda b: not (b[0] and b[1])))
reg('lg.equiv.p4')(lambda s: count_assign(s['n'], lambda b: not ((not (b[0] or b[1])) or b[2])))
reg('lg.proof.p1')(lambda s: sum(range(1,s['n']+1)))
reg('lg.proof.p4')(lambda s: sum(range(1,s['k']+2)))
reg('lg.nf.p1')(lambda s: len({tuple(f) for f in itertools.product([0,1], repeat=2**s['n'])}))
reg('lg.nf.p2')(lambda s: s['k'])
reg('lg.nf.p4')(lambda s: count_assign(s['n'], lambda b: sum(b)%2==1))
reg('lg.deduct.p4')(lambda s: len([(i,i+1) for i in range(1,s['n'])]))
reg('lg.fol.p2')(lambda s: sum(1 for x in range(1,s['N']+1) if x%s['k']==0))
reg('lg.fol.p3')(lambda s: sum(1 for x in range(1,s['N']+1) for y in range(1,s['N']+1) if x<y))
reg('lg.quant.p1')(lambda s: sum(1 for x in range(1,s['m']*s['k']+1) if x%s['m']==0))
reg('lg.quant.p4')(lambda s: sum(1 for x in range(1,s['m']+s['k']+1) if not x<=s['m']))
reg('dm.count.p1')(lambda s: s['a']*s['b'])
reg('dm.count.p2')(lambda s: len(list(itertools.product(range(s['a']),range(s['b']))))+s['c'])
reg('dm.count.p3')(lambda s: s['a']+s['b']+s['c'])
reg('dm.count.p5')(lambda s: len(list(itertools.product(range(10),repeat=s['k']))))
reg('dm.perm.p1')(lambda s: len(list(itertools.permutations(range(s['n'])))))
reg('dm.perm.p2')(lambda s: len(list(itertools.combinations(range(s['n']),s['k']))))
reg('dm.perm.p3')(lambda s: len(set(itertools.permutations(['r']*s['k']+list(range(s['n']-s['k']))))))
reg('dm.perm.p5')(lambda s: len(list(itertools.combinations(range(s['n']),2))))
reg('dm.binom.p1')(lambda s: sum(poly_coef(1,s['n'],k) for k in range(s['n']+1)))
reg('dm.binom.p2')(lambda s: poly_coef(1,s['n'],s['k']))
reg('dm.binom.p3')(lambda s: poly_coef(s['a'],s['n'],s['k']))
reg('dm.binom.p5')(lambda s: poly_coef(1,s['n']+1,s['k']+1))
reg('dm.stars.p1')(lambda s: len(list(itertools.product(range(s['n']),repeat=s['k']))))
reg('dm.stars.p2')(lambda s: len(list(itertools.combinations_with_replacement(range(s['n']),s['k']))))
reg('dm.stars.p3')(lambda s: sum(1 for t in itertools.product(range(s['k']+1),repeat=s['n']) if sum(t)==s['k']))
reg('dm.incl.p1')(lambda s: s['a']+s['b']-s['c'])
reg('dm.incl.p2')(lambda s: s['N']-len(set(range(s['a']))|set(range(s['a']-s['c'],s['a']-s['c']+s['b']))))
reg('dm.incl.p5')(lambda s: sum(1 for x in range(1,6*s['k']+1) if x%2==0 or x%3==0))
reg('dm.rec.p1')(lambda s: rec_seq([s['a']], lambda q: 2*q[-1], 4)[-1])
reg('dm.rec.p2')(lambda s: rec_seq([s['p'],s['q']], lambda q: q[-1]+q[-2], 5)[-1])
reg('dm.rec.p3')(lambda s: rec_seq([s['c']], lambda q: 2*q[-1]+1, 4)[-1])
reg('dm.rec.p5')(lambda s: rec_seq([s['a']], lambda q: s['r']*q[-1], 6)[-1])
# probability
reg('pr.classic.p2')(lambda s: dice_sum(s['s']))
reg('pr.classic.p3')(lambda s: len(list(itertools.combinations(range(s['k']),2)))/len(list(itertools.combinations(range(s['n']),2))))
reg('pr.classic.p5')(lambda s: s['m']*s['n']/len(list(itertools.combinations(range(s['m']+s['n']),2))))
reg('pr.cond.p3')(lambda s: (s['r']-1)/(s['r']+s['w']-1))
reg('pr.discr.p2')(lambda s: sum(1 for bits in itertools.product([0,1],repeat=s['n']) if sum(bits)==s['k'] for _ in [0])*0 + comb(s['n'],s['k'])*s['p']**s['k']*(1-s['p'])**(s['n']-s['k']))
reg('pr.discr.p3')(lambda s: (1-s['p'])**(s['k']-1)*s['p'])
reg('pr.discr.p5')(lambda s: math.exp(-s['l']))
reg('pr.exp.p5')(lambda s: sum(range(1,7))/6*s['n'])
reg('pr.classic.p1')(lambda s: s['m']/10)
reg('pr.indep.p3')(lambda s: 1-0.5**s['n'])
reg('pr.cdistr.p2')(lambda s: 1-math.exp(-s['l']*s['t']))
reg('pr.cdistr.p3')(lambda s: 1/s['l'])
reg('pr.cdistr.p5')(lambda s: math.exp(-s['l']*s['t']))
reg('pr.bayes.p2')(lambda s: s['p1']*s['q1']+(1-s['p1'])*s['q2'])
reg('pr.bayes.p3')(lambda s: s['pv']*s['s']/(s['pv']*s['s']+(1-s['pv'])*s['f']))
reg('pr.bayes.p5')(lambda s: s['p1']*s['q1']/(s['p1']*s['q1']+(1-s['p1'])*s['q2']))
reg('pr.exp.p1')(lambda s: 1*s['p1']+2*(1-s['p1']-s['p3'])+3*s['p3'])
reg('pr.exp.p3')(lambda s: 1*s['p1']+4*(1-s['p1']-s['p3'])+9*s['p3'])
def var_table(s):
    a,b=s['a'],s['b']; ps=[a,b,1-a-b]; vals=[0,1,2]
    m=sum(v*p for v,p in zip(vals,ps)); return sum((v-m)**2*p for v,p in zip(vals,ps))
reg('pr.var.p4')(var_table)
reg('pr.norm.p2')(lambda s: (s['xv']-s['mu'])/math.sqrt(s['d']))
reg('pr.cont.p2')(lambda s: s['b']**2-s['a']**2)
reg('pr.joint.p3')(lambda s: s['a']/(s['a']+s['b']))
# linear algebra
reg('la.vec.p2')(lambda s: s['a']*s['u'][0]+s['b']*s['v'][0])
def la_vec_p3(s):
    u,v,w=s['u'],s['v'],s['w']
    D=Fr(u[0]*v[1]-u[1]*v[0]); return (Fr(w[0])*v[1]-Fr(w[1])*v[0])/D
reg('la.vec.p3')(la_vec_p3)
reg('la.dot.p1')(lambda s: sum(x*y for x,y in zip(s['u'],s['v'])))
reg('la.dot.p2')(lambda s: sum(x*y for x,y in zip(s['u'],s['v']))/(math.hypot(*s['u'])*math.hypot(*s['v'])))
reg('la.dot.p3')(lambda s: sum(x*y for x,y in zip(s['u'],s['v']))/sum(y*y for y in s['v']))
def la_sys_p2(s):
    M=s['M']; r1,r2=s['r1'],s['r2']
    # brute force integer solution search
    for x in range(-10,11):
        for y in range(-10,11):
            if M[0][0]*x+M[0][1]*y==r1 and M[1][0]*x+M[1][1]*y==r2: return y
reg('la.sys.p2')(la_sys_p2)
reg('la.mat.p2')(lambda s: mul(mat(s['A']),mat(s['B']))[0][0])
reg('la.mat.p5')(lambda s: s['m']*s['p'])
reg('la.map.p2')(lambda s: s['m']*s['p']+s['n']*s['r'])
reg('la.inv.p2')(lambda s: inv2(mat(s['A']))[0][0])
reg('la.inv.p3')(lambda s: inv2(mat(s['A']))[0][1])
reg('la.inv.p5')(lambda s: 1/s['d'])
reg('la.det.p1')(lambda s: det2(mat(s['A'])))
reg('la.det.p2')(lambda s: det2([[s['k']*x for x in r] for r in [[1,0],[0,s['d']]]]))
reg('la.det.p4')(lambda s: abs(det2(mat([s['u'],s['v']]))))
reg('la.det.p5')(lambda s: s['k']**3*s['d'])
reg('la.space.p4')(lambda s: s['n']-s['m']+1)
def la_cob_p2(s):
    P=mat(s['P']); x=[[Fr(s['m'])],[Fr(s['n'])]]; return mul(inv2(P),x)[0][0]
reg('la.cob.p2')(la_cob_p2)
reg('la.cob.p1')(lambda s: mul(mat(s['P']),[[Fr(s['a'])],[Fr(s['b'])]])[0][0])
reg('la.cob.p5')(lambda s: s['m']-s['n'])
reg('la.diag.p2')(lambda s: s['l1']**s['n']+s['l2']**s['n'])
reg('la.diag.p3')(lambda s: s['l']**s['n'])
reg('la.orth.p2')(lambda s: sum(x*y for x,y in zip(s['u'],s['v']))/sum(x*x for x in s['u']))
reg('la.orth.p3')(lambda s: s['u'][0]/math.hypot(*s['u']))
reg('la.proj.p2')(lambda s: (s['y1']*1+s['y2']*2)/5)
reg('la.proj.p3')(lambda s: (s['b1']-s['b2'])/2)
reg('la.sym.p1')(lambda s: s['S'][0][0]+s['S'][1][1])
reg('la.sym.p2')(lambda s: max(s['a']+s['b'],s['a']-s['b']))
reg('la.rank.p1')(lambda s: s['n']-s['r'])
# statistics
reg('st.descr.p1')(lambda s: (s['a']+s['b']+s['c'])/3)
reg('st.descr.p3')(lambda s: (sum([s['m']-2,s['m']-1,s['m'],s['m']+1,s['m']+2+s['D']]))/5)
reg('st.est.p1')(lambda s: s['Q']/(s['n']-1))
reg('st.samp.p1')(lambda s: s['s']/math.sqrt(s['n']))
reg('st.chi.p2')(lambda s: ((s['n']/2+s['d']-s['n']/2)**2/(s['n']/2))+((s['n']/2-s['d']-s['n']/2)**2/(s['n']/2)))
reg('st.test.p2')(lambda s: s['d']/(s['s']/math.sqrt(s['n'])))
reg('st.reg.p2')(lambda s: s['ym']-s['b']*s['xm'])

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
    if abs(float(exp)-float(got))>1e-6*max(1,abs(float(exp))):
        bad+=1
        if bad<=25: print('MISMATCH', key, 'seed',r['seed'], 'engine',got,'indep',float(exp),'|',r['q'][:100])
print('checked', checked, 'problem types', len(per), 'mismatches', bad)

sys.exit(1 if bad else 0)
