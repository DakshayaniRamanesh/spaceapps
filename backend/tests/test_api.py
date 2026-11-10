import io
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import app
from app.models import FieldRequest
from app.providers import SyntheticObservationProvider, SpherexIRSAProvider, field_key, decode_frame, scene, difference_arrays, render_difference, add_source, SIZE

client=TestClient(app)
provider=SyntheticObservationProvider()
PARAMS={'ra':269.452077,'dec':4.693365,'fov_arcmin':12,'detector':'D1'}

def test_metadata_and_determinism():
    first=client.get('/api/observations',params=PARAMS)
    assert first.status_code==200
    data=first.json()
    assert data==client.get('/api/observations',params=PARAMS).json()
    assert data['source_type']=='synthetic'
    assert len(data['frames'])==8
    assert len({f['id'] for f in data['frames']})==8
    assert [f['timestamp'] for f in data['frames']]==sorted(f['timestamp'] for f in data['frames'])
    url=data['frames'][0]['image_url']
    a,b=client.get(url),client.get(url)
    assert a.content==b.content
    assert a.headers['content-type']=='image/png'
    assert Image.open(io.BytesIO(a.content)).size==(384,384)

@pytest.mark.parametrize('update',[{'ra':360},{'ra':-1},{'dec':91},{'dec':-91},{'fov_arcmin':1},{'fov_arcmin':61},{'detector':'D7'},{'ra':'NaN'},{'dec':'Infinity'},{'ra':''}])
def test_invalid_requests(update):
    assert client.get('/api/observations',params={**PARAMS,**update}).status_code==422

@pytest.mark.parametrize('update',[{'ra':0},{'ra':359.9999999},{'dec':90},{'dec':-90},{'fov_arcmin':2},{'fov_arcmin':60}])
def test_boundaries(update):
    assert client.get('/api/observations',params={**PARAMS,**update}).status_code==200

def test_missing_and_malformed_frames():
    assert client.get('/api/frames/missing.png').status_code==404
    assert client.get('/api/frames/invalid.100.png').status_code==404
    assert client.get('/api/difference',params={'frame_a':'bad','frame_b':'bad'}).status_code==404

def test_difference_arithmetic_and_sign():
    req=FieldRequest(**PARAMS)
    frames=provider.observations(req).frames
    a,b=provider.array(frames[0].id),provider.array(frames[7].id)
    diff=difference_arrays(a,b)
    np.testing.assert_array_equal(diff,b-a)
    assert diff.max()>400 and diff.min() < -400
    same=client.get('/api/difference',params={'frame_a':frames[0].id,'frame_b':frames[0].id})
    arr=np.array(Image.open(io.BytesIO(same.content)))
    assert np.all(arr==[8,14,24])
    reverse=difference_arrays(b,a)
    np.testing.assert_array_equal(diff,-reverse)
    colors=np.array(Image.open(io.BytesIO(render_difference(np.array([[-1000,0,1000]],dtype=np.float32)))))
    assert colors[0,0,2]>colors[0,0,0] and colors[0,2,0]>colors[0,2,2]

def test_reject_unregistered_difference():
    a=provider.observations(FieldRequest(**PARAMS)).frames[0].id
    b=provider.observations(FieldRequest(**{**PARAMS,'detector':'D2'})).frames[0].id
    assert client.get('/api/difference',params={'frame_a':a,'frame_b':b}).status_code==422

def test_parameter_changes_are_meaningful_and_repeatable():
    arrays=[]
    for update in [{},{'ra':120},{'fov_arcmin':6},{'detector':'D6'}]:
        req=FieldRequest(**{**PARAMS,**update});key=field_key(req)
        arr=scene(key)[0];arrays.append(arr)
        scene.cache_clear()
        np.testing.assert_array_equal(arr,scene(key)[0])
    for arr in arrays[1:]: assert not np.array_equal(arrays[0],arr)

def test_moving_and_variable_sources():
    req=FieldRequest(**PARAMS);frames=scene(field_key(req))
    def near(arr,x,y):
        xx,yy=round(x),round(y)
        return arr[yy-2:yy+3,xx-2:xx+3].max()
    x0=(-.48/12+.5)*SIZE;y0=(.3/12+.5)*SIZE
    x7=((- .48+7*.14)/12+.5)*SIZE;y7=((.3-7*.075)/12+.5)*SIZE
    assert near(frames[0],x0,y0)>near(frames[7],x0,y0)+500
    assert near(frames[7],x7,y7)>near(frames[0],x7,y7)+500
    vx=(.55/12+.5)*SIZE;vy=(-.58/12+.5)*SIZE
    assert near(frames[2],vx,vy)>near(frames[6],vx,vy)+500

def test_psf_is_distributed():
    image=np.zeros((SIZE,SIZE),np.float32);add_source(image,100,100,1000,1.5)
    assert image[100,100]==1000
    assert 0<image[100,101]<1000
    assert image[100,101]==image[101,100]

def test_ids_survive_cache_eviction():
    frame=provider.observations(FieldRequest(**PARAMS)).frames[0]
    before=provider.array(frame.id).copy();scene.cache_clear()
    np.testing.assert_array_equal(before,provider.array(frame.id))
    assert decode_frame(frame.id)[1]==0

def test_presets_and_disabled_provider():
    presets=client.get('/api/presets').json()
    assert len(presets)==5
    for preset in presets:
        FieldRequest(ra=preset['ra'],dec=preset['dec'])
    with pytest.raises(NotImplementedError):
        SpherexIRSAProvider().observations(FieldRequest(**PARAMS))
    assert client.get('/health').json()['real_data_enabled'] is False

def test_fov_scales_angular_motion_instead_of_relabeling():
    separations=[]
    for fov in (6,12):
        arrays=scene(field_key(FieldRequest(**{**PARAMS,'fov_arcmin':fov})))
        diff=difference_arrays(arrays[0],arrays[7])
        old=np.array(np.unravel_index(np.argmin(diff),diff.shape))
        new=np.array(np.unravel_index(np.argmax(diff),diff.shape))
        separations.append(np.linalg.norm(new-old))
    assert 1.85<separations[0]/separations[1]<2.15
