import * as THREE from 'three';
import { createWorld, step, incident } from './simulation.js';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9caeb5');
scene.fog = new THREE.FogExp2('#a7ada7', 0.00165);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
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

const rng = (() => { let s = 76543; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
const rand = (min, max) => min + rng() * (max - min);
const choose = a => a[Math.floor(rng() * a.length)];
const std = (color, roughness = .85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const asphalt = std('#373b3b', 1), pavement = std('#9d9e91'), white = std('#e2ddca'), amber = std('#d4ac66');
const greenery = [std('#426b48'), std('#346547'), std('#638354')];
const geometry = { box: new THREE.BoxGeometry(1, 1, 1), cylinder: new THREE.CylinderGeometry(1, 1, 1, 8), sphere: new THREE.SphereGeometry(1, 9, 7) };
const buildings = [], vehicles = [], pedestrians = [];

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
const glassMat = std('#304d59', .22, .5), concrete = std('#aba99b'), darkMetal = std('#313b3c', .52, .5);

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
  box(group,w+1,.6,d+1,x,height+.8,z,concrete);
  box(group,w*.7,1.1,d*.7,x,height+1.5,z,darkMetal);
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
const world=createWorld(53,60);
for(let i=0;i<world.agents.length;i++){
  const model=person(choose(['#c8a68d','#cf6651','#8f9d9b','#b7b39f','#556e85','#8e9c76']));
  model.scale.setScalar(rand(.82,1.05));scene.add(model);pedestrians.push(model);
}

let qualityHigh=true, timeMode=0, trafficEnabled=true, soundEnabled=false, driving=false, cameraMode=0;
let yaw=.45,pitch=.31,distance=12, velocity=0, steer=0;
const keys=new Set();let pointerDown=false,lastPointer={x:0,y:0};
const active = () => driving ? heroCar : player;
const notice = message => { $('notice').textContent=message;$('notice').classList.add('show');clearTimeout(notice._t);notice._t=setTimeout(()=>$('notice').classList.remove('show'),2600); };
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

function blocked(x,z){
  if(Math.abs(x)>390 || Math.abs(z)>390)return true;
  return buildings.some(b=>Math.abs(x-b.x)<b.w/2+1.1&&Math.abs(z-b.z)<b.d/2+1.1);
}
function move(dt){
  const obj=active();
  if(driving){
    const accel=(keys.has('w')||keys.has('arrowup')?24:0)-(keys.has('s')||keys.has('arrowdown')?30:0);
    velocity+=accel*dt;velocity*=Math.pow(.986,dt*60);velocity=THREE.MathUtils.clamp(velocity,-12,34);
    steer=THREE.MathUtils.lerp(steer,Number(keys.has('a')||keys.has('arrowleft'))-Number(keys.has('d')||keys.has('arrowright')),Math.min(1,dt*7));
    obj.rotation.y+=steer*velocity*dt*.035;
    const dir=new THREE.Vector3(Math.sin(obj.rotation.y),0,Math.cos(obj.rotation.y));
    const target=obj.position.clone().addScaledVector(dir,velocity*dt);
    if(!blocked(target.x,target.z))obj.position.copy(target);else velocity=0;
    player.visible=false;
    $('speedValue').textContent=Math.round(Math.abs(velocity)*3.6);
  }else{
    let forward=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'));
    let sideways=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
    const length=Math.hypot(forward,sideways);
    if(length){
      forward/=length;sideways/=length;
      const dx=Math.sin(yaw)*forward+Math.cos(yaw)*sideways;
      const dz=Math.cos(yaw)*forward-Math.sin(yaw)*sideways;
      const speed=keys.has('shift')?9:5;
      const nx=obj.position.x+dx*speed*dt,nz=obj.position.z+dz*speed*dt;
      if(!blocked(nx,obj.position.z))obj.position.x=nx;
      if(!blocked(obj.position.x,nz))obj.position.z=nz;
      obj.rotation.y=THREE.MathUtils.lerp(obj.rotation.y,Math.atan2(dx,dz),Math.min(1,dt*11));
    }
    $('speedValue').textContent=length?(keys.has('shift')?'32':'18'):'0';
  }
  const focus=obj.position.clone().add(new THREE.Vector3(0,driving?1.5:1.6,0));
  const offset=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance+1,Math.cos(yaw)*Math.cos(pitch)*distance);
  if(cameraMode===1){offset.multiplyScalar(.45);}else if(cameraMode===2){offset.set(0,30,.1);}
  camera.position.lerp(focus.clone().add(offset),Math.min(1,dt*7));camera.lookAt(focus);
  sun.position.set(obj.position.x-150,180,obj.position.z-120);
  sun.target.position.copy(obj.position);
}

function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);resize();
document.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();
  if(key==='e'&&!e.repeat){
    if(driving){driving=false;player.visible=true;player.position.copy(heroCar.position).add(new THREE.Vector3(2.6,0,0));velocity=0;notice('Has bajado del vehículo');}
    else if(player.position.distanceTo(heroCar.position)<8){driving=true;notice('Vehículo: WASD conducir · E salir');}
    else notice('Acércate al vehículo dorado para conducirlo');
  }
  if(key===' '&&!e.repeat){const p=active().position;world.player.x=p.x+630;world.player.y=p.z+630;const event=incident(world);notice(`Incidente registrado · ${event.witnesses.length} testigos`);}
  keys.add(key);
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>keys.clear());
canvas.addEventListener('pointerdown',e=>{pointerDown=true;lastPointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointerup',()=>pointerDown=false);
canvas.addEventListener('pointermove',e=>{if(!pointerDown)return;yaw+=(lastPointer.x-e.clientX)*.005;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-lastPointer.y)*.003,.08,1.22);lastPointer={x:e.clientX,y:e.clientY};});
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.018,5,30);},{passive:false});
$('view').onclick=()=>{cameraMode=(cameraMode+1)%3;notice(['Cámara tercera persona','Cámara cercana','Cámara aérea'][cameraMode]);};
$('time').onclick=()=>{timeMode=(timeMode+1)%3;
  const configs=[['#9caeb5','#a7ada7','#ffe4b5',3.5,1.35],['#b8c7d2','#c8c8bc','#fff6e2',4.1,1.55],['#1a2b44','#293345','#a9b9ea',.45,.88]];
  const [bg,fog,sunColor,power,exposure]=configs[timeMode];scene.background.set(bg);scene.fog.color.set(fog);sun.color.set(sunColor);sun.intensity=power;renderer.toneMappingExposure=exposure;
  $('time').textContent=['☀ ATARDECER','☀ MEDIODÍA','☾ NOCHE'][timeMode];
};
$('traffic').onclick=()=>{trafficEnabled=!trafficEnabled;$('traffic').textContent='♢ TRÁFICO: '+(trafficEnabled?'ON':'OFF');};
$('quality').onclick=()=>{qualityHigh=!qualityHigh;renderer.setPixelRatio(Math.min(devicePixelRatio,qualityHigh?1.7:1));renderer.shadowMap.enabled=qualityHigh;renderer.shadowMap.needsUpdate=true;resize();$('quality').textContent='CALIDAD: '+(qualityHigh?'ALTA':'MEDIA');notice('Calidad '+(qualityHigh?'alta':'media'));};
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
  $('coords').textContent=`${Math.round(p.x+400)} · ${Math.round(p.z+400)}`;
}
let previous=performance.now(),mapTimer=0;
function animate(now){
  const dt=Math.min((now-previous)/1000,.05);previous=now;
  move(dt);
  if(trafficEnabled){for(const car of vehicles){if(!car.userData.speed)continue;const forward=new THREE.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));car.position.addScaledVector(forward,car.userData.speed*dt);if(Math.abs(car.position.x)>395)car.position.x*=-.98;if(Math.abs(car.position.z)>395)car.position.z*=-.98;}}
  step(world,1/30);
  for(let i=0;i<pedestrians.length;i++){const a=world.agents[i],m=pedestrians[i];m.position.set((a.x-630)*.60,0,(a.y-630)*.60);}
  mapTimer+=dt;if(mapTimer>.25){updateMap();mapTimer=0;}
  renderer.render(scene,camera);requestAnimationFrame(animate);
}
resize();requestAnimationFrame(animate);
setTimeout(()=>$('loading').classList.add('hidden'),550);
setTimeout(()=>document.querySelector('.location').style.opacity='.16',6500);
window.addEventListener('error',e=>{const loading=$('loading');if(loading&&!loading.classList.contains('hidden'))loading.querySelector('p').textContent='Error gráfico: '+e.message;});
