/* WebGL point-sprite renderer: one GPU point per solver particle, state read from the engine buffers every frame. */
(function (root) {
'use strict';
const VS = `attribute vec2 aPos; attribute float aMat; attribute float aDmg; attribute float aSpd;
uniform vec2 uCenter; uniform vec2 uRes; uniform float uScale; uniform float uSize; uniform float uMode; uniform float uVmax;
varying vec3 vCol; varying float vSolid;
vec3 ramp(float t){ t=clamp(t,0.0,1.0); vec3 a=vec3(0.10,0.13,0.18), b=vec3(0.90,0.64,0.24), c=vec3(1.0,0.97,0.88); return t<0.5?mix(a,b,t*2.0):mix(b,c,(t-0.5)*2.0); }
void main(){
  vec2 p=(aPos-uCenter)*uScale; gl_Position=vec4(p.x/uRes.x*2.0, p.y/uRes.y*2.0, 0.0, 1.0);
  float sz=max(uSize*uScale, 1.7); gl_PointSize=sz; vSolid = sz<3.2 ? 1.0 : 0.0;
  vec3 plate=vec3(0.50,0.56,0.64), proj=vec3(0.90,0.64,0.24), clamp_=vec3(0.28,0.31,0.36);
  vec3 base = aMat>1.5 ? clamp_ : (aMat>0.5 ? proj : plate);
  if(uMode<0.5){ vCol = base*(1.0-0.75*aDmg); }
  else if(uMode<1.5){ vCol = aMat>1.5 ? vec3(0.45,0.38,0.62) : (aMat>0.5 ? vec3(0.90,0.64,0.24) : vec3(0.30,0.62,0.75)); }
  else if(uMode<2.5){ vCol = ramp(aDmg); }
  else { vCol = ramp(aSpd/uVmax); }
}`;
const FS = `precision mediump float; varying vec3 vCol; varying float vSolid;
void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); float a=1.0;
  if(vSolid<0.5){ a=1.0-smoothstep(0.42,0.5,r); if(a<=0.0) discard; }
  gl_FragColor=vec4(vCol,1.0)*a; }`;
class Renderer {
  constructor(canvas) {
    this.c = canvas;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr; this.loc = {}; ['aPos', 'aMat', 'aDmg', 'aSpd'].forEach(n => this.loc[n] = gl.getAttribLocation(pr, n));
    this.u = {}; ['uCenter', 'uRes', 'uScale', 'uSize', 'uMode', 'uVmax'].forEach(n => this.u[n] = gl.getUniformLocation(pr, n));
    this.buf = { pos: gl.createBuffer(), mat: gl.createBuffer(), dmg: gl.createBuffer(), spd: gl.createBuffer() };
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  draw(sim, cam, mode, vmax, w, h) {
    const gl = this.gl; gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.pr);
    const up = (b, loc, arr, sz) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, sz, gl.FLOAT, false, 0, 0); };
    up(this.buf.pos, this.loc.aPos, sim.rPos, 2); up(this.buf.mat, this.loc.aMat, sim.rMat, 1); up(this.buf.dmg, this.loc.aDmg, sim.rDmg, 1); up(this.buf.spd, this.loc.aSpd, sim.rSpd, 1);
    gl.uniform2f(this.u.uCenter, cam.cx, cam.cy); gl.uniform2f(this.u.uRes, w / 2, h / 2); gl.uniform1f(this.u.uScale, cam.scale);
    // disc diameter = 0.92 * lattice spacing: visible gaps at high zoom, no inflation of radii at low zoom beyond a 1.7 px floor
    gl.uniform1f(this.u.uSize, sim.h * 0.98); gl.uniform1f(this.u.uMode, mode); gl.uniform1f(this.u.uVmax, vmax);
    gl.drawArrays(gl.POINTS, 0, sim.n);
  }
}
root.ALRenderer = Renderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
