"use strict";window.pickBg=function(c,n,l){const m=new Map,B=(f,u,i)=>{const v=f>>4<<8|u>>4<<4|i>>4,y=m.get(v);y?(y[0]+=f,y[1]+=u,y[2]+=i,y[3]++):m.set(v,[f,u,i,1])},U=(f,u)=>{const i=(u*n+f)*4;c[i+3]>8&&B(c[i],c[i+1],c[i+2])},b=Math.max(1,n/220|0),N=Math.max(1,l/220|0),I=Math.max(2,Math.round(Math.min(n,l)*.012));for(let f=0;f<n;f+=b)for(let u=0;u<I;u++)U(f,u),U(f,l-1-u);for(let f=0;f<l;f+=N)for(let u=0;u<I;u++)U(u,f),U(n-1-u,f);let k=null;for(const f of m.values())(!k||f[3]>k[3])&&(k=f);return k?[Math.round(k[0]/k[3]),Math.round(k[1]/k[3]),Math.round(k[2]/k[3])]:[255,255,255]},window.cutBg=function(c,n,l,m){const B=Math.max(0,Math.min(90,m.tol|0)),U=m.key||window.pickBg(c,n,l),b=U[0],N=U[1],I=U[2],k=16+B*.22,f=k+10+B*.95,u=1+Math.round(B/11),i=n*l,v=new Uint8Array(i);for(let t=0,o=0;t<i;t++,o+=4){if(c[o+3]<8){v[t]=0;continue}const r=Math.abs(c[o]-b),e=Math.abs(c[o+1]-N),h=Math.abs(c[o+2]-I),a=r>e?r>h?r:h:e>h?e:h;v[t]=a>255?255:a}const y=new Uint8Array(i),T=new Int32Array(i);let C=0;const A=t=>{!y[t]&&v[t]<=k&&(y[t]=1,T[C++]=t)};for(let t=0;t<n;t++)A(t),A((l-1)*n+t);for(let t=0;t<l;t++)A(t*n),A(t*n+n-1);for(;C>0;){const t=T[--C],o=t%n;o>0&&A(t-1),o<n-1&&A(t+1),t>=n&&A(t-n),t<i-n&&A(t+n)}let g=[];for(let t=0;t<i;t++)y[t]&&g.push(t);for(let t=0;t<u&&g.length;t++){const o=[];for(let r=0;r<g.length;r++){const e=g[r],h=e%n,a=p=>{!y[p]&&v[p]<=f&&(y[p]=1,o.push(p))};h>0&&a(e-1),h<n-1&&a(e+1),e>=n&&a(e-n),e<i-n&&a(e+n)}g=o}let M=new Uint8ClampedArray(i);for(let t=0;t<i;t++)M[t]=y[t]?0:255;if(m.erode){const t=new Uint8ClampedArray(M);for(let o=0;o<l;o++)for(let r=0;r<n;r++){const e=o*n+r;t[e]&&(r>0&&!t[e-1]||r<n-1&&!t[e+1]||o>0&&!t[e-n]||o<l-1&&!t[e+n])&&(M[e]=0)}}const s=new Uint8ClampedArray(i);for(let t=0;t<l;t++){const o=t*n;for(let r=0;r<n;r++){const e=o+r;s[e]=((r>0?M[e-1]:M[e])+M[e]+(r<n-1?M[e+1]:M[e]))/3}}for(let t=0;t<l;t++){const o=t*n;for(let r=0;r<n;r++){const e=o+r;M[e]=((t>0?s[e-n]:s[e])+s[e]+(t<l-1?s[e+n]:s[e]))/3}}const x=m.clean!==!1;for(let t=0,o=0;t<i;t++,o+=4){const r=M[t];if(r>=c[o+3])continue;if(c[o+3]=r,x&&r>4&&r<248){const e=r/255,h=1-e;let a;a=(c[o]-b*h)/e,c[o]=a<0?0:a>255?255:a,a=(c[o+1]-N*h)/e,c[o+1]=a<0?0:a>255?255:a,a=(c[o+2]-I*h)/e,c[o+2]=a<0?0:a>255?255:a}}return U},window.cutWhite=(c,n,l,m)=>window.cutBg(c,n,l,m),window.wandCut=function(c,n,l,m,B,U,O){
// O（可选）：{c:[r,g,b] 魔棒落下那一刻的种子色, q:这一下的序号, pq:每个点最后一次被图章盖的序号, pu:没盖过的原图}
// 后来才盖上去的图章，按原图的颜色判断连通、也不会被吃——补上的字不会被旧魔棒再吃掉
O=O||{};const b=n*l,N=(B*n+m)*4,sc=O.c,I=sc?sc[0]:c[N],k=sc?sc[1]:c[N+1],f=sc?sc[2]:c[N+2],
u=10+Math.max(0,Math.min(90,U|0))*1.15,i=new Uint8Array(b),v=new Int32Array(b),
pq=O.pq,pu=O.pu,q=O.q||0,late=s=>!!pq&&!!pu&&pq[s]>q;let y=0;
const T=s=>{const x=s*4;if(c[x+3]<6)return!1;const S=late(s)?pu:c,t=Math.abs(S[x]-I),o=Math.abs(S[x+1]-k),r=Math.abs(S[x+2]-f);return(t>o?t>r?t:r:o>r?o:r)<=u},
C=s=>{!i[s]&&T(s)&&(i[s]=1,v[y++]=s)};
for(C(B*n+m);y>0;){const s=v[--y],x=s%n;x>0&&C(s-1),x<n-1&&C(s+1),s>=n&&C(s-n),s<b-n&&C(s+n)}
let A=0;for(let s=0;s<b;s++)i[s]&&A++;if(!A)return 0;
const g=new Uint8ClampedArray(b);for(let s=0;s<b;s++)g[s]=i[s]?0:255;
const M=new Uint8ClampedArray(b);
for(let s=0;s<l;s++){const x=s*n;for(let t=0;t<n;t++){const o=x+t;M[o]=((t>0?g[o-1]:g[o])+g[o]+(t<n-1?g[o+1]:g[o]))/3}}
for(let s=0;s<l;s++){const x=s*n;for(let t=0;t<n;t++){const o=x+t;if(late(o))continue;const r=((s>0?M[o-n]:M[o])+M[o]+(s<l-1?M[o+n]:M[o]))/3;
if(r<c[o*4+3]&&(c[o*4+3]=r,r>4&&r<248)){const e=o*4,h=r/255,a=1-h;let p;p=(c[e]-I*a)/h,c[e]=p<0?0:p>255?255:p,p=(c[e+1]-k*a)/h,c[e+1]=p<0?0:p>255?255:p,p=(c[e+2]-f*a)/h,c[e+2]=p<0?0:p>255?255:p}}}
return A};

