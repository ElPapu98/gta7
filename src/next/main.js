import * as pc from 'playcanvas';
import { CAPTURES, validateCapture } from './assets.js';

const $ = id => document.getElementById(id);
const canvas = $('viewport');
const coarse = matchMedia('(pointer:coarse)').matches;
const deviceRatio = window.devicePixelRatio || 1;
const state = {
  capture: 'apartment', asset: null, entity: null, ready: false, started: false,
  walk: false, yaw: 34, pitch: 13, distance: 8.6,
  x: 0, y: -1.6, z: 1.2, quality: coarse ? 1 : 2,
  keys: new Set(), axisX: 0, axisY: 0, run: false
};

const qualityRatios = [0.7, 1, 1.5];
function applyQuality(device) {
  device.maxPixelRatio = Math.min(deviceRatio, qualityRatios[state.quality]);
  $('quality').textContent = `CALIDAD: ${['ECO','ALTA','ULTRA'][state.quality]}`;
}

async function createDevice() {
  try {
    return await pc.createGraphicsDevice(canvas, {
      deviceTypes: [pc.DEVICETYPE_WEBGPU], antialias: false, alpha: false
    });
  } catch (error) {
    console.warn('WebGPU unavailable; trying WebGL2', error);
    return pc.createGraphicsDevice(canvas, {
      deviceTypes: [pc.DEVICETYPE_WEBGL2], antialias: false, alpha: false
    });
  }
}

function setLoading(message, fraction = 0) {
  $('load-status').textContent = message;
  $('load-progress').style.width = `${Math.round(fraction * 100)}%`;
}

