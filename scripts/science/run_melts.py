"""Generate a bounded offline pack; run in a fresh process per path.
Requires the unmodified official alphaMELTS 2.3.2 Python distribution + tinynumpy.
No engine automatic fractionation: equilibrium outputFlag=0 then explicit solid transfer.
"""
import argparse, hashlib, json, math, pathlib, sys, os
p=argparse.ArgumentParser()
p.add_argument('--policy', choices=['retain-all','remove-all'],required=True)
p.add_argument('--input',type=pathlib.Path,required=True)
p.add_argument('--output',type=pathlib.Path,required=True)
p.add_argument('--end',type=int,default=1110)
a=p.parse_args()
if a.end not in range(1000,1201,5): p.error('end must be 1000–1200 on a 5°C grid')
a.input=a.input.resolve();a.output=a.output.resolve()
a.output.parent.mkdir(parents=True,exist_ok=True)
work_dir=a.output.with_suffix('.raw');work_dir.mkdir(exist_ok=True)
os.chdir(work_dir)
from meltsdynamic import MELTSdynamic
m=MELTSdynamic(1)
e=m.engine
if not m.version.startswith('2.3.2 '): raise RuntimeError('VERSION_MISMATCH')
raw=a.input.read_bytes(); original={}
for line in raw.decode().splitlines():
 if line.startswith('Initial Composition:'):
  name,value=line.split(':',1)[1].split(); original[name.lower()]=float(value)
keys=e.status.endmembers['bulk']; total=sum(original.values())
initial={k:original.get(k,0)*100/total for k in keys}
e.setBulkComposition([initial[k] for k in keys]);e.pressure=500;e.temperature=1200
e.findLiquidus()
if e.status.failed: raise RuntimeError('LIQUIDUS_FAILED')
liquidus=e.temperature
start=math.ceil((liquidus+10)/5)*5
# Molecular weights match the oxide weights exposed by this locked solver build.
weights={'O':15.9994,'Si':28.0855,'Ti':47.9,'Al':26.98154,'Fe':55.847,'Cr':51.9961,'Mn':54.938,'Mg':24.305,'Ni':58.71,'Co':58.9332,'Ca':40.08,'Na':22.98977,'K':39.0983,'P':30.97376,'H':1.0079,'C':12.011,'S':32.06}
formula={'sio2':{'Si':1,'O':2},'tio2':{'Ti':1,'O':2},'al2o3':{'Al':2,'O':3},'fe2o3':{'Fe':2,'O':3},'cr2o3':{'Cr':2,'O':3},'feo':{'Fe':1,'O':1},'mno':{'Mn':1,'O':1},'mgo':{'Mg':1,'O':1},'nio':{'Ni':1,'O':1},'coo':{'Co':1,'O':1},'cao':{'Ca':1,'O':1},'na2o':{'Na':2,'O':1},'k2o':{'K':2,'O':1},'p2o5':{'P':2,'O':5},'h2o':{'H':2,'O':1},'co2':{'C':1,'O':2},'so3':{'S':1,'O':3}}
def elements(c):
 out={el:0.0 for el in weights}
 for k,v in c.items():
  if not math.isfinite(v) or v < -1e-10: raise RuntimeError('NEGATIVE_MASS')
  if v==0: continue
  if k not in formula: raise RuntimeError('UNMAPPED_COMPONENT '+k)
  mol=sum(weights[el]*n for el,n in formula[k].items())
  for el,n in formula[k].items():out[el]+=v*n*weights[el]/mol
 return out
def add(comps):return {k:sum(c.get(k,0) for c in comps) for k in keys}
def audit(left,right):
 x,y=elements(left),elements(right)
 errors={k:x[k]-y[k] for k in x}
 if any(abs(v)>max(1e-6,elements(initial)[k]*1e-8) for k,v in errors.items()):raise RuntimeError('ELEMENT_BALANCE_FAILED '+str(errors))
 if abs(sum(left.values())-sum(right.values()))>1e-6:raise RuntimeError('MASS_BALANCE_FAILED')
 return max(abs(v) for v in errors.values())
