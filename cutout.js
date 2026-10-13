'use strict';
/* 底色抠图：白底、黑底、彩底、渐变底一视同仁
   1) 认底色：采四边一圈像素，取出现最多的那个颜色（也可以用吸管手动指定）
   2) 强背景：跟底色很接近 且 从画布边缘连通进来 -> 洪水填充（素材内部同色区不动）
   3) 弱生长：挨着强背景的「有点接近」的，按容差向内长几像素，到头即停
   4) 羽化 1px 抗锯齿
   5) 去边色污染：半透明像素反算掉混进来的底色，边缘不发白不发黑
*/

// 采边框一圈，投票出底色
window.pickBg = function (d, w, h) {
  const bin = new Map();
  const add = (r, g, b) => {
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const v = bin.get(k);
    if (v) { v[0] += r; v[1] += g; v[2] += b; v[3]++; }
    else bin.set(k, [r, g, b, 1]);
  };
  const smp = (x, y) => {
    const p = (y * w + x) * 4;
    if (d[p + 3] > 8) add(d[p], d[p + 1], d[p + 2]);
  };
  const stepX = Math.max(1, (w / 220) | 0), stepY = Math.max(1, (h / 220) | 0);
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.012));
  for (let x = 0; x < w; x += stepX)
    for (let t = 0; t < band; t++) { smp(x, t); smp(x, h - 1 - t); }
  for (let y = 0; y < h; y += stepY)
    for (let t = 0; t < band; t++) { smp(t, y); smp(w - 1 - t, y); }
  let best = null;
  for (const v of bin.values()) if (!best || v[3] > best[3]) best = v;
  if (!best) return [255, 255, 255];
  return [Math.round(best[0] / best[3]), Math.round(best[1] / best[3]),
          Math.round(best[2] / best[3])];
};

