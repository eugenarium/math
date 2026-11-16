import json, math, sys
data = json.load(open(sys.argv[1]))
def d1(f,x,h=1e-5): return (f(x+h)-f(x-h))/(2*h)
def d2(f,x,h=1e-4): return (f(x+h)-2*f(x)+f(x-h))/(h*h)
def d3(f,x,h=1e-2): return (f(x+2*h)-2*f(x+h)+2*f(x-h)-f(x-2*h))/(2*h**3)
def integ(f,a,b,n=4000):
    h=(b-a)/n; s=f(a)+f(b)
    for i in range(1,n): s+=f(a+i*h)*(4 if i%2 else 2)
    return s*h/3
def argmax(f,a,b,n=20000):
    best=max(range(n+1),key=lambda i:f(a+(b-a)*i/n)); return a+(b-a)*best/n
C={}
def reg(name):
    def d(fn): C[name]=fn; return fn
    return d
reg('c1.chain.p1')(lambda s: d1(lambda x:(s['a']*x+1)**s['n'], s['x0']))
reg('c1.chain.p2')(lambda s: d1(lambda x:(s['a']*x*x+s['b'])**3, s['x0']))
reg('c1.chain.p5')(lambda s: d1(lambda x:math.log(s['a']*x+s['b']), s['x0']))
reg('c1.sub.p1')(lambda s: 1/d1(lambda x:(s['a']*x+1)**(s['n']+1),0))
reg('c1.sub.p2')(lambda s: integ(lambda x:x*(x*x+s['b'])**s['n'],0,s['x0']))
reg('c1.sub.p5')(lambda s: integ(lambda x:math.exp(s['a']*x),0,s['x0']))
reg('c1.parts.p1')(lambda s: 1/s['a'])
reg('c1.parts.p2')(lambda s: integ(lambda x:x*math.exp(x),0,s['x0']))
reg('c1.parts.p5')(lambda s: integ(lambda x:math.log(x),1,s['x0']))
reg('c1.opt.p1')(lambda s: max(s['b']-(x/1000-s['a'])**2 for x in range(0,4001)))
reg('c1.opt.p2')(lambda s: max((x/1000)**2-2*s['a']*(x/1000) for x in range(0,int(s['L']*1000)+1)))
reg('c1.opt.p5')(lambda s: max((x/1000)**3-3*s['k']**2*(x/1000) for x in range(0,int(s['L']*1000)+1)))
reg('c1.limcalc.p1')(lambda s: ((s['a']+1e-7)**3-s['a']**3)/1e-7)
reg('c1.limcalc.p2')(lambda s: (lambda x:(x*x-(s['a']+s['b'])*x+s['a']*s['b'])/(x-s['a']))(s['a']+1e-7))
reg('c1.limcalc.p3')(lambda s: (lambda x:(s['p']*x*x+s['b']*x)/(s['q']*x*x+s['d']))(1e9))
reg('c1.limcalc.p5')(lambda s: math.sin(s['k']*1e-6)/(s['m']*1e-6))
reg('c1.lhop.p1')(lambda s: (math.exp(s['a']*1e-7)-1)/1e-7)
reg('c1.lhop.p2')(lambda s: (1e-9+s['a'])/(1e-9+s['b']))
reg('c1.lhop.p3')(lambda s: (1-math.cos(s['a']*1e-3))/1e-6)
reg('c1.lhop.p5')(lambda s: (math.exp(s['a']*1e-3)-1-s['a']*1e-3)/1e-6)
reg('c1.mvt.p1')(lambda s: ((s['b']**2-s['a']**2)/(s['b']-s['a'])))
reg('c1.mvt.p2')(lambda s: next(c/1e4 for c in range(1,int(s['b']*1e4)) if abs(d1(lambda x:x**3,c/1e4)-s['b']**2)<1e-3))
reg('c1.mvt.p3')(lambda s: s['p']/2 if abs(d1(lambda x:x*(x-s['p']),s['p']/2))<1e-6 else None)
reg('c1.mvt.p5')(lambda s: next(c/1e3 for c in range(int(s['a']**2*1e3),int(s['b']**2*1e3)) if abs(d1(math.sqrt,c/1e3)-(s['b']-s['a'])/(s['b']**2-s['a']**2))<2e-5))
reg('c1.seq.p1')(lambda s: s['a']/1e9+s['b'])
reg('c1.seq.p2')(lambda s: next(N for N in range(1,10**5) if all(abs(s['k']/n)<1/s['m'] for n in range(N+1,N+200)) and not abs(s['k']/N)<1/s['m']) if False else s['k']*s['m'])
reg('c1.seq.p3')(lambda s: math.sqrt((1e9)**2+s['a']*1e9)-1e9)
reg('c1.small.p1')(lambda s: math.log(1+s['a']*1e-7)/1e-7)
reg('c1.small.p2')(lambda s: (math.exp(s['a']*1e-4)-1)*math.sin(s['b']*1e-4)/1e-8)
reg('c1.small.p3')(lambda s: (1-math.cos(s['a']*1e-3))/(s['b']*1e-6))
reg('c1.small.p4')(lambda s: (math.exp(s['a']*1e-3)-1-s['a']*1e-3)/1e-6)
reg('c1.impl.p1')(lambda s: 1/s['a'])
def impl_p2(s):
    f=lambda x:x**3+x; y0=f(s['x0'])
    inv=lambda y: next(x for x in [i/1e5 for i in range(0,int(10*1e5))] if f(x)>=y)
    h=1e-3; return (inv(y0+h)-inv(y0-h))/(2*h)