// 去白边：章、签名、单色字用。按“纸色 → 墨色”这条线算每个点有几成墨当透明度，再把纸色从颜色里减掉（反混色）。
// 不在这条线上的颜色（纸上的灰、黄、黑字）淡出。多色贴纸别开。
window.inkPick=function(c,n,l,P,AL){
const b=n*l,st=Math.max(1,Math.floor(Math.sqrt(b/90000))),H=new Map;
for(let y=0;y<l;y+=st)for(let x=0;x<n;x+=st){const j=y*n+x,o=j*4;if((AL?AL[o+3]:c[o+3])<128)continue;
const a=P[0]-c[o],g=P[1]-c[o+1],e=P[2]-c[o+2],L=Math.sqrt(a*a+g*g+e*e);if(L<48)continue;
const K=((a/L+1)*4|0)*81+((g/L+1)*4|0)*9+((e/L+1)*4|0),h=H.get(K);
h?(h.n++,h.a+=a/L,h.g+=g/L,h.e+=e/L):H.set(K,{n:1,a:a/L,g:g/L,e:e/L})}
const bins=[...H.values()].sort((p,q)=>q.n-p.n),dirs=[];
for(const h of bins){if(dirs.length>=3||h.n<Math.max(20,bins[0].n*.04))break;const L=Math.hypot(h.a,h.g,h.e)||1,u=[h.a/L,h.g/L,h.e/L];
if(dirs.some(D=>D.u[0]*u[0]+D.u[1]*u[1]+D.u[2]*u[2]>.94))continue;dirs.push({u,hist:new Uint32Array(444),s:new Float64Array(444*3),n:0})}
if(!dirs.length)return[];
for(let y=0;y<l;y+=st)for(let x=0;x<n;x+=st){const j=y*n+x,o=j*4;if((AL?AL[o+3]:c[o+3])<128)continue;
const a=P[0]-c[o],g=P[1]-c[o+1],e=P[2]-c[o+2],L=Math.sqrt(a*a+g*g+e*e);if(L<48)continue;
let best=null,bc=.96;for(const D of dirs){const cs=(a*D.u[0]+g*D.u[1]+e*D.u[2])/L;cs>bc&&(bc=cs,best=D)}
if(!best)continue;const z=Math.min(443,L|0);best.hist[z]++;best.s[z*3]+=c[o];best.s[z*3+1]+=c[o+1];best.s[z*3+2]+=c[o+2];best.n++}
const out=[];
for(const D of dirs){if(D.n<10)continue;let cut=0,acc=0;const th=D.n*.3;for(;cut<444&&acc+D.hist[cut]<th;cut++)acc+=D.hist[cut];
let r=0,g=0,e=0,m=0;for(let z=cut;z<444;z++){r+=D.s[z*3];g+=D.s[z*3+1];e+=D.s[z*3+2];m+=D.hist[z]}
if(!m)continue;const C=[Math.round(r/m),Math.round(g/m),Math.round(e/m)];
out.push({c:C,n:D.n,chroma:Math.max(C[0],C[1],C[2])-Math.min(C[0],C[1],C[2])})}
out.sort((p,q)=>q.n-p.n);return out};