pack={'schemaVersion':1,'packId':'morb-232-'+a.policy,'status':'partial',
 'provenance':{'sourceKind':'published-example','sourceUrl':'https://github.com/magmasource/alphaMELTS/blob/v2.3.2/examples/tutorial/app/Morb.melts','citation':'Allan et al. 1989 (see Ghiorso 1997), as cited by official tutorial; not independently remeasured','rawInputSha256':hashlib.sha256(raw).hexdigest(),'sourceVersion':'v2.3.2'},
 'solver':{'distribution':'alphaMELTS','version':m.version,'model':'rhyolite-MELTS 1.0.2','librarySha256':hashlib.sha256(pathlib.Path(sys.modules['meltsdynamic'].__file__).with_name('libalphamelts.so').read_bytes()).hexdigest(),'archiveSha256':'97ec2cdb53cae69822a41b5639d8b93edf95b2c361bc15e64e53b192ea9e1425'},
 'basis':{'initialMassKg':100,'originalComponents':original,'originalTotal':total,'normalizationFactor':100/total,'initialComponentsKg':initial,'atomicWeights':weights,'atomicWeightVersion':'MELTS oxide molecular weights, alphaMELTS 2.3.2','solverMassUnit':'g','physicalKgPerSolverGram':1,'oxygenBoundary':'closed'},
 'scenario':{'pressureBar':500,'liquidusC':liquidus,'startTemperatureC':start,'endTemperatureC':a.end,'stepC':5,'solidPolicy':a.policy,'fluidPolicy':'retain','fO2Buffer':'none'},'frames':[]}
current=dict(initial);removed=[]
try:
 for step,t in enumerate(range(start,a.end-1,-5)):
  e.setBulkComposition([current[k] for k in keys]);e.temperature=t
  e.calcEquilibriumState(1,0)
  if e.status.failed: raise RuntimeError('NON_CONVERGENCE '+e.status.message)
  phases=[]
  for name in e.liquidNames+e.solidNames:
   amount=float(e.mass[name]);pct=[float(v) for v in e.dispComposition[name]]
   comp={k:amount*pct[i]/100 for i,k in enumerate(keys)}
   category='liquid' if name in e.liquidNames else 'fluid' if name.startswith(('fluid','water')) else 'solid'
   phases.append({'id':name,'batchId':str(step)+':'+name,'category':category,'massKg':amount,'componentsKg':comp})
  if step==0 and any(x['massKg']>1e-8 and x['category']!='liquid' for x in phases):raise RuntimeError('INITIAL_STATE_NOT_ALL_LIQUID')
  pre=add([x['componentsKg'] for x in phases]);err=audit(current,pre)
  taken=[x for x in phases if a.policy=='remove-all' and x['category']=='solid']
  kept=[x for x in phases if x not in taken]
  removed.extend(taken)
  after=add([x['componentsKg'] for x in kept]);cumulative=add([x['componentsKg'] for x in removed])
  err=max(err,audit(initial,add([after,cumulative])))
  pack['frames'].append({'step':step,'temperatureC':t,'pressureBar':500,'inputComponentsKg':current,'equilibratedPhases':phases,'retainedPhases':kept,'removedThisStep':taken,'cumulativeRemovedComponentsKg':cumulative,'maxElementErrorKg':err})
  print('FRAME',step,t,'liquid',sum(x['massKg'] for x in phases if x['category']=='liquid'),'audit',err,flush=True)
  current=after
  if not any(x['category']=='liquid' and x['massKg']>1e-8 for x in kept): raise RuntimeError('LIQUID_EXHAUSTED')
 pack['status']='complete';pack['termination']={'reason':'targetReached','lastValidStep':len(pack['frames'])-1}
except Exception as ex:
 pack['termination']={'reason':str(ex),'lastValidStep':len(pack['frames'])-1}
 a.output.write_text(json.dumps(pack,ensure_ascii=False,indent=2,allow_nan=False))
 raise
else:a.output.write_text(json.dumps(pack,ensure_ascii=False,indent=2,allow_nan=False))