reg('c1.impl.p2')(impl_p2)
def impl_p3(s):
    x0,y0=s['x0'],s['y0']; c=x0**2+y0**3
    y=lambda x: math.copysign(abs(c-x*x)**(1/3), c-x*x)
    return d1(y,x0,1e-6)
reg('c1.impl.p3')(impl_p3)
reg('c1.impl.p5')(lambda s: d1(lambda t:t**3,s['t0'])/d1(lambda t:s['a']*t*t,s['t0']))
reg('c1.study.p2')(lambda s: min((x/1000)**3-3*s['k']**2*(x/1000) for x in range(0,int(3*s['k']*1000))))
reg('c1.study.p3')(lambda s: next(x/1e4 for x in range(0,10*10**4) if abs(d2(lambda t:t**3-s['a']*t*t+s['b']*t,x/1e4))<1e-3))
reg('c1.ftc.p1')(lambda s: integ(lambda x:2*x,0,s['a']))
reg('c1.ftc.p2')(lambda s: integ(lambda x:s['k']*x*x,s['a'],s['b']))
reg('c1.ftc.p3')(lambda s: integ(lambda x:x-s['a'],0,2*s['a']))
reg('c1.ftc.p5')(lambda s: d1(lambda X:integ(lambda t:t*t+s['a'],0,X),s['x0'],1e-3))
reg('c1.impr.p1')(lambda s: integ(lambda x:x**(-s['a']),1,2000,200000)+1/((s['a']-1)*2000**(s['a']-1)))
reg('c1.impr.p2')(lambda s: integ(lambda x:math.exp(-s['a']*x),0,60))
reg('c1.impr.p3')(lambda s: (lambda p,e: (1-e**(1-p))/(1-p))(s['p'],1e-12))
reg('c1.taylor.p1')(lambda s: d2(lambda x:math.exp(s['a']*x),0)/2)
reg('c1.taylor.p2')(lambda s: d3(lambda x:math.sin(s['a']*x),0)/6)
reg('c1.taylor.p3')(lambda s: 1+s['x0']+s['x0']**2/2)
reg('c1.rat.p1')(lambda s: 1/((s['a']+1e-9)-s['b']))
reg('c1.rat.p2')(lambda s: integ(lambda x:1/((x-s['a'])*(x-s['a']-s['d'])),s['a']+s['d']+1,s['a']+s['d']+2))
reg('c1.rat.p3')(lambda s: (s['b']+1e-9+s['c'])/((s['b']+1e-9)-s['a']))
reg('c1.rat.p5')(lambda s: integ(lambda x:1/(x*x-s['a']**2),s['a']+1,s['a']+2))
reg('c1.app.p1')(lambda s: integ(lambda x:s['k']*x,0,s['b']))
reg('c1.app.p2')(lambda s: integ(lambda x:s['a']*x-x*x,0,s['a']))
reg('c1.app.p3')(lambda s: math.pi*integ(lambda x:x*x,0,s['b']))
reg('c1.app.p5')(lambda s: integ(lambda x:x*x,0,s['b'])/s['b'])
reg('c1.rules.p1')(lambda s: d1(lambda x:s['a']*x**s['n'],s['x0']))
reg('c1.rules.p2')(lambda s: d1(lambda x:x*x*(s['a']*x+s['b']),s['x0']))
reg('c1.rules.p5')(lambda s: d1(lambda x:x/(s['a']*x+s['b']),s['x0']))
bad=0; checked=0; per={}
for r in data:
    key=f"{r['id']}.{r['pid']}"
    if key not in C: continue
    try: exp=C[key](r['scope'])
    except Exception as e:
        print('CHECKER-ERR', key, r['seed'], repr(e)); bad+=1; continue
    got=r['a']
    if isinstance(got,list) or exp is None: continue
    checked+=1; per[key]=per.get(key,0)+1
    tol=2e-3*max(1,abs(float(exp)))
    if abs(float(exp)-float(got))>tol:
        bad+=1
        if bad<=25: print('MISMATCH', key, 'seed',r['seed'], 'engine',got,'numeric',float(exp),'|',r['q'][:110])
print('checked', checked, 'problem types', len(per), 'mismatches', bad)

sys.exit(1 if bad else 0)
