import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { fetchVisualAssets } from './asset-stream.js';
import { movement, readGamepad } from './controls.js';
import { createMotor, stepMotor, cameraClearance } from './character-motor.js';
import { createWorld, step, incident } from './simulation.js';
import { newGame, activeJob, objective, interact, tickGame, distanceTo, saveProgress } from './gameplay.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9caeb5');
scene.fog = new THREE.FogExp2('#a7ada7', 0.00165);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const mobileGpu = matchMedia('(pointer:coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, mobileGpu ? 1.15 : 1.65));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
const camera = new THREE.PerspectiveCamera(65, 1, .15, 2000);
camera.position.set(8, 6, 15);
const clock = new THREE.Clock();
const sun = new THREE.DirectionalLight('#ffe4b5', 3.5);
sun.position.set(-180, 180, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -75; sun.shadow.camera.right = 75;
sun.shadow.camera.top = 75; sun.shadow.camera.bottom = -75;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 600;
sun.shadow.bias = -.0002;
sun.target.position.set(0, 0, 0);
scene.add(sun, sun.target);
const ambient = new THREE.HemisphereLight('#b6d4ff', '#7d715e', 2.0);
scene.add(ambient);
const sky = new Sky();
sky.scale.setScalar(450000);
sky.material.uniforms.turbidity.value = 6;
sky.material.uniforms.rayleigh.value = 2.2;
sky.material.uniforms.mieCoefficient.value = .007;
sky.material.uniforms.mieDirectionalG.value = .84;
sky.material.uniforms.sunPosition.value.set(-.58, .47, -.65).normalize();
scene.add(sky);
scene.background = null;

const rng = (() => { let s = 76543; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
const rand = (min, max) => min + rng() * (max - min);
const choose = a => a[Math.floor(rng() * a.length)];
const std = (color, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const asphalt = std('#373b3b', 1), pavement = std('#9d9e91'), concrete = std('#aba99b'), white = std('#e2ddca'), amber = std('#d4ac66');
const greenery = [std('#426b48'), std('#346547'), std('#638354')];
const geometry = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 8), sphere: new THREE.SphereGeometry(1, 9, 7) };
const buildings = [], vehicles = [], pedestrians = [];
const highDetailProps=[];
let campaign;
try { campaign = newGame(JSON.parse(localStorage.getItem('gta7-progress-v1') || '{}')); } catch { campaign = newGame(); }

function box(parent, width, height, depth, x, y, z, material, shadow = false) {
  const mesh = new THREE.Mesh(geometry.box, material);
  mesh.position.set(x, y, z); mesh.scale.set(width, height, depth);
  mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, r, height, x, y, z, material, sides = 8) {
  const mesh = new THREE.Mesh(sides === 8 ? geometry.cylinder : new THREE.CylinderGeometry(1, 1, 1, sides), material);
  mesh.position.set(x, y, z); mesh.scale.set(r, height, r); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function texture(draw, width = 512, height = 512) {
  const cvs = document.createElement('canvas'); cvs.width = width; cvs.height = height;
  const cx = cvs.getContext('2d'); draw(cx, width, height);
  const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
const roadTexture = texture((g,w,h) => {
  g.fillStyle = '#444848'; g.fillRect(0,0,w,h);
  for(let i=0;i<11000;i++){ const n=rand(20,90)|0; g.fillStyle=`rgba(${n},${n},${n},${rand(.025,.16)})`;g.fillRect(rand(0,w),rand(0,h),rand(.5,2.5),rand(.5,2.5)); }
});
roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping; roadTexture.repeat.set(30, 30);
const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: .96 });

// Asset-backed PBR materials: procedural maps remain usable if assets are unavailable.
const assetLoader = new THREE.TextureLoader();
async function loadSurface(material, colorPath, normalPath, repeats, urls) {
  const configure = (tex, isColor) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeats, repeats);
    tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  if (urls.has(colorPath)) {
    material.map = configure(await assetLoader.loadAsync(urls.get(colorPath)), true);
    material.needsUpdate = true;
  }
  if (urls.has(normalPath)) {
    material.normalMap = configure(await assetLoader.loadAsync(urls.get(normalPath)), false);
    material.normalScale = new THREE.Vector2(.45, .45);
    material.needsUpdate = true;
  }
}

function facadeTexture(tint, floors = 10, columns = 5) {
  return texture((g,w,h) => {
    g.fillStyle = tint;g.fillRect(0,0,w,h);
    for(let floor=0;floor<floors;floor++)for(let col=0;col<columns;col++){
      const unitW=w/columns, unitH=h/floors, x=col*unitW, y=floor*unitH;
      g.fillStyle='rgba(15,25,28,.18)';g.fillRect(x+3,y+2,unitW-6,unitH-3);
      const lit=rng()<.22;
      g.fillStyle=lit?choose(['#d7bb82','#dac8a3','#aeb9ba']):choose(['#344d55','#4b646a','#526e75']);
      g.fillRect(x+unitW*.17,y+unitH*.16,unitW*.66,unitH*.63);
      g.fillStyle='rgba(230,235,226,.27)';g.fillRect(x+unitW*.49,y+unitH*.16,2,unitH*.63);
      g.fillStyle='rgba(245,245,235,.14)';g.fillRect(x+unitW*.17,y+unitH*.16,unitW*.66,2);
      g.fillStyle='rgba(25,30,32,.42)';g.fillRect(x+unitW*.12,y+unitH*.8,unitW*.76,unitH*.09);
    }
    for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${rand(.005,.025)})`;g.fillRect(rand(0,w),rand(0,h),1,1);}
  });
}
const facadeMats = ['#b4ad9e','#aaaba2','#777f7d','#b3a48e','#879a9c','#c0b4a2','#8f8e8b'].map(t => new THREE.MeshStandardMaterial({map:facadeTexture(t),roughness:.79,metalness:.05}));
const glassMat = std('#304d59', .22, .5), darkMetal = std('#313b3c', .52, .5);

// The road grid is dimensioned in world metres, with building blocks between avenues.
const radius = 4, spacing = 92, streetWidth = 23;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600,1600), std('#7f886a'));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry((radius*2+1)*spacing+70,(radius*2+1)*spacing+70), roadMat);
road.rotation.x=-Math.PI/2;road.position.y=.018;road.receiveShadow=true;scene.add(road);

for(let i=-radius;i<=radius;i++){
  const t=i*spacing;
  box(scene, streetWidth,.09,spacing*(radius*2+1)+60,t,.06,0,asphalt);
  box(scene, spacing*(radius*2+1)+60,.09,streetWidth,0,.06,t,asphalt);
  for(let j=-radius;j<=radius;j++){
    const z=j*spacing;
    if(j<radius){
      for(let k=0;k<5;k++)box(scene,.19,.025,7,t,.13,z+23+k*15,white);
      for(let k=0;k<5;k++)box(scene,7,.025,.19,t+23+k*15,.13,z,white);
    }
    if(j<radius && i<radius) {
      for(let k=0;k<5;k++) { box(scene,.75,.025,2.8,t+14+k*2.7,.12,z+15,white); box(scene,2.8,.025,.75,t+15,.12,z+14+k*2.7,white); }
    }
  }
}

function tree(parent,x,z,scale=1) {
  const trunk=std('#7b624c');cylinder(parent,.28*scale,5.2*scale,x,2.6*scale,z,trunk);
  const crown=new THREE.Mesh(geometry.sphere,choose(greenery));crown.position.set(x,6.2*scale,z);crown.scale.set(2.7*scale,3.2*scale,2.7*scale);crown.castShadow=true;parent.add(crown);
}
function palm(parent,x,z,scale=1) {
  const trunk=std('#9f8564');const stem=cylinder(parent,.24*scale,8*scale,x,4*scale,z,trunk);stem.rotation.z=.07;
  for(let i=0;i<9;i++){
    const a=i*Math.PI*2/9;
    const frond=new THREE.Mesh(new THREE.ConeGeometry(1,1,4),greenery[i%greenery.length]);
    frond.position.set(x+Math.sin(a)*2.1*scale,8.2*scale,z+Math.cos(a)*2.1*scale);
    frond.scale.set(1.2*scale,5.2*scale,.35*scale);frond.rotation.z=Math.PI/2;frond.rotation.y=-a;parent.add(frond);
  }
}
function createBuilding(x,z,w,d,height,style) {
  const group=new THREE.Group();scene.add(group);
  box(group,w,height,d,x,height/2+.5,z,style);
  // Structural relief matters: flat texture-only facades read as cardboard.
  box(group,w+.9,.55,d+.9,x,height+.8,z,concrete);
  box(group,w*.7,1.1,d*.7,x,height+1.5,z,darkMetal);
  box(group,w+.35,.55,d+.35,x,4.6,z,concrete);
  box(group,w+.22,.4,d+.22,x,9,z,concrete);
  for(const side of [-1,1]){
    const front=z+side*(d/2+.09);
    box(group,w*.67,3.55,.2,x,2.32,front,glassMat);
    for(let a=-1;a<=1;a++)box(group,.24,3.65,.32,x+a*w*.22,2.34,front,darkMetal);
    box(group,w*.78,.38,2.15,x,4.25,front+side*.75,concrete);
    box(group,w*.78,.14,2.2,x,4.02,front+side*.75,darkMetal);
  }
  for(const side of [-1,1]) {
    const xEdge=x+side*(w/2+.11);
    for(let level=6;level<height-2;level+=7){
      box(group,.22,.16,d+.22,xEdge,level,z,concrete);
    }
  }
  for(let a=0;a<3;a++){
    const ax=x+rand(-w*.32,w*.32),az=z+rand(-d*.32,d*.32);
    box(group,1.2,.8,1,ax,height+1.5,az,std('#727a79',.83,.25));
  }
  if(height>35){box(group,1.8,4,1.8,x+3,height+3,z-3,darkMetal);}
  if(rng()<.35){box(group,w*.38,1,d*.26,x-w*.15,height+1.8,z+d*.2,concrete);}
  buildings.push({x,z,w,d});
}

for(let i=-radius;i<radius;i++)for(let j=-radius;j<radius;j++){
  const x=(i+.5)*spacing,z=(j+.5)*spacing;
  const block=spacing-streetWidth-5;
  box(scene,block,.32,block,x,.21,z,pavement);
  const commercial=Math.abs(i)<2&&Math.abs(j)<2;
  const park=(i*11+j*7+32)%13===0;
  if(park){
    box(scene,block-8,.15,block-8,x,.46,z,std('#557a54'));
    for(let t=0;t<10;t++)tree(scene,x+rand(-27,27),z+rand(-27,27),rand(.65,1.1));
    box(scene,block-8,.12,2,x,.58,z,pavement);box(scene,2,.12,block-8,x,.58,z,pavement);
  }else{
    const splits=rng()<.58;
    if(splits){
      for(const side of [-1,1]){
        const px=x+side*17;
        const h=commercial?rand(25,85):rand(12,43);
        createBuilding(px,z,27,rand(39,55),h,choose(facadeMats));
      }
    }else{
      const h=commercial?rand(35,118):rand(15,60);
      createBuilding(x,z,rand(38,55),rand(39,55),h,choose(facadeMats));
    }
    for(const side of [-1,1]){
      if(rng()<.72) palm(scene,x+side*(block/2-3),z+rand(-21,21),rand(.66,.9));
    }
  }
}

// Decorative storefront signs, street lamps, bus shelters and roof details establish human scale.
function sign(x,y,z,label,color='#edc287'){
  const tx=texture((g,w,h)=>{g.fillStyle='#1d3136';g.fillRect(0,0,w,h);g.strokeStyle=color;g.lineWidth=8;g.strokeRect(6,6,w-12,h-12);g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font='bold 65px sans-serif';g.fillText(label,w/2,h/2);},512,128);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(15,3.75),new THREE.MeshBasicMaterial({map:tx,side:THREE.DoubleSide}));mesh.position.set(x,y,z);scene.add(mesh);
}
sign(46,5,12,'CAFÉ SOL');sign(-46,6,-17,'MOTEL 77');sign(138,6,12,'MERCADO');
const lamp = std('#4e5b59',.45,.7), bulb = new THREE.MeshBasicMaterial({color:'#f7dfab'});
for(let i=-radius;i<=radius;i++)for(let j=-radius;j<=radius;j++){
  if((i+j)%2!==0)continue;
  const x=i*spacing+15,z=j*spacing+15;
  cylinder(scene,.17,10,x,5,z,lamp);
  box(scene,4,.2,.22,x+1.9,10,z,lamp);
  const light=box(scene,.9,.25,.65,x+3.6,9.75,z,bulb);
  light.castShadow=false;
}

// Street-scale props in the playable starting block; shadows and contact
// geometry prevent the foreground from feeling like a distant scale model.
const roadFurniture=std('#434d4e',.72,.35);
for(const x of [-34,-27,-20,20,27,34]){
  cylinder(scene,.13,1.05,x,.6,13.7,roadFurniture,12);
  cylinder(scene,.13,1.05,x,.6,-13.7,roadFurniture,12);
}
for(const [x,z] of [[-24,18],[27,-18],[20,29]]){
  box(scene,2.4,.22,.9,x,.72,z,concrete,true);
  box(scene,.15,.58,.15,x-.92,.37,z,roadFurniture);
  box(scene,.15,.58,.15,x+.92,.37,z,roadFurniture);
}

const tireMat=std('#171b1c',.95), rimMat=std('#929da0',.4,.6), windshield=std('#28414c',.16,.45);
function carModel(color='#d8d9d1',size=1){
  const group=new THREE.Group();const body=std(color,.28,.52);
  box(group,2.05*size,.65*size,4.4*size,0,.67*size,0,body,true);
  box(group,1.8*size,.66*size,2.2*size,0,1.29*size,-.25*size,body,true);
  box(group,1.67*size,.51*size,.025*size,0,1.34*size,.87*size,windshield);
  box(group,1.68*size,.49*size,.025*size,0,1.34*size,-1.38*size,windshield);
  box(group,.09*size,.5*size,1.8*size,-.92*size,1.33*size,-.25*size,windshield);
  box(group,.09*size,.5*size,1.8*size,.92*size,1.33*size,-.25*size,windshield);
  for(const x of [-1.04,1.04])for(const z of [-1.4,1.4]){
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.43*size,.43*size,.26*size,14),tireMat);
    wheel.rotation.z=Math.PI/2;wheel.position.set(x*size,.46*size,z*size);group.add(wheel);
    const rim=new THREE.Mesh(new THREE.CylinderGeometry(.23*size,.23*size,.27*size,12),rimMat);
    rim.rotation.z=Math.PI/2;rim.position.copy(wheel.position);group.add(rim);
  }
  for(const x of [-.72,.72]){
    box(group,.42*size,.24*size,.05*size,x*size,.85*size,2.22*size,bulb);
    box(group,.42*size,.24*size,.05*size,x*size,.82*size,-2.22*size,std('#a23f3a'));
  }
  group.userData.vehicle=true;return group;
}
const palette=['#d8d5c8','#c5a67c','#425e6c','#bb533d','#2e444b','#f2ebe0','#7f8a6a','#202b30'];
for(let i=0;i<36;i++){
  const vertical=rng()<.5;
  const lane=choose(Array.from({length:radius*2+1},(_,i)=>(i-radius)*spacing));
  const moving=rng()<.75;
  const m=carModel(choose(palette),rand(.88,1.07));
  m.position.set(vertical?lane+(rng()<.5?-5:5):rand(-380,380),0,vertical?rand(-380,380):lane+(rng()<.5?-5:5));
  m.rotation.y=vertical?(rng()<.5?0:Math.PI):(rng()<.5?Math.PI/2:-Math.PI/2);
  m.userData.speed=moving?rand(7,15):0;m.userData.vertical=vertical;
  scene.add(m);vehicles.push(m);
}
// A parked, enterable car by the player's start.
const heroCar=carModel('#e2bf83',1.12);heroCar.position.set(5,0,14);scene.add(heroCar);

// Detailed, independently licensed glTF showcase vehicle. Its parent remains
// the drivable entity; a failed download keeps the procedural vehicle playable.
function installDetailedCar(loaded) {
  const model = loaded.scene;
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.length() < .01) return;
  model.scale.setScalar(4.9 / Math.max(size.x, size.z));
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fitted.min.y;
  model.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
  while (heroCar.children.length) heroCar.remove(heroCar.children[0]);
  heroCar.add(model);
  notice('Vehículo glTF de alta calidad cargado');
}

// Objective visualization: beacon, ground ring and floating waypoint diamond.
const objectiveGroup = new THREE.Group();scene.add(objectiveGroup);
const beamMaterial = new THREE.MeshBasicMaterial({color:'#f4c575',transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.8,2.8,28,24,1,true),beamMaterial);beam.position.y=14;objectiveGroup.add(beam);
const ring = new THREE.Mesh(new THREE.RingGeometry(3.3,4.2,42),new THREE.MeshBasicMaterial({color:'#ffdc92',side:THREE.DoubleSide,transparent:true,opacity:.9}));ring.rotation.x=-Math.PI/2;ring.position.y=.18;objectiveGroup.add(ring);
const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(1.9),new THREE.MeshBasicMaterial({color:'#ffd18a'}));diamond.position.y=7;objectiveGroup.add(diamond);
const routeLineMaterial = new THREE.LineDashedMaterial({color:'#edc185',dashSize:3,gapSize:2,transparent:true,opacity:.7});
const routeLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),routeLineMaterial);scene.add(routeLine);

function person(color='#d9b4a1'){
  const g=new THREE.Group();
  const trousers=std('#272f38'), shirt=std(color), skin=std('#b98b6d');
  box(g,.62,.91,.35,0,1.37,0,shirt,true);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.24,10,8),skin);head.position.y=2.1;head.castShadow=true;g.add(head);
  for(const x of [-.18,.18])box(g,.2,.9,.24,x,.47,0,trousers,true);
  for(const x of [-.42,.42])box(g,.16,.8,.23,x,1.28,0,shirt,true);
  return g;
}
const player=person('#e5e1d6');player.position.set(0,0,0);scene.add(player);
const motor=createMotor(0,0);
let characterMixer=null,walkAction=null;
function installCharacter(loaded) {
  const model=loaded.scene;
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<.01)throw Error('Modelo humano sin geometría válida');
  model.scale.setScalar(2.12/size.y);
  model.updateMatrixWorld(true);
  const fitted=new THREE.Box3().setFromObject(model);
  const center=fitted.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-fitted.min.y,-center.z);
  model.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  while(player.children.length)player.remove(player.children[0]);
  player.add(model);
  if(loaded.animations.length){
    characterMixer=new THREE.AnimationMixer(model);
    walkAction=characterMixer.clipAction(loaded.animations[0]);
    walkAction.play();
    walkAction.paused=true;
  }
}
function installUrbanDetail(loaded) {
  const source=loaded.scene;
  const bounds=new THREE.Box3().setFromObject(source);
  const dimensions=bounds.getSize(new THREE.Vector3());
  if(dimensions.length()<.01)throw Error('Fachada urbana vacía');
  const fit=Math.min(26/Math.max(dimensions.x,dimensions.z),32/dimensions.y);
  source.scale.setScalar(fit);
  source.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(source),center=box.getCenter(new THREE.Vector3());
  source.position.set(-center.x,-box.min.y,-center.z);
  source.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});
  for(const [x,z,rotation] of [[29,19,0],[-30,-19,Math.PI],[29,-19,Math.PI],[-30,19,0]]){
    const instance=source.clone(true),root=new THREE.Group();
    root.position.set(x,.3,z);root.rotation.y=rotation;root.add(instance);scene.add(root);highDetailProps.push(root);
  }
}
function installStreetLamps(loaded) {
  const source=loaded.scene,dimensions=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
  if(dimensions.y<.01)throw Error('Farola sin altura');
  source.scale.setScalar(9/dimensions.y);
  source.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(source),c=b.getCenter(new THREE.Vector3());
  source.position.set(-c.x,-b.min.y,-c.z);
  for(const [x,z] of [[16,16],[-16,16],[16,-16],[-16,-16]]){
    const root=new THREE.Group();root.position.set(x,.3,z);root.add(source.clone(true));scene.add(root);highDetailProps.push(root);
  }
}
const world=createWorld(53,60);
for(let i=0;i<world.agents.length;i++){
  const model=person(choose(['#c8a68d','#cf6651','#8f9d9b','#b7b39f','#556e85','#8e9c76']));
  model.scale.setScalar(rand(.82,1.05));scene.add(model);pedestrians.push(model);
}

let qualityHigh=true, timeMode=0, trafficEnabled=true, soundEnabled=false, driving=false, cameraMode=0;
let yaw=.45,pitch=.31,distance=12, velocity=0, steer=0;
const keys=new Set();let pointerDown=false,lastPointer={x:0,y:0};
const touch={x:0,y:0,run:false};
let previousActions={};
const active = () => driving ? heroCar : player;
const notice = message => { $('notice').textContent=message;$('notice').classList.add('show');clearTimeout(notice._t);notice._t=setTimeout(()=>$('notice').classList.remove('show'),2600); };
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

function blocked(x,z){
  if(Math.abs(x)>390 || Math.abs(z)>390)return true;
  return buildings.some(b=>Math.abs(x-b.x)<b.w/2+1.1&&Math.abs(z-b.z)<b.d/2+1.1);
}
function move(dt, input){
  const obj=active();
  if(driving){
    const accel=input.forward>=0?input.forward*24:input.forward*30;
    velocity+=accel*dt;velocity*=Math.pow(.986,dt*60);velocity=THREE.MathUtils.clamp(velocity,-12,34);
    steer=THREE.MathUtils.lerp(steer,-input.sideways,Math.min(1,dt*7));
    obj.rotation.y+=steer*velocity*dt*.035;
    const dir=new THREE.Vector3(Math.sin(obj.rotation.y),0,Math.cos(obj.rotation.y));
    const target=obj.position.clone().addScaledVector(dir,velocity*dt);
    if(!blocked(target.x,target.z))obj.position.copy(target);else velocity=0;
    player.visible=false;
    $('speedValue').textContent=Math.round(Math.abs(velocity)*3.6);
  }else{
    stepMotor(motor,input,yaw,dt,blocked);
    obj.position.set(motor.x,0,motor.z);
    obj.rotation.y=motor.heading;
    if(walkAction){walkAction.paused=!motor.moving;walkAction.timeScale=THREE.MathUtils.clamp(motor.speed/4.4,.5,1.8);}
    characterMixer?.update(dt);
    $('speedValue').textContent=Math.round(motor.speed*3.6);
  }
  const focus=obj.position.clone().add(new THREE.Vector3(0,driving?1.5:1.6,0));
  const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance+1,Math.cos(yaw)*Math.cos(pitch)*distance);
  if(cameraMode===1){offset.multiplyScalar(.45);}else if(cameraMode===2){offset.set(0,30,.1);}
  if(cameraMode!==2){
    const end=focus.clone().add(offset);
    offset.multiplyScalar(cameraClearance(focus,end,buildings));
  }
  camera.position.lerp(focus.clone().add(offset),Math.min(1,dt*7));camera.lookAt(focus);
  sun.position.set(obj.position.x-150,180,obj.position.z-120);
  sun.target.position.copy(obj.position);
}

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
function action(type){
  if(type==='vehicle'){
    if(driving){driving=false;player.visible=true;player.position.copy(heroCar.position).add(new THREE.Vector3(2.6,0,0));motor.x=player.position.x;motor.z=player.position.z;motor.vx=motor.vz=0;velocity=0;notice('Has bajado del vehículo');}
    else if(player.position.distanceTo(heroCar.position)<8){driving=true;notice('Vehículo: WASD conducir · E salir');}
    else notice('Acércate al vehículo dorado para conducirlo');
  }
  if(type==='interact'){
    const result=interact(campaign,{x:active().position.x,z:active().position.z});
    if(!result){notice('Acércate al marcador amarillo para interactuar');}
    else if(result.type==='accepted')notice(`Nuevo contrato: ${result.job.title} · $${result.job.reward}`);
    else if(result.type==='collected')notice('Paquete recogido. ¡Llévalo al destino!');
    else if(result.type==='completed'){
      notice(`¡Entrega completada! +$${result.job.reward}`);
      try {localStorage.setItem('gta7-progress-v1',JSON.stringify(saveProgress(campaign)));} catch {}
    }
    refreshMission();
  }
  if(type==='incident'){const p=active().position;world.player.x=p.x+630;world.player.y=p.z+630;const event=incident(world);notice(`Incidente registrado · ${event.witnesses.length} testigos`);}
  if(type==='camera')$('view').click();
}
document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if(!e.repeat && key==='e')action('vehicle');
  if(!e.repeat && key==='f')action('interact');
  if(!e.repeat && key===' ')action('incident');
  keys.add(key);
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
canvas.addEventListener('pointerdown',e=>{pointerDown=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',()=>pointerDown=false);
canvas.addEventListener('pointermove',e=>{if(!pointerDown)return;yaw+=(lastPointer.x-e.clientX)*.005;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastPointer.y)*.003,.08,1.22);lastPointer={x:e.clientX,y:e.clientY};});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.018,5,30);},{passive:false});

// Touch: one bounded analog stick, a separate camera drag zone and distinct
// action buttons. Pointer capture keeps gestures stable across screen edges.
const joystick=$('joystick'),stick=$('stick');
function updateJoystick(event) {
  const r=joystick.getBoundingClientRect();
  const x=event.clientX-(r.left+r.width/2),y=event.clientY-(r.top+r.height/2);
  const radius=r.width*.34,scale=Math.max(1,Math.hypot(x,y)/radius);
  touch.x=x/scale/radius;touch.y=-y/scale/radius;
  stick.style.transform=`translate(${x/scale}px,${y/scale}px)`;
}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();joystick.setPointerCapture(e.pointerId);updateJoystick(e);});
joystick.addEventListener('pointermove',e=>{if(joystick.hasPointerCapture(e.pointerId))updateJoystick(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{touch.x=0;touch.y=0;stick.style.transform='';});
const touchLook=$('touchLook');let lookPointer=null;
touchLook.addEventListener('pointerdown',e=>{e.preventDefault();touchLook.setPointerCapture(e.pointerId);lookPointer={x:e.clientX,y:e.clientY};});
touchLook.addEventListener('pointermove',e=>{if(!lookPointer||!touchLook.hasPointerCapture(e.pointerId))return;yaw+=(lookPointer.x-e.clientX)*.006;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lookPointer.y)*.004,.08,1.22);lookPointer={x:e.clientX,y:e.clientY};});
for(const type of ['pointerup','pointercancel','lostpointercapture'])touchLook.addEventListener(type,()=>lookPointer=null);
$('touchVehicle').addEventListener('pointerdown',e=>{e.preventDefault();action('vehicle');});
$('touchInteract').addEventListener('pointerdown',e=>{e.preventDefault();action('interact');});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('touchRun').addEventListener(type,()=>touch.run=false);
$('touchRun').addEventListener('pointerdown',e=>{e.preventDefault();touch.run=true;});
$('view').onclick=()=>{cameraMode=(cameraMode+1)%3;notice(['Cámara tercera persona','Cámara cercana','Cámara aérea'][cameraMode]);};
$('time').onclick=()=>{timeMode=(timeMode+1)%3;
  const configs=[['#9caeb5','#a7ada7','#ffe4b5',3.5,1.35],['#b8c7d2','#c8c8bc','#fff6e2',4.1,1.55],['#1a2b44','#293345','#a9b9ea',.45,.88]];
  const [bg,fog,sunColor,power,exposure]=configs[timeMode];scene.fog.color.set(fog);sun.color.set(sunColor);sun.intensity=power;renderer.toneMappingExposure=exposure;
  sky.material.uniforms.sunPosition.value.set(...[[-.58,.47,-.65],[-.5,.88,-.2],[-.57,-.08,-.6]][timeMode]).normalize();
  sky.material.uniforms.rayleigh.value=timeMode===2?.15:2.2;
  ambient.intensity=timeMode===2?.45:1.45;
  $('time').textContent=['☀ ATARDECER','☀ MEDIODÍA','☾ NOCHE'][timeMode];
};
$('traffic').onclick=()=>{trafficEnabled=!trafficEnabled;$('traffic').textContent='♢ TRÁFICO: '+(trafficEnabled?'ON':'OFF');};
$('quality').onclick=()=>{qualityHigh=!qualityHigh;renderer.setPixelRatio(Math.min(devicePixelRatio,qualityHigh?(mobileGpu?1.15:1.65):1));renderer.shadowMap.enabled=qualityHigh;renderer.shadowMap.needsUpdate=true;resize();$('quality').textContent='CALIDAD: '+(qualityHigh?'ALTA':'MEDIA');notice('Calidad '+(qualityHigh?'alta':'media'));};
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').textContent='♫ '+(soundEnabled?'ON':'OFF');notice('Audio ambiental '+(soundEnabled?'activado (próximamente)':'desactivado'));};

const map=$('map'),mc=map.getContext('2d');
function updateMap(){
  const w=180;mc.clearRect(0,0,w,w);mc.fillStyle='#243b3c';mc.fillRect(0,0,w,w);
  const p=active().position,scale=.2;
  for(let i=-radius;i<=radius;i++){
    mc.strokeStyle='#8c9e91';mc.lineWidth=4;mc.beginPath();mc.moveTo(90+(-radius*spacing-p.x)*scale,90+(i*spacing-p.z)*scale);mc.lineTo(90+(radius*spacing-p.x)*scale,90+(i*spacing-p.z)*scale);mc.stroke();
    mc.beginPath();mc.moveTo(90+(i*spacing-p.x)*scale,90+(-radius*spacing-p.z)*scale);mc.lineTo(90+(i*spacing-p.x)*scale,90+(radius*spacing-p.z)*scale);mc.stroke();
  }
  mc.fillStyle='#d3b789';for(const b of buildings)mc.fillRect(90+(b.x-b.w/2-p.x)*scale,90+(b.z-b.d/2-p.z)*scale,b.w*scale,b.d*scale);
  mc.fillStyle='#f3c67e';mc.beginPath();mc.arc(90,90,4,0,Math.PI*2);mc.fill();
  const goal=objective(campaign);mc.fillStyle='#ffe0a0';mc.beginPath();mc.arc(90+(goal.x-p.x)*scale,90+(goal.z-p.z)*scale,5,0,Math.PI*2);mc.fill();
  $('coords').textContent=`${Math.round(p.x+400)} · ${Math.round(p.z+400)}`;
}
function refreshMission(){
  const job=activeJob(campaign), target=objective(campaign), position=active().position;
  const distance=Math.round(distanceTo({x:position.x,z:position.z},target));
  $('wallet').textContent='$'+campaign.cash.toLocaleString('es-EC');
  $('missionState').textContent=job?(campaign.stage==='pickup'?'CONTRATO / RECOGIDA':'CONTRATO / ENTREGA'):'CONTRATOS / DISPONIBLE';
  $('missionName').textContent=job?job.title:'Tu próximo encargo';
  $('missionDetail').textContent=job?(campaign.stage==='pickup'?'Conduce hasta el punto amarillo y pulsa F para recoger el paquete.':'Lleva el paquete al destino y pulsa F para completar la entrega.'):
    'Acércate al marcador amarillo y pulsa F para aceptar un trabajo. Completa entregas para ganar dinero.';
  $('missionDistance').textContent=target.text.toUpperCase()+' · '+distance+' m';
  $('missionTime').textContent=job?Math.floor(campaign.secondsLeft/60)+':'+String(Math.floor(campaign.secondsLeft%60)).padStart(2,'0'):'F · INTERACTUAR';
  $('missionProgress').style.width=job?Math.max(0,campaign.secondsLeft/job.seconds*100)+'%':'100%';
  objectiveGroup.position.set(target.x,0,target.z);
  const roadPosition=new THREE.Vector3(position.x,1.2,position.z),goalPosition=new THREE.Vector3(target.x,1.2,target.z);
  routeLine.geometry.dispose();routeLine.geometry=new THREE.BufferGeometry().setFromPoints([roadPosition,goalPosition]);routeLine.computeLineDistances();
}
let previous=performance.now(),mapTimer=0;
function animate(now){
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  const pad=readGamepad(navigator.getGamepads?.());
  const input=movement(keys,pad,touch);
  move(dt,input);
  const focusPosition=active().position;
  for(const prop of highDetailProps)prop.visible=prop.position.distanceToSquared(focusPosition)<140*140;
  yaw-=pad.lookX*dt*2.5;
  pitch=THREE.MathUtils.clamp(pitch+pad.lookY*dt*1.5,.08,1.22);
  for(const [name,pressed] of Object.entries(pad.actions))if(pressed&&!previousActions[name])action(name);
  previousActions=pad.actions;
  const jobEvent=tickGame(campaign,dt);
  if(jobEvent){notice(`Tiempo agotado: ${jobEvent.job.title}`);refreshMission();}
  if(trafficEnabled){for(const car of vehicles){if(!car.userData.speed)continue;const forward=new THREE.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));car.position.addScaledVector(forward,car.userData.speed*dt);if(Math.abs(car.position.x)>395)car.position.x*=-.98;if(Math.abs(car.position.z)>395)car.position.z*=-.98;}}
  step(world,1/30);
  for(let i=0;i<pedestrians.length;i++){const a=world.agents[i],m=pedestrians[i];m.position.set((a.x-630)*.60,0,(a.y-630)*.60);}
  diamond.rotation.y+=dt*1.2;diamond.position.y=7+Math.sin(now*.002)*.7;ring.rotation.z+=dt*.6;
  mapTimer+=dt;if(mapTimer>.2){updateMap();refreshMission();mapTimer=0;}
  renderer.render(scene,camera);requestAnimationFrame(animate);
}
const loadElement = $('loading');
let gameStarted = false;
function startGame() {
  if(gameStarted)return;
  gameStarted = true;
  $('loadContinue').hidden = true;
  resize();
  previous = performance.now();
  renderer.render(scene,camera);
  loadElement.classList.add('hidden');
  requestAnimationFrame(animate);
}
function loadingError(message) {
  $('loadMessage').textContent = 'Algunos recursos no pudieron cargarse';
  $('loadError').textContent = message;
  $('loadError').hidden = false;
  $('loadRetry').hidden = false;
  $('loadContinue').hidden = false;
}
$('loadContinue').onclick = () => { notice('Modo de compatibilidad: recursos no disponibles'); startGame(); };
async function bootVisuals() {
  const urls = new Map();
  try {
    const result = await fetchVisualAssets('./assets/manifest.json', {
      onProgress: progress => {
        const percent = Math.min(100, Math.round(progress.loaded / progress.total * 100));
        $('loadFill').style.width = `${percent}%`;
        $('loadPercent').textContent = `${percent}%`;
        loadElement.querySelector('[role=progressbar]').setAttribute('aria-valuenow', String(percent));
        $('loadMessage').textContent = progress.completed === progress.count ? 'Preparando recursos gráficos…' : `Descargando: ${progress.name}`;
        $('loadBytes').textContent = `${(progress.loaded / 1048576).toFixed(1)} / ${(progress.total / 1048576).toFixed(1)} MiB · ${progress.completed}/${progress.count} archivos`;
      },
    });
    for (const [name, data] of result.files) {
      const type = name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.hdr') ? 'application/octet-stream' : 'model/gltf-binary';
      urls.set(name, URL.createObjectURL(new Blob([data], { type })));
    }
    $('loadMessage').textContent = 'Decodificando materiales y vehículo 3D…';
    const tasks = [
      loadSurface(roadMat, 'asphalt-color.jpg', 'asphalt-normal.jpg', 55, urls),
      loadSurface(pavement, 'pavement-color.jpg', 'pavement-normal.jpg', 9, urls),
      loadSurface(concrete, 'concrete-color.jpg', 'concrete-normal.jpg', 4, urls),
    ];
    if (urls.has('sunset.hdr')) tasks.push(new RGBELoader().loadAsync(urls.get('sunset.hdr')).then(hdr => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = hdr;
      scene.environmentIntensity = .78;
    }));
    if (result.files.has('concept-car.glb')) {
      const data = result.files.get('concept-car.glb');
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      tasks.push(new GLTFLoader().parseAsync(buffer, '').then(installDetailedCar));
    }
    for(const [name,installer] of [['cesium-man.glb',installCharacter],['urban-facade.glb',installUrbanDetail],['street-lamp.glb',installStreetLamps]]){
      if(!result.files.has(name))continue;
      const data=result.files.get(name),buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
      tasks.push(new GLTFLoader().parseAsync(buffer,'').then(installer));
    }
    const settled = await Promise.allSettled(tasks);
    const failures = [...result.errors, ...settled.filter(s => s.status === 'rejected').map(s => s.reason?.message || String(s.reason))];
    if (failures.length) loadingError(failures.join(' · '));
    else startGame();
  } catch (error) {
    loadingError('No se pudieron descargar los recursos: ' + error.message);
  } finally {
    for (const url of urls.values()) URL.revokeObjectURL(url);
  }
}
bootVisuals();
setTimeout(()=>document.querySelector('.location').style.opacity='.16',6500);
