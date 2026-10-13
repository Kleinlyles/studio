'use strict';
/* ======== 砖 0：地基 ========
   只放三样东西：公用小工具、共享状态、广播站。
   自己不碰任何界面，所以永远不会连坐别人。
   必须第一个加载。 */

/* 出错就在屏幕上说清楚，不再静默死掉 */
window.addEventListener('error', function (e) {
  var b = document.getElementById('errbar');
  if (!b) {
    b = document.createElement('div');
    b.id = 'errbar';
    document.body.appendChild(b);
  }
  b.textContent = '脚本出错 ▸ ' + (e.message || '') + '  @' +
    String(e.filename || '').split('/').pop() + ':' + e.lineno;
});

/* ---------- 公用小工具 ---------- */
window.$ = function (id) { return document.getElementById(id); };

window.api = async function (p, b) {
  const r = await fetch(p, b ? {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(b)
  } : undefined);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
};

window.say = function (el, t, cls) {
  if (!el) return;
  el.textContent = t;
  el.className = 'msg' + (cls ? ' ' + cls : '');
};

/* ---------- 广播站：砖和砖之间只靠喊话，不互相伸手 ---------- */
window.BUS = (function () {
  const m = {};
  return {
    on: function (k, f) { (m[k] = m[k] || []).push(f); },
    emit: function (k, a, b) {
      (m[k] || []).forEach(function (f) {
        try { f(a, b); } catch (e) { console.warn('[bus] ' + k + ' 这块砖出错了，不连坐别人', e); }
      });
    },
  };
})();

/* ---------- 共享状态：谁都能读，改完记得喊一声 ---------- */
window.S = {
  imgs: [],        // 抓回来的图 [{name,w,h}]
  cur: -1,         // 当前编辑的下标
  tool: 'box',
  states: {},      // name -> {boxes:[], mask:[], alpha:bool, tol:int}
  base: null,      // 当前原图 Image
  raw: [],         // 切出来还没加边的 [{canvas,label}]
  cuts: [],        // 加完边待存的 [{canvas,label}]
};
window.st = function () { return S.states[S.imgs[S.cur].name]; };

/* 贴纸边的参数（贴纸砖主管，导出砖只读） */
window.EDGE = {border: 12, outer: 0, color: '#ffffff', outerColor: 'gold_foil', freq: 16};

/* 自选色（贴纸砖主管，描边算法只读） */
window.CUSTOM = {stops: ['#f6d8e4', '#cfe3f7', '#e8dcf6'], angle: 45, grain: 0.06,
                 tex: 'none', mix: 0.65, bleed: 0.30};

/* ---------- 公用动作：把一张做好的图送回编辑台继续修 ---------- */
window.toEdit = async function (srcImgOrCanvas, stem) {
  const c = document.createElement('canvas');
  c.width = srcImgOrCanvas.width;
  c.height = srcImgOrCanvas.height;
  c.getContext('2d').drawImage(srcImgOrCanvas, 0, 0);
  const name = (stem || 'sticker').replace(/[\\/:*?"<>|]/g, '_') + '_修.png';
  const j = await api('/api/upload', {files: [{name: name, data: c.toDataURL('image/png')}]});
  const saved = (j.saved || [])[0];
  if (!saved) throw new Error('存回去没成功');
  S.imgs.push({name: saved});
  S.states[saved] = {boxes: [], mask: [], alpha: true, tol: 34, erode: false, key: null, wands: []};
  if (typeof window.renderGrid === 'function') window.renderGrid();
  if (typeof window.openImg === 'function') window.openImg(S.imgs.length - 1);
  return saved;
};
