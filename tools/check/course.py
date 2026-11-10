import re, yaml, json, sys, collections
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
import os
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')+'/'
ls=yaml.safe_load(open(R+'schema/lesson.schema')); ps=yaml.safe_load(open(R+'schema/problem.schema'))
Draft202012Validator.check_schema(ls); Draft202012Validator.check_schema(ps)
reg=Registry().with_resources([('lesson.schema',Resource.from_contents(ls)),('problem.schema',Resource.from_contents(ps))])
def val(schema,obj,name):
    errs=list(Draft202012Validator(schema,registry=reg).iter_errors(obj))
    print(name,'OK' if not errs else 'FAIL')
    for e in errs: print('  ',list(e.absolute_path),e.message[:200])
ex=open(R+'prompts/executor.md').read()
blocks=re.findall(r'```yaml\n(.*?)```',ex,re.S)
card=yaml.safe_load(blocks[0]); lesson=yaml.safe_load(blocks[1]); extra=yaml.safe_load(blocks[2])
val({'$ref':'lesson.schema#/$defs/cards'},card,'card')
val({'$ref':'lesson.schema'},lesson,'lesson')
for k,p in extra.items(): val({'$ref':'problem.schema'},p,k)
print(lesson['pr']['p1']['v'], lesson['pr']['p4']['w'])
# negative tests
bad=json.loads(json.dumps(lesson)); del bad['pr']['p2']['a']; val({'$ref':'lesson.schema'},bad,'neg(no a) expect FAIL')
bad=json.loads(json.dumps(lesson)); bad['def']=['text only']; val({'$ref':'lesson.schema'},bad,'neg(no g) expect FAIL')
# course map
m=open(R+'docs/COURSE_MAP.md').read()
rows=[];sec=None
for line in m.split('\n'):
    mm=re.match(r'\| ([a-z0-9]+\.[a-z0-9]+) \| (.*?) \| (.*?) \| (Я|Р|О) \| (\d+) \|',line)
    if mm: rows.append(mm.groups())
ids=[r[0] for r in rows]; assert len(ids)==len(set(ids)),'dup'
dep={};pri={};mins={}
prev=None
for i,(id,t,d,p,mn) in enumerate(rows):
    s=id.split('.')[0]
    ds=[]
    for x in [x.strip() for x in d.split(',')]:
        if x=='↑':
            assert prev and prev.split('.')[0]==s,(id,'↑ at section start'); ds.append(prev)
        elif x=='—': pass
        else: ds.append(x)
    dep[id]=ds;pri[id]=p;mins[id]=int(mn);prev=id
rank={'Я':0,'Р':1,'О':2}
for id,ds in dep.items():
    for x in ds:
        if x not in dep: print('MISSING',id,x)
        elif rank[pri[x]]>rank[pri[id]]: print('PRIORITY',id,pri[id],'<-',x,pri[x])
# cycles
state={}
def dfs(u,path):
    if state.get(u)==1: print('CYCLE',path+[u]);return
    if state.get(u)==2: return
    state[u]=1
    for x in dep[u]:
        if x in dep: dfs(x,path+[u])
    state[u]=2
for u in dep: dfs(u,[])
cnt=collections.OrderedDict()
for id in ids:
    s=id.split('.')[0]; c=cnt.setdefault(s,{'Я':0,'Р':0,'О':0,'mЯ':0,'m':0})
    c[pri[id]]+=1; c['m']+=mins[id]; c['mЯ']+=mins[id] if pri[id]=='Я' else 0
T={'Я':0,'Р':0,'О':0,'mЯ':0,'m':0}
for s,c in cnt.items():
    print(f"{s} {c['Я']}/{c['Р']}/{c['О']} {c['mЯ']/60:.1f} / {c['m']/60:.1f}")
    for k in T:T[k]+=c[k]
print('TOTAL',T,T['Я']+T['Р']+T['О'],T['mЯ']/60,T['m']/60)
# section-level deps
sd=collections.defaultdict(set)
for id,ds in dep.items():
    for x in ds:
        if x in dep and x.split('.')[0]!=id.split('.')[0]: sd[id.split('.')[0]].add((x.split('.')[0],pri[id]))
for s in cnt: print(s,'core-needs',sorted({a for a,p in sd[s] if p=='Я'}),'all',sorted({a for a,p in sd[s]}))
# fast track time
def closure(targets):
    seen=set()
    def go(u):
        if u in seen:return
        seen.add(u)
        for x in dep[u]: go(x)
    for t in targets: go(t)
    return seen
stcore=[i for i in ids if i.startswith('st.') and pri[i]=='Я']
c=closure(stcore); print('stat track',len(c),sum(mins[i] for i in c)/60, sorted({i.split('.')[0] for i in c}))
A=sum(len(open(R+f).read()) for f in ['prompts/executor.md','content/ref/style.md','content/ref/notation.md','schema/lesson.schema','schema/problem.schema'])
print('A chars',A, 'lesson chars',len(blocks[1]))
