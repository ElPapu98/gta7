import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = id => document.getElementById(id);
const mobile = matchMedia('(pointer:coarse)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#758487');
scene.fog = new THREE.FogExp2('#83908b', .006);
const camera = new THREE.PerspectiveCamera(69, 1, .09, 450);
const renderer = new THREE.WebGLRenderer({canvas:$('world'),antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const ao = new SSAOPass(scene,camera,1,1);ao.kernelRadius=8;ao.minDistance=.003;ao.maxDistance=.13;composer.addPass(ao);
const bloom = new UnrealBloomPass(new THREE.Vector2(1,1),.17,.3,.9);composer.addPass(bloom);
composer.addPass(new OutputPass());
let quality=mobile?1:2;
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio,[1,1.4,mobile?1.4:1.85][quality]));
  composer.setPixelRatio(renderer.getPixelRatio());
  renderer.setSize(w,h,false);composer.setSize(w,h);
  camera.aspect=w/h;camera.updateProjectionMatrix();
  ao.enabled=quality===2;
  $('settings').textContent=['ECO','HIGH','ULTRA'][quality];
}
addEventListener('resize',resize);resize();
$('settings').onclick=()=>{quality=(quality+1)%3;resize();};

const hemisphere=new THREE.HemisphereLight('#d3e6f1','#5b4d3c',1.5);scene.add(hemisphere);
const sun=new THREE.DirectionalLight('#ffe0ac',3.2);
sun.position.set(-35,55,-90);sun.castShadow=true;
sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
sun.shadow.camera.left=-80;sun.shadow.camera.right=80;
sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;
sun.shadow.camera.near=1;sun.shadow.camera.far=230;
sun.shadow.normalBias=.045;sun.shadow.bias=-.00014;scene.add(sun,sun.target);
const mat=(color,roughness=.83,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const textureLoader=new THREE.TextureLoader();
const gltfLoader=new GLTFLoader();
const makeBox=(w,h,d,x,y,z,m,parent=scene)=>{
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  o.position.set(x,y,z);o.receiveShadow=true;parent.add(o);return o;
};
const stone=mat('#ada69a'),curb=mat('#aaa8a0'),metal=mat('#2c3737',.38,.72);
const road=mat('#767773'),paving=mat('#a6a49b'),wall=mat('#b7ada0');
const asphalt=makeBox(15,.1,190,0,-.09,-35,road);
for(const side of [-1,1]){
  makeBox(6,.19,190,side*10.5,.01,-35,paving);
  makeBox(.23,.34,190,side*7.62,.1,-35,curb);
  makeBox(.1,.012,190,side*6.85,-.025,-35,mat('#d4c5a5'));
  // Small staggered paving joints introduce scale without textured checkerboarding.
  const jointMat=mat('#777a77');
  for(let z=-125;z<60;z+=2.4){
    makeBox(5.6,.012,.026,side*10.5,.116,z,jointMat);
  }
}
// Street markings and raised reflective road studs.
const white=mat('#d6d2c4',.9),amber=mat('#c9b27b',.65);
for(let z=-128;z<58;z+=9){makeBox(.16,.012,3.2,0,-.023,z,white);}
for(let z=-118;z<55;z+=34){
  for(let i=-4;i<=4;i++)makeBox(.72,.014,2.6,i*1.42,-.019,z,white);
}
for(let z=-120;z<55;z+=10){makeBox(.14,.045,.2,0,-.01,z,amber);}

// Physically based thin-film water on the street; intentionally sparse and
// near-coplanar to avoid the large black intersecting triangles of the old map.
const wet=new THREE.MeshPhysicalMaterial({color:'#4a5658',roughness:.13,metalness:.35,clearcoat:1,clearcoatRoughness:.045,transparent:true,opacity:.58,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
for(const [x,z,sx,sz] of [[-4,-10,2.1,3.3],[3.5,-44,2.6,5.1],[-4,-83,1.6,4.2],[4.6,29,1.8,2.4]]){
  const p=new THREE.Mesh(new THREE.CircleGeometry(1,36),wet);p.rotation.x=-Math.PI/2;p.position.set(x,-.028,z);p.scale.set(sx,sz,1);scene.add(p);
}

const lampMaterial=mat('#343e3d',.42,.65);
const emissive=new THREE.MeshStandardMaterial({color:'#ffdf9c',emissive:'#ffc778',emissiveIntensity:2.3,roughness:.3});
for(const side of [-1,1])for(let z=-110;z<=45;z+=31){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,8,12),lampMaterial);
  pole.position.set(side*8.4,4,z);pole.castShadow=true;scene.add(pole);
  makeBox(side*0+2.3,.14,.14,side*7.3,8,z,lampMaterial);
  makeBox(.83,.17,.49,side*6.25,7.88,z,emissive);
  if(z===-17||z===14){const light=new THREE.PointLight('#ffc780',mobile?1.2:2.1,15,2);light.position.set(side*6.25,7.65,z);scene.add(light);}
}

// Buildings are deliberately compact and form a street canyon. The scanned
// modular facades below replace their visible surfaces when licensed assets load.
const facades=[];
const facadeBase=[mat('#a6a095'),mat('#beb1a0'),mat('#908980'),mat('#9a9d97')];
for(const side of [-1,1])for(let i=0;i<12;i++){
  const z=49-i*15.5,h=12+(i*7%5)*2.7,w=13.8;
  const root=new THREE.Group();root.position.set(side*17.7,0,z);scene.add(root);
  const base=makeBox(11.2,h,12,0,h/2,0,facadeBase[i%4],root);
  base.castShadow=true;
  const roof=makeBox(11.8,.34,12.6,0,h+.1,0,stone,root);roof.castShadow=true;
  makeBox(2.2,.75,2.8,0,h+.62,-2,metal,root);
  // Recessed shopfront and canopy provide dimensional detail at street level.
  makeBox(8,3.4,.21,-side*5.65,1.85,0,mat('#263e42',.19,.35),root);
  makeBox(9,.24,2,-side*5.6,3.8,0,metal,root);
  for(let col=-1;col<=1;col++)for(let floor=0;floor<Math.floor((h-4)/3);floor++){
    const glass=mat((i+col+floor)%4===0?'#756e60':'#354d52',.18,.3);
    const pane=makeBox(.15,1.55,1.55,-side*5.7,5+floor*2.95,col*3.05,glass,root);
    pane.castShadow=false;
    makeBox(.2,1.65,.08,-side*5.77,5+floor*2.95,col*3.05+0.8,metal,root);
  }
  facades.push({root,side,z,i});
}

const models=[];
function normalize(model,width,height,depth){
  model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(width/(size.x||1),height/(size.y||1),depth/(size.z||1));
  model.scale.multiplyScalar(scale);model.updateMatrixWorld(true);
  const bb=new THREE.Box3().setFromObject(model);
  model.position.y-=bb.min.y;
  return model;
}
async function loadModel(name){const gltf=await gltfLoader.loadAsync(`./assets/${name}`);return gltf.scene;}
async function installFacades(){
  const original=await loadModel('urban-facade.glb');
  for(const f of facades){
    if(f.i>8 && mobile)continue;
    const model=normalize(original.clone(true),8.5,11,7.5);
    // Always orient toward the street, where the camera travels.
    model.rotation.y=f.side<0?Math.PI/2:-Math.PI/2;
    model.position.x=-f.side*5.7;
    model.position.z=0;
    model.traverse(o=>{if(o.isMesh){o.castShadow=!mobile;o.receiveShadow=true;}});
    f.root.add(model);models.push(model);
  }
}
async function installProps(){
  const resources=[
    ['covered-car.glb',[[4.5,8],[-4.5,-37],[4.3,-72]],2.1,2.5,4.8],
    ['street-lamp.glb',[[-8.3,7],[8.3,-29]],1.9,8,1.9],
    ['trash-can.glb',[[-7.9,-3],[7.9,-53],[-8,-92]],.8,1.4,.8],
    ['shrub.glb',[[9.4,20],[-9.4,-65],[9.4,-98],[-9.4,45]],2.4,2,2.4],
    ['street-seating.glb',[[10,13],[-10,-29]],3.1,2.2,2.2],
  ];
  await Promise.all(resources.map(async([name,locations,w,h,d])=>{
    try{
      const source=await loadModel(name);
      for(const [x,z] of locations){
        const object=normalize(source.clone(true),w,h,d);
        object.position.set(x,0,z);
        object.rotation.y=x<0?Math.PI:0;
        object.traverse(o=>{if(o.isMesh){o.castShadow=!mobile;o.receiveShadow=true;}});
        scene.add(object);models.push(object);
      }
    }catch(error){console.warn('Optional scene prop',name,error);}
  }));
}
async function installMaterials(){
  const textures=[
    [road,'weathered-asphalt-color.jpg','weathered-asphalt-normal.jpg',18,35],
    [paving,'urban-paving-color.jpg','urban-paving-normal.jpg',3,30],
    [wall,'concrete-color.jpg','concrete-normal.jpg',3,5],
    ...facadeBase.map(m=>[m,'concrete-color.jpg','concrete-normal.jpg',2,4]),
  ];
  await Promise.all(textures.map(async([material,color,normal,x,y])=>{
    try{
      const [diff,nrm]=await Promise.all([textureLoader.loadAsync(`./assets/${color}`),textureLoader.loadAsync(`./assets/${normal}`)]);
      for(const t of [diff,nrm]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
      diff.colorSpace=THREE.SRGBColorSpace;
      material.map=diff;material.normalMap=nrm;material.normalScale.set(.36,.36);material.needsUpdate=true;
    }catch(error){console.warn('Surface fallback',color,error);}
  }));
  try{
    const hdr=await new RGBELoader().loadAsync('./assets/sunset.hdr');
    hdr.mapping=THREE.EquirectangularReflectionMapping;
    scene.environment=hdr;scene.environmentIntensity=.85;
  }catch(error){console.warn('HDR fallback',error);}
}

const movement={x:0,z:23,speed:0},keys=new Set();
const checkpoints=[{x:0,z:-22,title:'CRUCE PRINCIPAL'},{x:0,z:-71,title:'ZONA COMERCIAL'},{x:0,z:-110,title:'FINAL DE LA CALLE'}];
let checkpointIndex=0;
const checkpointRoot=new THREE.Group();scene.add(checkpointRoot);
const markerRing=new THREE.Mesh(new THREE.TorusGeometry(.76,.042,8,48),new THREE.MeshBasicMaterial({color:'#edc78f'}));
markerRing.rotation.x=-Math.PI/2;markerRing.position.y=.025;checkpointRoot.add(markerRing);
const markerLight=new THREE.PointLight('#ffc780',1.5,5);markerLight.position.y=.8;checkpointRoot.add(markerLight);
function updateCheckpoint(){
  const goal=checkpoints[checkpointIndex];
  if(!goal){$('objective').textContent='RECORRIDO COMPLETADO';$('distance').textContent='3 / 3 puntos descubiertos';$('track').style.width='100%';checkpointRoot.visible=false;return;}
  checkpointRoot.position.set(goal.x,0,goal.z);
  $('objective').textContent=goal.title;
  $('track').style.width=`${checkpointIndex/3*100}%`;
}
updateCheckpoint();
let yaw=Math.PI,pitch=0,view=0,dragging=false,lastX=0,lastY=0,started=false;
const pad={x:0,y:0},touchLook=$('look');
addEventListener('keydown',e=>{keys.add(e.code);if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyV')changeView();});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();pad.x=0;pad.y=0;});
function changeView(){view=(view+1)%2;camera.fov=view?83:69;camera.updateProjectionMatrix();}
$('view').onclick=changeView;
let touchRun=false;$('sprint').onclick=()=>{touchRun=!touchRun;$('sprint').style.background=touchRun?'#bb8c49':'#1c2b2ccf';};
function look(dx,dy){yaw-=dx*.0032;pitch=THREE.MathUtils.clamp(pitch-dy*.0024,-1.1,1.1);}
const canvas=$('world');
canvas.addEventListener('pointerdown',e=>{if(!started)return;dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});
canvas.addEventListener('pointerup',()=>dragging=false);
touchLook.addEventListener('pointerdown',e=>{e.preventDefault();touchLook.setPointerCapture(e.pointerId);lastX=e.clientX;lastY=e.clientY;});
touchLook.addEventListener('pointermove',e=>{if(!touchLook.hasPointerCapture(e.pointerId))return;look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});
const padElement=$('pad'),nub=$('nub');
function movePad(e){
  const rect=padElement.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  pad.x=THREE.MathUtils.clamp((e.clientX-cx)/43,-1,1);pad.y=THREE.MathUtils.clamp((e.clientY-cy)/43,-1,1);
  nub.style.transform=`translate(${pad.x*37}px,${pad.y*37}px)`;
}
padElement.addEventListener('pointerdown',e=>{e.preventDefault();padElement.setPointerCapture(e.pointerId);movePad(e);});
padElement.addEventListener('pointermove',e=>{if(padElement.hasPointerCapture(e.pointerId))movePad(e);});
function resetPad(){pad.x=pad.y=0;nub.style.transform='';}
padElement.addEventListener('pointerup',resetPad);padElement.addEventListener('pointercancel',resetPad);

let previous=performance.now(),frames=0,elapsed=0;
function animate(t){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,(t-previous)/1000);previous=t;
  if(!started)return;
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))-pad.y;
  const side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+pad.x;
  const length=Math.max(1,Math.hypot(forward,side));
  const target=(keys.has('ShiftLeft')||keys.has('ShiftRight')||touchRun)?6.4:3.15;
  const vx=(Math.sin(yaw)*forward+Math.cos(yaw)*side)/length*target;
  const vz=(Math.cos(yaw)*forward-Math.sin(yaw)*side)/length*target;
  movement.x=THREE.MathUtils.clamp(movement.x+vx*dt,-6.35,6.35);
  movement.z=THREE.MathUtils.clamp(movement.z+vz*dt,-117,53);
  if(checkpointIndex<checkpoints.length){
    const goal=checkpoints[checkpointIndex],distance=Math.hypot(goal.x-movement.x,goal.z-movement.z);
    $('distance').textContent=`Punto de interés · ${Math.round(distance)} m`;
    markerRing.rotation.z+=dt*.26;
    if(distance<3.2){checkpointIndex++;updateCheckpoint();}
  }
  const bob=Math.sin(t*.011)*(Math.hypot(vx,vz)>.01?.025:0);
  camera.position.set(movement.x,1.68+bob,movement.z);
  camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;
  if(quality===2)composer.render();else renderer.render(scene,camera);
  frames++;elapsed+=dt;
  if(elapsed>1){$('fps').textContent=`${Math.round(frames/elapsed)} FPS · ${renderer.info.render.calls} DRAW`;elapsed=0;frames=0;}
}
requestAnimationFrame(animate);

async function boot(){
  const progress=$('progress');
  progress.textContent='Cargando superficies PBR y luz HDR…';
  await installMaterials();
  progress.textContent='Montando fachadas escaneadas…';
  try{await installFacades();}catch(error){console.warn('Facade fallback',error);}
  progress.textContent='Colocando vehículos y mobiliario…';
  await installProps();
  progress.textContent=`LISTO · ${models.length} OBJETOS 3D INSTALADOS`;
  $('enter').disabled=false;
}
$('enter').onclick=()=>{started=true;$('intro').classList.add('hidden');previous=performance.now();};
boot().catch(error=>{$('progress').textContent=`Recursos incompletos: ${error.message}`;$('enter').disabled=false;});
