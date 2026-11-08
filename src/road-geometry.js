// Planar ribbon mesh following OSM polylines. Vertex height is sampled at the
// actual cross-section, avoiding the tilted, overlapping rectangular slabs.
// No Three.js dependency: geometry can be validated in Node before publishing.
export function roadRibbon(points, width, elevation = () => 0, lift = .14) {
  if (!Array.isArray(points) || points.length < 2 || !(width > 0)) return null;
  const clean=[];
  for(const point of points){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.z))continue;
    const previous=clean.at(-1);
    if(!previous||Math.hypot(previous.x-point.x,previous.z-point.z)>.25)clean.push(point);
  }
  if(clean.length<2)return null;
  const vertices=[],uv=[],indices=[];
  let distance=0;
  for(let i=0;i<clean.length;i++){
    const p=clean[i],prev=clean[Math.max(0,i-1)],next=clean[Math.min(clean.length-1,i+1)];
    const incoming={x:p.x-prev.x,z:p.z-prev.z},outgoing={x:next.x-p.x,z:next.z-p.z};
    const il=Math.hypot(incoming.x,incoming.z),ol=Math.hypot(outgoing.x,outgoing.z);
    const ni=il>0?{x:-incoming.z/il,z:incoming.x/il}:null;
    const no=ol>0?{x:-outgoing.z/ol,z:outgoing.x/ol}:null;
    const normal=ni&&no?{x:ni.x+no.x,z:ni.z+no.z}:(ni||no);
    const nl=Math.hypot(normal.x,normal.z);
    if(nl<.001)continue;
    const n={x:normal.x/nl,z:normal.z/nl};
    // Clamp miters at sharp turns, avoiding huge triangular spikes.
    const dot=ni&&no?Math.max(.45,n.x*no.x+n.z*no.z):1;
    const half=width*.5/Math.max(dot,.65);
    if(i>0)distance+=Math.hypot(p.x-prev.x,p.z-prev.z);
    for(const side of [-1,1]){
      const x=p.x+n.x*half*side,z=p.z+n.z*half*side;
      vertices.push(x,elevation(x,z)+lift,z);
      uv.push(side===-1?0:1,distance/4);
    }
  }
  const sections=vertices.length/6;
  for(let i=1;i<sections;i++){
    const a=(i-1)*2,b=i*2;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  return {vertices,uv,indices};
}

export function combineRoadRibbons(roads, getWidth, elevation){
  const vertices=[],uv=[],indices=[];
  for(const road of roads){
    const ribbon=roadRibbon(road.points,getWidth(road),elevation);
    if(!ribbon)continue;
    const base=vertices.length/3;
    vertices.push(...ribbon.vertices);uv.push(...ribbon.uv);
    for(const index of ribbon.indices)indices.push(base+index);
  }
  return {vertices,uv,indices};
}
