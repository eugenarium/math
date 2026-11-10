import yaml, re, itertools, math
from fractions import Fraction as F
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
import os
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')+'/'
ls=yaml.safe_load(open(R+'schema/lesson.schema')); ps=yaml.safe_load(open(R+'schema/problem.schema'))
reg=Registry().with_resources([('lesson.schema',Resource.from_contents(ls)),('problem.schema',Resource.from_contents(ps))])
def val(schema,obj,name):
    errs=list(Draft202012Validator(schema,registry=reg).iter_errors(obj))
    print(name,'OK' if not errs else 'FAIL')
    for e in errs: print('  ',list(e.absolute_path),e.message[:160])
cards=yaml.safe_load(open(R+'content/cards/samples.yml')); val({'$ref':'lesson.schema#/$defs/cards'},cards,'cards')
G=yaml.safe_load(open(R+'content/ref/glossary.yml')); E=yaml.safe_load(open(R+'content/ref/errors.yml'))
W=set(re.findall(r'^### (\w+)',open(R+'docs/WIDGETS.md').read(),re.M))
for f in ['c1/c1.riem','c1/c1.der','la/la.eig','st/st.ci']:
    raw=open(R+f'content/lessons/{f}.yml').read()
    assert not re.search(r'"[^"\n]*\\[^"\n]*"',raw)
    L=yaml.safe_load(raw); val({'$ref':'lesson.schema'},L,f); c=cards[L['id']]
    def walk(o):
        if isinstance(o,dict):
            if 'g' in o and len(o)==1: assert o['g'] in G,o
            if 'w' in o and isinstance(o['w'],str): assert o['w'] in W and o['w'] in c['w'],o; used.add(o['w'])
            if 'x' in o and isinstance(o['x'],str): assert 'sol' in L['pr'][o['x']],o
            for k,v in o.items():
                if k=='e' and isinstance(v,dict): [diag.add(i) for i in v]
                if k=='e' and isinstance(v,str): diag.add(v)
                walk(v)
        elif isinstance(o,list): [walk(i) for i in o]
    used=set();diag=set();walk(L)
    for i in L['err']+list(diag): assert i in E,i
    assert set(c['e'])<=set(L['err']) and set(c['e'])<=diag,(c['e'],diag)
    assert set(c['w'])==used,(c['w'],used)
    ks={p['k'] for p in L['pr'].values()}; assert set(c['k'])<=ks, ks
    assert len(L['pr'])==c.get('n',5)
    for pid,p in L['pr'].items():
        if p['k'] in('num','expr') and 'fast' not in p: assert 'sol' in p,pid
    print('  widgets',sorted(used),'types',sorted(ks),'chars',len(raw))
# la generators
U=[(a,b,c,d) for a,b,c,d in itertools.product(range(-1,3),repeat=4) if abs(a*d-b*c)==1]
def A(P,l1,l2):
    a,b,c,d=P;det=a*d-b*c
    inv=(F(d,det),F(-b,det),F(-c,det),F(a,det))
    M=(a*l1,b*l2,c*l1,d*l2)
    return (M[0]*inv[0]+M[1]*inv[2],M[0]*inv[1]+M[1]*inv[3],M[2]*inv[0]+M[3]*inv[2],M[2]*inv[1]+M[3]*inv[3])
def rate(l1s,l2s,cond):
    tot=ok=0
    for P in U:
        for l1 in l1s:
            for l2 in l2s:
                M=A(P,l1,l2); assert all(x.denominator==1 for x in M)
                assert M[0]*P[0]+M[1]*P[2]==l1*P[0] and M[2]*P[0]+M[3]*P[2]==l1*P[2]
                tot+=1
                if cond(M,P): ok+=1; assert P[0]!=0 or M[1]==0
    return ok/tot
print('umat count',len(U))
print('p1',rate([-2,2,3,4],[-1,1,5],lambda M,P:max(map(abs,M))<=9))
print('p2/p3',rate([-2,2,3],[-1,1,4],lambda M,P:max(map(abs,M))<=9))
print('p4',rate([-2,2,3],[-1,1,4],lambda M,P:max(map(abs,M))<=9 and M[1]!=0))
print('p7',rate([2,3],[-1,1],lambda M,P:max(map(abs,M))<=6))
# riemann numerics
def rs(f,a,b,n,rule):
    h=(b-a)/n
    if rule=='l': return h*sum(f(a+i*h) for i in range(n))
    if rule=='r': return h*sum(f(a+(i+1)*h) for i in range(n))
    if rule=='m': return h*sum(f(a+(i+.5)*h) for i in range(n))
    if rule=='t': return (rs(f,a,b,n,'l')+rs(f,a,b,n,'r'))/2
g=lambda x:4/(1+x*x)
for n in [2,3,4,5,6]: print(n,round(rs(g,0,1,n,'m'),4),round(rs(g,0,1,n,'t'),4),round(rs(g,0,1,n,'l'),4))
print('left n for |err|<0.005', next(n for n in range(1,2000) if abs(rs(g,0,1,n,'l')-math.pi)<0.005))
for b in [1,2]:
    ex=b**3/3; sq=lambda x:x*x
    print('b',b,'mid min n',next(n for n in range(1,61) if abs(rs(sq,0,b,n,'m')-ex)<0.002), 'best l/r at 30', min(abs(rs(sq,0,b,30,r)-ex) for r in 'lr'))
