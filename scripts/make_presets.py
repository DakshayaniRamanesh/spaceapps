"""Reference positions copied from SIMBAD ICRS J2000 on 2026-11-10.
These are field centers, not propagated current positions."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def ra(h,m,s): return round((h+m/60+s/3600)*15,8)
def dec(d,m,s): return round((abs(d)+m/60+s/3600)*(-1 if d<0 else 1),8)
data=[
 dict(id='barnard', name="Barnard's Star", classification='High proper-motion red dwarf', phenomenon='Motion', ra=ra(17,57,48.4984700685),dec=dec(4,41,36.113879676),description='A nearby red dwarf with rapid apparent motion across the sky.',source='https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Barnard%27s+star',epoch='J2000',verified=True),
 dict(id='epsilon',name='Epsilon Indi B',classification='Brown dwarf binary',phenomenon='Motion',ra=ra(22,4,10.5951812451),dec=dec(-56,46,58.239102418),description='A cool brown dwarf pair, ideal for introducing infrared sources and motion.',source='https://simbad.u-strasbg.fr/simbad/sim-id?Ident=%2A+eps+Ind+B',epoch='J2000',verified=True),
 dict(id='wise',name='WISE 0855',classification='Cold brown dwarf',phenomenon='Motion',ra=ra(8,55,10.831),dec=dec(-7,14,42.53),description='An exceptionally cold substellar object: a window into the infrared sky.',source='Coordinates supplied in the project brief; epoch unspecified',epoch='Unspecified',verified=False),
 dict(id='rw-aur',name='RW Aurigae',classification='T Tauri variable',phenomenon='Variability',ra=ra(5,7,49.5662483),dec=dec(30,24,5.177426),description='A young stellar system that introduces changes in brightness.',source='https://simbad.cds.unistra.fr/simbad/sim-id?Ident=RW+Aur',epoch='J2000',verified=True),
 dict(id='r-dra',name='R Draconis',classification='Mira variable',phenomenon='Variability',ra=ra(16,32,40.226599908),dec=dec(66,45,17.925901992),description='A pulsating variable star whose brightness changes over time.',source='https://simbad.cds.unistra.fr/simbad/sim-id?Ident=%40376084&Name=V%2A+R+Dra&submit=submit',epoch='J2000',verified=True)]
for p in [root/'backend/app/presets.json',root/'frontend/lib/presets.json']:
 p.write_text(json.dumps(data,indent=2)+'\n')