window.defringe=function(dst,src,n,l,P,C){
// dst：已经抠过底、吃过魔棒的图（只拿它的 alpha 当上限）；src：原图颜色
const d0=P[0]-C[0],d1=P[1]-C[1],d2=P[2]-C[2],dd=d0*d0+d1*d1+d2*d2,dl=Math.sqrt(dd);if(dd<100)return;
for(let o=0,b=n*l*4;o<b;o+=4){const cap=dst[o+3];if(!cap)continue;
const s0=src[o],s1=src[o+1],s2=src[o+2],v0=P[0]-s0,v1=P[1]-s1,v2=P[2]-s2,L=Math.sqrt(v0*v0+v1*v1+v2*v2);
if(L<2){dst[o+3]=0;continue}
const dot=v0*d0+v1*d1+v2*d2,cs=dot/(L*dl),g=cs<=.88?0:cs>=.95?1:(cs-.88)/.07,t=dot/dd,a=(t<0?0:t>1?1:t)*g*255;
if(a<3){dst[o+3]=0;continue}const A=a<cap?a:cap;
if(t>=1){dst[o]=s0;dst[o+1]=s1;dst[o+2]=s2}
else{const k=t<.04?.04:t;let x;x=P[0]-v0/k;dst[o]=x<0?0:x>255?255:x;x=P[1]-v1/k;dst[o+1]=x<0?0:x>255?255:x;x=P[2]-v2/k;dst[o+2]=x<0?0:x>255?255:x}
dst[o+3]=A}};

// 纸色：原图里偏中性、最亮那一成的平均。底色被认成黑（透明PNG边上有黑点）时用它。
window.paperPick=function(c,n,l){const b=n*l,st=Math.max(1,Math.floor(Math.sqrt(b/90000))),h=new Uint32Array(256),s=new Float64Array(768);let m=0;
for(let y=0;y<l;y+=st)for(let x=0;x<n;x+=st){const o=(y*n+x)*4;if(c[o+3]<128)continue;const r=c[o],g=c[o+1],e=c[o+2],mx=r>g?r>e?r:e:g>e?g:e,mn=r<g?r<e?r:e:g<e?g:e;if(mx-mn>40)continue;const L=r*.3+g*.59+e*.11|0;if(L<170)continue;h[L]++;s[L*3]+=r;s[L*3+1]+=g;s[L*3+2]+=e;m++}
if(m<30)return[255,255,255];let k=255,a=0,r=0,g=0,e=0;for(;k>=170&&a<m*.1;k--){a+=h[k];r+=s[k*3];g+=s[k*3+1];e+=s[k*3+2]}
return[Math.round(r/a),Math.round(g/a),Math.round(e/a)]};
