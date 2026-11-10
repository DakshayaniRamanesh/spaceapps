"""Create original procedural artwork and backend-generated demo frames."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, zoom
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
from app.models import FieldRequest
from app.providers import SyntheticObservationProvider, render_frame
out=ROOT/'frontend/public'
(out/'demo').mkdir(exist_ok=True)
p=SyntheticObservationProvider()
for d in range(1,7):
 s=p.observations(FieldRequest(ra=269.452077,dec=4.693365,fov_arcmin=6,detector=f'D{d}'))
 (out/'demo'/f'detector-{d}.png').write_bytes(render_frame(p.array(s.frames[3].id)))
 if d==1:
  for i,f in enumerate(s.frames): (out/'demo'/f'frame-{i}.png').write_bytes(render_frame(p.array(f.id)))
# Original non-scientific procedural emission cloud. Not telescope imagery.
w,h=1800,1200
rng=np.random.default_rng(3519)
y,x=np.mgrid[:h,:w]; xx=(x-w*.72)/510; yy=(y-h*.47)/420
noise=np.zeros((h,w),dtype=np.float32)
for scale,weight in [(9,1),(22,.5),(55,.25),(110,.12),(250,.04)]:
 small=rng.random((scale,scale))*2-1
 layer=zoom(small,(h/scale,w/scale),order=3)[:h,:w]
 noise+=layer*weight
r=np.sqrt((xx+.12*np.sin(yy*3))**2+(yy+.08*np.sin(xx*4))**2)
a=np.arctan2(yy,xx)
ring=np.exp(-((r-(.71+.11*np.sin(a*3)+noise*.14))/.19)**2)
filaments=(np.maximum(noise+.48,0)**1.9)*ring
halo=np.exp(-((r-.8)/.4)**2)*.06
light=filaments+halo
blue=np.array([61,119,151]); warm=np.array([163,128,108]); mix=(np.sin(a+1.6)+1)/2
color=blue[None,None,:]*(1-mix[...,None])+warm[None,None,:]*mix[...,None]
arr=np.zeros((h,w,3))+np.array([5,9,20]);arr+=light[...,None]*color
arr+=(np.exp(-r*r/.6)*.022)[...,None]*np.array([73,105,137])
arr+=rng.normal(0,.65,(h,w,1))
im=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
stars=Image.new('RGB',(w,h));draw=ImageDraw.Draw(stars)
for _ in range(2300):
 sx=int(rng.integers(w));sy=int(rng.integers(h));b=int(rng.choice([35,55,90,140,210],p=[.35,.32,.23,.08,.02]));rad=float(rng.choice([.35,.6,1,1.5],p=[.5,.3,.18,.02]));draw.ellipse((sx-rad,sy-rad,sx+rad,sy+rad),fill=(int(b*.8),int(b*.9),b))
for sx,sy in [(1360,320),(1120,730),(1650,590),(906,200),(720,833)]:
 draw.line((sx-7,sy,sx+7,sy),fill=(100,130,153),width=1);draw.line((sx,sy-7,sx,sy+7),fill=(100,130,153),width=1);draw.ellipse((sx-1,sy-1,sx+1,sy+1),fill=(215,232,240))
from PIL import ImageChops
im=ImageChops.add(im,stars.filter(ImageFilter.GaussianBlur(.35)))
im.save(out/'nebula.webp',quality=90)
print('Created original nebula artwork and 14 scientific demonstration frames.')
