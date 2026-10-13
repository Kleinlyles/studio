'use strict';
/* 贴纸边：模切边 / 金箔 / 镭射 / 双圈
   距离变换给出每个像素到素材的距离 -> 决定边的形状
   上色全部走程序纹理，不是平涂：金箔有亮度跨度+箔纸颗粒+镜面高光，
   镭射有宽幅虹彩+白色爆点+干涉暗纹。
*/
(function () {

  /* ---------- 8SSEDT 距离变换 ---------- */
  function edt(inside, w, h) {
    const N = w * h, BIG = 1 << 14;
    const dx = new Int32Array(N), dy = new Int32Array(N);
    const d2 = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      if (inside[i]) { dx[i] = 0; dy[i] = 0; d2[i] = 0; }
      else { dx[i] = BIG; dy[i] = BIG; d2[i] = BIG * BIG * 2; }
    }
    const put = (i, xi, ox, oy) => {
      const xj = xi + ox;
      if (xj < 0 || xj >= w) return;
      const j = i + ox + oy * w;
      if (j < 0 || j >= N) return;
      const ndx = dx[j] + ox, ndy = dy[j] + oy;
      const nd = ndx * ndx + ndy * ndy;
      if (nd < d2[i]) { d2[i] = nd; dx[i] = ndx; dy[i] = ndy; }
    };
    for (let y = 0; y < h; y++) {
      const r = y * w;
      for (let x = 0; x < w; x++) {
        const i = r + x;
        if (!d2[i]) continue;
        put(i, x, -1, 0); put(i, x, 0, -1); put(i, x, -1, -1); put(i, x, 1, -1);
      }
      for (let x = w - 1; x >= 0; x--) {
        const i = r + x; if (!d2[i]) continue; put(i, x, 1, 0);
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      const r = y * w;
      for (let x = w - 1; x >= 0; x--) {
        const i = r + x;
        if (!d2[i]) continue;
        put(i, x, 1, 0); put(i, x, 0, 1); put(i, x, 1, 1); put(i, x, -1, 1);
      }
      for (let x = 0; x < w; x++) {
        const i = r + x; if (!d2[i]) continue; put(i, x, -1, 0);
      }
    }
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) out[i] = Math.sqrt(d2[i]);
    return out;
  }

  /* ---------- 工具 ---------- */
  const hex = s => {
    s = (s || '#ffffff').replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // 哈希值噪声：给纹理加颗粒，同一坐标恒定，不会抖
  const hash = (x, y) => {
    let n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >> 13)) * 1274126177 | 0;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  };
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi), b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  function fbm(x, y) {
    return vnoise(x, y) * 0.55 + vnoise(x * 2.3, y * 2.3) * 0.28 + vnoise(x * 5.1, y * 5.1) * 0.17;
  }

  /* ---------- 材质贴图采样 ---------- */
  // TEX[key] = {data:Uint8ClampedArray, w, h}  由 app.js 预加载灌进来
  window.TEX = window.TEX || {};

  function sampleTex(t, x, y, scale) {
    const sx = x / scale, sy = y / scale;
    let ix = sx | 0, iy = sy | 0;
    const fx = sx - ix, fy = sy - iy;
    const w = t.w, h = t.h, d = t.data;
    ix = ((ix % w) + w) % w; iy = ((iy % h) + h) % h;
    const ix2 = (ix + 1) % w, iy2 = (iy + 1) % h;
    const p00 = (iy * w + ix) * 4, p10 = (iy * w + ix2) * 4;
    const p01 = (iy2 * w + ix) * 4, p11 = (iy2 * w + ix2) * 4;
    const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy);
    const w01 = (1 - fx) * fy, w11 = fx * fy;
    return [
      d[p00] * w00 + d[p10] * w10 + d[p01] * w01 + d[p11] * w11,
      d[p00 + 1] * w00 + d[p10 + 1] * w10 + d[p01 + 1] * w01 + d[p11 + 1] * w11,
      d[p00 + 2] * w00 + d[p10 + 2] * w10 + d[p01 + 2] * w01 + d[p11 + 2] * w11,
    ];
  }

  // 边的厚度感：内沿提亮、外沿压暗，像真的有一层料
  function shade(mode, flat, x, y, dv, R, scale) {
    const k = R > 0 ? dv / R : 0;
    const f = 1 + (0.45 - k) * 0.42;
    if (mode === 'custom') {
      const g = window.CUSTOM || {};
      const st = g.stops && g.stops.length ? g.stops : ['#ffffff'];
      const ang = (g.angle === undefined ? 45 : g.angle) * Math.PI / 180;
      const sc = Math.max(8, scale * 180);
      let t = ((x * Math.cos(ang) + y * Math.sin(ang)) / sc) % 1;
      if (t < 0) t += 1;
      let c;
      if (st.length === 1) {
        c = hex(st[0]);
      } else {
        const seg = t * (st.length - 1);
        const i0 = Math.min(st.length - 2, Math.floor(seg));
        const fr = seg - i0;
        const a0 = hex(st[i0]), a1 = hex(st[i0 + 1]);
        c = [a0[0] + (a1[0] - a0[0]) * fr,
             a0[1] + (a1[1] - a0[1]) * fr,
             a0[2] + (a1[2] - a0[2]) * fr];
      }

      /* 自选色上面压一层真材质：
         取纹理的明暗关系做 overlay，颜色保住；
         纹理自己那点色（镭射的虹彩、金箔的金）按「透色」比例掺回来；
         高光和闪点单独加亮，不然叠深色会把闪全吃掉 */
      const texKey = g.tex;
      if (texKey && texKey !== 'none' && window.TEX[texKey]) {
        const mixAmt = g.mix === undefined ? 0.65 : g.mix;
        const bleed = g.bleed === undefined ? 0.3 : g.bleed;
        const tc = sampleTex(window.TEX[texKey], x, y, scale);
        const lum = (tc[0] * 0.299 + tc[1] * 0.587 + tc[2] * 0.114) / 255;
        // overlay：亮的地方提亮、暗的地方压暗，保留底色色相
        const ov = v => {
          const b = v / 255;
          const o = lum < 0.5 ? 2 * b * lum : 1 - 2 * (1 - b) * (1 - lum);
          return (b + (o - b) * mixAmt) * 255;
        };
        c = [ov(c[0]), ov(c[1]), ov(c[2])];
        if (bleed > 0) {
          c = [c[0] + (tc[0] - c[0]) * bleed,
               c[1] + (tc[1] - c[1]) * bleed,
               c[2] + (tc[2] - c[2]) * bleed];
        }
        // 闪点/镜面：纹理里特别亮的那一撮，直接往上加白
        if (lum > 0.78) {
          const sp = (lum - 0.78) / 0.22;
          const k2 = sp * sp * 190 * mixAmt;
          c = [c[0] + k2, c[1] + k2, c[2] + k2];
        }
      }

      const gr = (g.grain || 0) * 255;
      if (gr > 0) {
        const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const j = ((n < 0 ? n + 1 : n) - 0.5) * gr;
        c = [c[0] + j, c[1] + j, c[2] + j];
      }
      return [cl(c[0] * f), cl(c[1] * f), cl(c[2] * f)];
    }
    if (mode === 'flat' || !window.TEX[mode]) return flat || [255, 255, 255];
    const c2 = sampleTex(window.TEX[mode], x, y, scale);
    return [cl(c2[0] * f), cl(c2[1] * f), cl(c2[2] * f)];
  }

  /* ---------- 主函数 ---------- */
  window.makeSticker = function (src, opt) {
    opt = opt || {};
    const bw = Math.max(0, opt.border | 0);
    const ow = Math.max(0, opt.outer | 0);
    if (!bw && !ow) return src;

    const isTex = v => v && v[0] !== '#';   // 'custom' 也算非 # 开头，走程序渐变
    const inMode = isTex(opt.color) ? opt.color : 'flat';
    const inFlat = inMode === 'flat' ? hex(opt.color || '#ffffff') : null;
    const outMode = isTex(opt.outerColor) ? opt.outerColor : 'flat';
    const outFlat = outMode === 'flat' ? hex(opt.outerColor || '#d9b36c') : null;
    const scale = Math.max(0.15, (opt.freq || 16) / 16);

    const m = bw + ow + 2;
    const w = src.width + m * 2, h = src.height + m * 2;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', {willReadFrequently: true});
    cx.drawImage(src, m, m);
    const im = cx.getImageData(0, 0, w, h), d = im.data;
    const N = w * h;

    const inside = new Uint8Array(N);
    for (let i = 0, p = 3; i < N; i++, p += 4) inside[i] = d[p] >= 128 ? 1 : 0;
    const dist = edt(inside, w, h);

    const R1 = bw, R2 = bw + ow;
    for (let i = 0, p = 0; i < N; i++, p += 4) {
      const dv = dist[i];
      if (dv > R2 + 1) continue;
      const x = i % w, y = (i / w) | 0;
      const aIn = d[p + 3] / 255;
      const c1 = bw ? Math.max(0, Math.min(1, R1 + 0.5 - dv)) : 0;
      const c2 = ow ? Math.max(0, Math.min(1, R2 + 0.5 - dv)) : 0;

      let r = 0, g = 0, b = 0, a = 0;
      if (c2 > 0) {
        const col = shade(outMode, outFlat, x, y, dv - R1, Math.max(1, ow), scale);
        r = col[0]; g = col[1]; b = col[2]; a = c2;
      }
      if (c1 > 0) {
        const col = shade(inMode, inFlat, x, y, dv, Math.max(1, R1), scale);
        const na = c1 + a * (1 - c1);
        if (na > 0) {
          r = (col[0] * c1 + r * a * (1 - c1)) / na;
          g = (col[1] * c1 + g * a * (1 - c1)) / na;
          b = (col[2] * c1 + b * a * (1 - c1)) / na;
        }
        a = na;
      }
      if (aIn > 0) {
        const na = aIn + a * (1 - aIn);
        r = (d[p] * aIn + r * a * (1 - aIn)) / na;
        g = (d[p + 1] * aIn + g * a * (1 - aIn)) / na;
        b = (d[p + 2] * aIn + b * a * (1 - aIn)) / na;
        a = na;
      }
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = Math.round(a * 255);
    }
    cx.putImageData(im, 0, 0);
    return cv;
  };
})();