async function bootstrap() {
  const device = await createDevice();
  applyQuality(device);
  $('backend').textContent = device.isWebGPU ? 'WEBGPU ACTIVO' : 'WEBGL2 COMPATIBLE';
  const options = new pc.AppOptions();
  options.graphicsDevice = device;
  options.componentSystems = [
    pc.RenderComponentSystem, pc.CameraComponentSystem,
    pc.LightComponentSystem, pc.GSplatComponentSystem
  ];
  options.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.GSplatHandler];
  const app = new pc.AppBase(canvas);
  app.init(options);
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  const camera = new pc.Entity('Inspection Camera');
  camera.addComponent('camera', {
    clearColor: new pc.Color(.055,.08,.09), fov: 65,
    nearClip: .07, farClip: 500
  });
  app.root.addChild(camera);
  const ambient = new pc.Entity('Ambient Sun');
  ambient.addComponent('light', {type:'directional',intensity:.65,color:new pc.Color(1,.92,.84)});
  ambient.setEulerAngles(55,-45,0);
  app.root.addChild(ambient);
  app.start();
  addEventListener('resize',()=>app.resizeCanvas());

  function setCaptureView(capture) {
    state.yaw=capture.camera.yaw;state.pitch=capture.camera.pitch;state.distance=capture.camera.distance;
    [state.x,state.y,state.z]=capture.walking.position;
    state.walk=false;$('mode').textContent='EXPLORAR A PIE';
  }

  async function loadCapture(key) {
    const capture=CAPTURES[key];
    if(!validateCapture(capture))throw Error('Captura sin licencia o procedencia válida');
    state.ready=false;
    $('scene-title').textContent=capture.title;
    $('scene-note').textContent=capture.description;
    document.querySelector('footer span').textContent=`${capture.author} · ${capture.license}`;
    document.querySelectorAll('[data-scene]').forEach(b=>b.classList.toggle('selected',b.dataset.scene===key));
    setLoading(`Cargando captura real: ${capture.title}…`,.18);
    if(state.entity){state.entity.destroy();state.entity=null;}
    if(state.asset){app.assets.remove(state.asset);state.asset.unload();state.asset=null;}
    const asset=new pc.Asset(capture.title,'gsplat',{url:capture.url});
    state.asset=asset;
    app.assets.add(asset);
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('La descarga tardó demasiado')),90000);
      asset.once('load',()=>{clearTimeout(timeout);resolve();});
      asset.once('error',error=>{clearTimeout(timeout);reject(error);});
      app.assets.load(asset);
    });
    if(state.asset!==asset)return;
    const entity=new pc.Entity(`Scanned: ${capture.title}`);
    entity.addComponent('gsplat',{asset});
    app.root.addChild(entity);
    state.entity=entity;state.capture=key;
    setCaptureView(capture);
    state.ready=true;
    setLoading(`CAPTURA LISTA · ${capture.description}`,1);
    $('start').disabled=false;
  }

  let frames=0, elapsed=0;
  app.on('update',dt=>{
    if(!state.ready)return;
    const capture=CAPTURES[state.capture];
    const yaw=state.yaw*Math.PI/180,pitch=state.pitch*Math.PI/180;
    const target=new pc.Vec3(...capture.camera.target);
    if(state.walk){
      const forward=Number(state.keys.has('KeyW')||state.keys.has('ArrowUp'))-Number(state.keys.has('KeyS')||state.keys.has('ArrowDown'))-state.axisY;
      const side=Number(state.keys.has('KeyD')||state.keys.has('ArrowRight'))-Number(state.keys.has('KeyA')||state.keys.has('ArrowLeft'))+state.axisX;
      const length=Math.max(1,Math.hypot(forward,side));
      const speed=state.run||state.keys.has('ShiftLeft')?3.4:1.65;
      state.x+=((Math.sin(yaw)*forward+Math.cos(yaw)*side)/length)*speed*Math.min(dt,.05);
      state.z+=((Math.cos(yaw)*forward-Math.sin(yaw)*side)/length)*speed*Math.min(dt,.05);
      const [bx,bz]=capture.walking.bounds;
      state.x=pc.math.clamp(state.x,-bx,bx);
      state.z=pc.math.clamp(state.z,-bz,bz);
      camera.setPosition(state.x,state.y,state.z);
      camera.lookAt(state.x+Math.sin(yaw)*Math.cos(pitch),state.y+Math.sin(pitch),state.z+Math.cos(yaw)*Math.cos(pitch));
    }else{
      camera.setPosition(
        target.x+Math.sin(yaw)*Math.cos(pitch)*state.distance,
        target.y+Math.sin(pitch)*state.distance,
        target.z+Math.cos(yaw)*Math.cos(pitch)*state.distance
      );
      camera.lookAt(target);
    }
    frames++;elapsed+=dt;
    if(elapsed>=1){$('fps').textContent=`${Math.round(frames/elapsed)} FPS`;elapsed=0;frames=0;}
  });

  $('quality').onclick=()=>{state.quality=(state.quality+1)%3;applyQuality(device);app.resizeCanvas();};
  $('mode').onclick=()=>{
    state.walk=!state.walk;
    $('mode').textContent=state.walk?'MODO INSPECCIÓN':'EXPLORAR A PIE';
    $('hint').textContent=state.walk?'WASD MOVER · RATÓN MIRAR · SHIFT CORRER':'ARRASTRAR PARA GIRAR · RUEDA PARA ACERCAR';
  };
  $('reset').onclick=()=>setCaptureView(CAPTURES[state.capture]);
  document.querySelectorAll('[data-scene]').forEach(button=>button.onclick=async()=>{
    if(!state.ready)return;
    $('loading').classList.remove('hidden');$('start').disabled=true;
    try{await loadCapture(button.dataset.scene);}catch(error){setLoading(`Error: ${error.message}`);$('start').disabled=false;}
  });
  $('start').onclick=()=>{$('loading').classList.add('hidden');state.started=true;};

  let pointer=null,lastX=0,lastY=0;
  const rotate=(dx,dy)=>{
    state.yaw-=dx*.22;
    state.pitch=pc.math.clamp(state.pitch+(state.walk?-1:1)*dy*.18,-80,80);
  };
  canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(pointer!==e.pointerId)return;
    rotate(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;
  });
  canvas.addEventListener('pointerup',()=>pointer=null);
  canvas.addEventListener('pointercancel',()=>pointer=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.distance=pc.math.clamp(state.distance+Math.sign(e.deltaY)*.7,1.6,35);},{passive:false});
  const lookzone=$('lookzone');
  lookzone.addEventListener('pointerdown',e=>{lookzone.setPointerCapture(e.pointerId);lastX=e.clientX;lastY=e.clientY;});
  lookzone.addEventListener('pointermove',e=>{if(lookzone.hasPointerCapture(e.pointerId)){rotate(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;}});
  const joystick=$('joystick'),stick=$('stick');
  const moveStick=e=>{
    const rect=joystick.getBoundingClientRect();
    state.axisX=pc.math.clamp((e.clientX-rect.left-rect.width/2)/40,-1,1);
    state.axisY=pc.math.clamp((e.clientY-rect.top-rect.height/2)/40,-1,1);
    stick.style.transform=`translate(${state.axisX*34}px,${state.axisY*34}px)`;
  };
  joystick.addEventListener('pointerdown',e=>{joystick.setPointerCapture(e.pointerId);moveStick(e);});
  joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))moveStick(e);});
  const releaseStick=()=>{state.axisX=state.axisY=0;stick.style.transform='';};
  joystick.addEventListener('pointerup',releaseStick);joystick.addEventListener('pointercancel',releaseStick);
  $('run').onclick=()=>{state.run=!state.run;$('run').classList.toggle('active',state.run);};
  addEventListener('keydown',e=>{state.keys.add(e.code);if(e.code==='KeyV')$('mode').click();});
  addEventListener('keyup',e=>state.keys.delete(e.code));
  addEventListener('blur',()=>{state.keys.clear();releaseStick();});

  await loadCapture('apartment');
}

bootstrap().catch(error=>{
  console.error('GTA7 Next initialization:',error);
  setLoading(`No se pudo iniciar WebGPU/WebGL2: ${error.message}`);
  $('backend').textContent='GPU NO DISPONIBLE';
});
