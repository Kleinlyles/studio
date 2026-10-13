'use strict';
/* 删减版：没有后端。图片全在这台手机的内存里，导出直接下载。
   砍掉的：抓小红书、修水印、素材库。离线也能用。 */
window.LITE = {src: {}};

(function () {
  const real = window.api;

  function dlBlob(blob, name) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  function loadImg(dataUrl) {
    return new Promise(function (ok, no) {
      const im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = no;
      im.src = dataUrl;
    });
  }

  window.api = async function (path, body) {
    const p = String(path).split('?')[0];

    if (p === '/api/upload') {
      const saved = [];
      (body.files || []).forEach(function (f) {
        let n = (f.name || 'img.png').replace(/[\\/:*?"<>|]/g, '_');
        if (LITE.src[n]) {
          const dot = n.lastIndexOf('.');
          n = (dot > 0 ? n.slice(0, dot) : n) + '_' + Date.now().toString().slice(-5) +
              (dot > 0 ? n.slice(dot) : '.png');
        }
        LITE.src[n] = f.data;
        saved.push(n);
      });
      return {saved: saved, count: saved.length};
    }

    if (p === '/api/export') {
      const im = await loadImg(body.png);
      let w = im.width, h = im.height;
      const want = parseInt(body.size, 10);
      if (want > 0 && Math.max(w, h) !== want) {
        const k = want / Math.max(w, h);
        w = Math.max(1, Math.round(w * k));
        h = Math.max(1, Math.round(h * k));
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      const jpg = (body.format === 'jpg' || body.format === 'jpeg');
      if (jpg) { g.fillStyle = body.bg || '#ffffff'; g.fillRect(0, 0, w, h); }
      g.drawImage(im, 0, 0, w, h);
      const ext = jpg ? 'jpg' : 'png';
      const blob = await new Promise(function (ok) {
        c.toBlob(ok, jpg ? 'image/jpeg' : 'image/png', jpg ? 0.92 : undefined);
      });
      const name = (body.name || 'sticker') + '.' + ext;
      dlBlob(blob, name);
      return {name: name, w: w, h: h, kb: Math.round(blob.size / 1024)};
    }

    if (p === '/api/list') return {items: []};
    if (p === '/api/del') return {ok: true};
    if (p === '/api/inpaint') throw new Error('这一版没有修水印');
    if (p === '/api/fetch') throw new Error('这一版不抓链接，用「＋ 导入图片」');

    if (real) return real(path, body);
    throw new Error('用不了：' + p);
  };
})();