window.cutBg = function (d, w, h, opt) {
  const tol = Math.max(0, Math.min(90, opt.tol | 0));
  const key = opt.key || window.pickBg(d, w, h);
  const kr = key[0], kg = key[1], kb = key[2];
  // 强判定收紧、弱判定按容差放开（距离用 max 通道差，比欧氏更贴人眼对色偏的敏感）
  const STRONG = 16 + tol * 0.22;
  const WEAK = STRONG + 10 + tol * 0.95;
  const grow = 1 + Math.round(tol / 11);
  const N = w * h;

  const dif = new Uint8Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const a = Math.abs(d[p] - kr), b = Math.abs(d[p + 1] - kg), c = Math.abs(d[p + 2] - kb);
    const m = a > b ? (a > c ? a : c) : (b > c ? b : c);
    dif[i] = m > 255 ? 255 : m;
  }

  const bg = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const push = i => { if (!bg[i] && dif[i] <= STRONG) { bg[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp > 0) {
    const i = stack[--sp], x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < N - w) push(i + w);
  }

  let front = [];
  for (let i = 0; i < N; i++) if (bg[i]) front.push(i);
  for (let g = 0; g < grow && front.length; g++) {
    const next = [];
    for (let k = 0; k < front.length; k++) {
      const i = front[k], x = i % w;
      const t4 = j => { if (!bg[j] && dif[j] <= WEAK) { bg[j] = 1; next.push(j); } };
      if (x > 0) t4(i - 1);
      if (x < w - 1) t4(i + 1);
      if (i >= w) t4(i - w);
      if (i < N - w) t4(i + w);
    }
    front = next;
  }

  let a = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) a[i] = bg[i] ? 0 : 255;

  if (opt.erode) {
    const b = new Uint8ClampedArray(a);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!b[i]) continue;
      if ((x > 0 && !b[i - 1]) || (x < w - 1 && !b[i + 1]) ||
          (y > 0 && !b[i - w]) || (y < h - 1 && !b[i + w])) a[i] = 0;
    }
  }

  const t1 = new Uint8ClampedArray(N);
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const i = r + x;
      t1[i] = ((x > 0 ? a[i - 1] : a[i]) + a[i] + (x < w - 1 ? a[i + 1] : a[i])) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    const r = y * w;
    for (let x = 0; x < w; x++) {
      const i = r + x;
      a[i] = ((y > 0 ? t1[i - w] : t1[i]) + t1[i] + (y < h - 1 ? t1[i + w] : t1[i])) / 3;
    }
  }

  const clean = opt.clean !== false;
  for (let i = 0, p = 0; i < N; i++, p += 4) {
    const av = a[i];
    d[p + 3] = av;
    if (clean && av > 4 && av < 248) {
      // 反算：观察色 = 素材色*k + 底色*(1-k)，解出素材色
      const k = av / 255, ik = 1 - k;
      let v;
      v = (d[p] - kr * ik) / k; d[p] = v < 0 ? 0 : v > 255 ? 255 : v;
      v = (d[p + 1] - kg * ik) / k; d[p + 1] = v < 0 ? 0 : v > 255 ? 255 : v;
      v = (d[p + 2] - kb * ik) / k; d[p + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return key;
};

// 旧名字留个口，省得别处漏改
window.cutWhite = (d, w, h, o) => window.cutBg(d, w, h, o);

/* 魔棒：从点中的那一点往外吃同色区，专治中间镂空（孤岛连不到画布边缘，洪水填充吃不到） */
window.wandCut = function (d, w, h, sx, sy, tol) {
  const N = w * h;
  const si = (sy * w + sx) * 4;
  const kr = d[si], kg = d[si + 1], kb = d[si + 2];
  const T = 10 + Math.max(0, Math.min(90, tol | 0)) * 1.15;
  const hit = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  const near = i => {
    const p = i * 4;
    if (d[p + 3] < 6) return false;
    const a = Math.abs(d[p] - kr), b = Math.abs(d[p + 1] - kg), c = Math.abs(d[p + 2] - kb);
    return (a > b ? (a > c ? a : c) : (b > c ? b : c)) <= T;
  };
  const push = i => { if (!hit[i] && near(i)) { hit[i] = 1; stack[sp++] = i; } };
  push(sy * w + sx);
  while (sp > 0) {
    const i = stack[--sp], x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < N - w) push(i + w);
  }
  let n = 0;
  for (let i = 0; i < N; i++) if (hit[i]) n++;
  if (!n) return 0;
  // 羽化一圈，边不锯齿
  const a = new Uint8ClampedArray(N);
  for (let i = 0; i < N; i++) a[i] = hit[i] ? 0 : 255;
  const t = new Uint8ClampedArray(N);
  for (let y = 0; y < h; y++) { const r = y * w;
    for (let x = 0; x < w; x++) { const i = r + x;
      t[i] = ((x > 0 ? a[i - 1] : a[i]) + a[i] + (x < w - 1 ? a[i + 1] : a[i])) / 3; } }
  for (let y = 0; y < h; y++) { const r = y * w;
    for (let x = 0; x < w; x++) { const i = r + x;
      const v = ((y > 0 ? t[i - w] : t[i]) + t[i] + (y < h - 1 ? t[i + w] : t[i])) / 3;
      if (v < d[i * 4 + 3]) {
        d[i * 4 + 3] = v;
        if (v > 4 && v < 248) {   // 去掉混进来的被吃色
          const p = i * 4, k = v / 255, ik = 1 - k;
          let q;
          q = (d[p] - kr * ik) / k; d[p] = q < 0 ? 0 : q > 255 ? 255 : q;
          q = (d[p + 1] - kg * ik) / k; d[p + 1] = q < 0 ? 0 : q > 255 ? 255 : q;
          q = (d[p + 2] - kb * ik) / k; d[p + 2] = q < 0 ? 0 : q > 255 ? 255 : q;
        }
      } } }
  return n;
};
