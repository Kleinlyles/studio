'use strict';
/* ======== 砖 4：抓图 / 选图 / 编辑台 / 导出 / 素材库 ========
   公用小工具和共享状态在 core.js，贴纸边在 edge.js，放大窗在 viewer.js。
   这块砖只碰编辑台那块画布和自己的卡片。 */


/* ---------- ① 抓图 ---------- */
$('btnFetch').onclick = async () => {
  const raw = $('url').value.trim();
  const m = raw.match(/https?:\/\/[^\s，。]+/);
  if (!m) return say($('msgFetch'), '里面没找到链接', 'err');
  $('btnFetch').disabled = true;
  say($('msgFetch'), '正在抓…小红书那边慢的话要等十几秒');
  try {
    const j = await api('/api/fetch', {url: m[0]});
    S.imgs = j.images.filter(x => !x.error);
    const bad = j.images.length - S.imgs.length;
    S.imgs.forEach(x => S.states[x.name] = {boxes: [], mask: [], alpha: true, tol: 34, erode: false, key: null, wands: []});
    say($('msgFetch'), `${j.title} — 抓到 ${S.imgs.length} 张` + (bad ? `，${bad} 张失败` : ''), 'ok');
    renderGrid();
    $('cardPick').classList.remove('hide');
    loadLib();
  } catch (e) {
    say($('msgFetch'), '抓不动：' + e.message, 'err');
  }
  $('btnFetch').disabled = false;
};

function renderGrid() {
  $('pickCount').textContent = `共 ${S.imgs.length} 张`;
  $('grid').innerHTML = '';
  S.imgs.forEach((im, i) => {
    const d = document.createElement('div');
    d.className = 'th' + (i === S.cur ? ' cur' : '');
    d.innerHTML = `<div class="tag">${String(i + 1).padStart(2, '0')}</div>
      <img src="src/${encodeURIComponent(im.name)}" loading="lazy">`;
    d.onclick = () => openImg(i);
    $('grid').appendChild(d);
  });
}

/* ---------- ② 打开到编辑台 ---------- */
const cv = $('cv'), ctx = cv.getContext('2d', {willReadFrequently: true});
let orig = null;  // 原始像素 ImageData

function openImg(i) {
  S.cur = i;
  const name = S.imgs[i].name;
  const img = new Image();
  img.onload = () => {
    S.base = img;
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0);
    orig = ctx.getImageData(0, 0, cv.width, cv.height);
    $('cardEdit').classList.remove('hide');
    $('cardOut').classList.remove('hide');
    $('editName').textContent = `${String(i + 1).padStart(2, '0')} · ${img.naturalWidth}×${img.naturalHeight}`;
    const s = st();
    $('tol').value = s.tol; $('tolV').textContent = s.tol;
    $('btnEdge').classList.toggle('on', !!s.erode);
    $('btnAlpha').classList.toggle('on', s.alpha);
    $('btnAlpha').textContent = s.alpha ? '底色已抠掉' : '底色留着';
    resetFix();
    resetZ();
    hclear();
    clonePt = null; markClone();
    repaint();
    renderBoxes();
    renderGrid();
    $('cardEdit').scrollIntoView({behavior: 'smooth', block: 'start'});
  };
  img.onerror = () => say($('msgFetch'), '这张图读不出来：' + name, 'err');
  img.src = (window.LITE && LITE.src[name]) || ('src/' + encodeURIComponent(name));
}

/* ---------- 画：白底转透明 + 橡皮 ---------- */
// 拖动中只在画布上直擦，不重算抠图（重算太慢会丢事件，笔画就断成点）
function wipe(a, b, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineWidth = r * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, 6.2832);
  ctx.fill();
  ctx.restore();
}

function repaint() {
  const s = st();
  const d = new Uint8ClampedArray(orig.data);
  if (s.alpha) {
    const k = cutBg(d, cv.width, cv.height,
      {tol: s.tol, erode: s.erode, clean: true, key: s.key});
    if (!s.key) s.key = k;
    showKey(s.key);
  }
  (s.wands || []).forEach(q => wandCut(d, cv.width, cv.height, q.x, q.y, q.tol));
  const im = new ImageData(d, cv.width, cv.height);
  ctx.putImageData(im, 0, 0);
  // 橡皮痕迹
  if (s.mask.length) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (const m of s.mask) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.restore();
  }
}

let tolT = 0;
$('tol').oninput = e => {
  $('tolV').textContent = e.target.value;
  if (S.cur < 0) return;
  st().tol = +e.target.value;
  clearTimeout(tolT);
  tolT = setTimeout(repaint, 90);
};
$('brush').oninput = e => $('brushV').textContent = e.target.value;
$('btnAlpha').onclick = () => {
  const s = st(); s.alpha = !s.alpha;
  $('btnAlpha').classList.toggle('on', s.alpha);
  $('btnAlpha').textContent = s.alpha ? '白底已抠掉' : '白底留着';
  repaint();
};
$('btnEdge').onclick = () => {
  const s = st(); s.erode = !s.erode;
  $('btnEdge').classList.toggle('on', s.erode);
  repaint();
};
$('btnUndo').onclick = hundo;
$('btnRedo').onclick = hredo;
$('btnReset').onclick = () => {
  const s = st();
  s.mask = []; s.boxes = []; s.tol = 34; s.alpha = true; s.erode = false; s.wands = [];
  $('tol').value = 34; $('tolV').textContent = '34';
  $('btnEdge').classList.remove('on');
  $('btnAlpha').classList.add('on'); $('btnAlpha').textContent = '白底已抠掉';
  repaint(); renderBoxes();
};
/* 参数条跟着工具换意思：
   框选/吸管/魔棒 -> 吃掉多少边；橡皮/水印笔/仿制图章 -> 笔的大小；看图 -> 不显示 */
const PROW = {
  box:   ['tol', '吃掉多少边'],
  pipe:  ['tol', '吃掉多少边'],
  wand:  ['tol', '吃掉多少边'],
  erase: ['brush', '橡皮大小'],
  fix:   ['brush', '水印笔大小'],
  clone: ['brush', '图章大小'],
  pan:   [null, ''],
};
function syncProw() {
  const cfg = PROW[S.tool] || PROW.box;
  $('prowTol').classList.toggle('hide', cfg[0] !== 'tol');
  $('prowBrush').classList.toggle('hide', cfg[0] !== 'brush');
  if (cfg[0] === 'tol') $('tolLab').textContent = cfg[1];
  if (cfg[0] === 'brush') $('brushLab').textContent = cfg[1];
}

$('tools').onclick = e => {
  const b = e.target.closest('button[data-tool]');
  if (!b) return;
  S.tool = b.dataset.tool;
  [...$('tools').children].forEach(x => x.classList.toggle('on', x === b));
  $('stage').classList.toggle('fixing', S.tool === 'fix' || S.tool === 'pipe');
  $('rowFix').classList.toggle('hide', S.tool !== 'fix');
  $('rowClone').classList.toggle('hide', S.tool !== 'clone');
  $('rowAlgo').classList.toggle('hide', S.tool !== 'fix');   // 修复算法是「水印笔」在用的，跟 rowFix 一起出
  syncProw();
  if (S.tool === 'clone') say($('editTip2'),
    clonePt ? '涂水印即可，像素从粉点那儿搬过来。想换源点：再点一下别处。'
            : '先点一下干净的地方定源点（会出现粉点），再涂水印。', '');
  else $('editTip2').textContent = '';
  $('editTip').textContent = S.tool === 'clone'
    ? '仿制图章：真像素搬运，压在花纹上也不糊。先点干净处定源点，再涂水印。撤销可一笔笔退。'
    : S.tool === 'wand'
    ? '魔棒：点中间镂空那块底色，一点就吃掉。孤岛连不到画布边缘，自动抠吃不到它，得你指。点错了按撤销。'
    : S.tool === 'fix'
    ? '水印笔：把水印整个涂住，边上多盖一点。涂完按「修掉涂的地方」——不是模糊，是按周围纹理把那块重新长出来。'
    : S.tool === 'pipe'
    ? '吸管：点一下图上任意一点，把那个颜色当底色。自动认错了就手动点一下真正的底。'
    : S.tool === 'erase'
    ? '橡皮：在图上涂，水印或者杂边都能擦掉。涂错点撤销，一次退一笔。'
    : S.tool === 'pan'
    ? '看图：现在不会误画框，放心上下滑。'
    : '框选：拖出框，右下圆点改大小，右上叉删掉。一张图能框好几块，各自独立导出。';
};


/* ---------- 底色显示 / 吸管 / 水印笔 ---------- */
const mk = document.createElement('canvas');
mk.className = 'fixlayer';
mk.style.width = '100%';
mk.style.height = 'auto';
$('wrap').insertBefore(mk, $('boxes'));   // boxes 已挪进 wrap，父节点跟着变
const mkx = mk.getContext('2d');
let painted = false;

function showKey(k) {
  if (!k) return;
  $('swatch').style.background = `rgb(${k[0]},${k[1]},${k[2]})`;
  $('skey').textContent = '底色 ' +
    ((1 << 24) + (k[0] << 16) + (k[1] << 8) + k[2]).toString(16).slice(1);
}
function resetFix() {
  mk.width = cv.width; mk.height = cv.height;
  mkx.clearRect(0, 0, mk.width, mk.height);
  painted = false;
  $('btnFix').disabled = true;
}
$('btnFixUndo').onclick = () => { resetFix(); };

function paintFix(p, r) {
  mkx.fillStyle = 'rgba(255,40,140,.62)';
  mkx.beginPath();
  mkx.arc(p.x, p.y, r, 0, 6.2832);
  mkx.fill();
  painted = true;
  $('btnFix').disabled = false;
}

function pickAt(p) {
  const q = ctx.getImageData(Math.round(p.x), Math.round(p.y), 1, 1).data;
  const s = st();
  s.key = [q[0], q[1], q[2]];
  showKey(s.key);
  repaint();
}

$('btnFix').onclick = async () => {
  if (!painted) return;
  $('btnFix').disabled = true;
  say($('msgFetch'), '正在修…挖掉涂的那块，按周围纹理重新长出来');
  try {
    const j = await api('/api/inpaint', {
      name: S.imgs[S.cur].name,
      mask: mk.toDataURL('image/png'),
      algo: $('algo').value,
      grow: 3, radius: 6,
    });
    const old = S.imgs[S.cur].name;
    (S.fixHist = S.fixHist || {});
    (S.fixHist[S.cur] = S.fixHist[S.cur] || []).push(old);
    S.imgs[S.cur] = {name: j.name};
    S.states[j.name] = Object.assign({}, S.states[old], {key: null});
    say($('msgFetch'),
      `修好了 — 动了 ${j.px} 个像素（占 ${j.ratio}%），${j.algo}。原图留着没覆盖。`, 'ok');
    openImg(S.cur);
  } catch (e) {
    say($('msgFetch'), '修不动：' + e.message, 'err');
    $('btnFix').disabled = false;
  }
};


/* ---------- 手势 ---------- */
const stage = $('stage');
let drag = null;
const toImg = ev => {
  const r = cv.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(cv.width, (ev.clientX - r.left) / r.width * cv.width)),
    y: Math.max(0, Math.min(cv.height, (ev.clientY - r.top) / r.height * cv.height)),
  };
};

stage.addEventListener('pointerdown', ev => {
  if (S.cur < 0 || S.tool === 'pan') return;
  if (ev.target.closest('.rm') || ev.target.closest('.hd')) return;
  // 缩放那个监听挂在捕获阶段，比这儿先跑，所以这会儿 pts 里已经有两根手指了。
  // 两指以上一律不落笔 —— 不然第二指自己又起一笔新的
  if (typeof pts !== 'undefined' && pts.size >= 2) return;
  stage.setPointerCapture(ev.pointerId);
  const p = toImg(ev);
  if (S.tool === 'pipe') { pickAt(p); drag = null; ev.preventDefault(); return; }
  if (S.tool === 'clone') {
    const r = +$('brush').value / 2 * (cv.width / stage.clientWidth);
    if (!clonePt || armSrc) {
      clonePt = {x: Math.round(p.x), y: Math.round(p.y)};
      armSrc = false;
      markClone();
      say($('editTip2'), '源点定好了（粉点，可以直接拖）。现在涂水印。', 'ok');
      drag = null; ev.preventDefault(); return;
    }
    strokeStart(p);
    cloneAt(p, r);
    drag = {mode: 'clone', r, lastDab: {x: p.x, y: p.y}};
    ev.preventDefault(); return;
  }
  if (S.tool === 'wand') {
    const s = st();
    const bf = snapArr(s.wands);
    s.wands.push({x: Math.round(p.x), y: Math.round(p.y), tol: s.tol});
    histArr(() => st().wands, bf, snapArr(s.wands), repaint, 'wand');
    repaint();
    drag = null; ev.preventDefault(); return;
  }
  if (S.tool === 'fix') {
    const r = +$('brush').value / 2 * (cv.width / stage.clientWidth);
    paintFix(p, r);
    drag = {mode: 'fix', r};
    ev.preventDefault();
    return;
  }
  if (S.tool === 'erase') {
    const r = +$('brush').value / 2 * (cv.width / stage.clientWidth);
    const bf = snapArr(st().mask);
    st().mask.push({x: p.x, y: p.y, r});
    drag = {mode: 'erase', r, bf, last: {x: p.x, y: p.y}};
    wipe(p, p, r);
  } else {
    const bf = snapArr(st().boxes);
    st().boxes.push({x: p.x, y: p.y, w: 1, h: 1});
    drag = {mode: 'new', ox: p.x, oy: p.y, i: st().boxes.length - 1, bf};
    renderBoxes();
  }
  ev.preventDefault();
});

stage.addEventListener('pointermove', ev => {
  if (!drag) return;
  const p = toImg(ev);
  if (drag.mode === 'clone') {
    // 间距 0 = 连续涂（跟以前一样）；大于 0 就走够一段才盖一下，一朵一朵不糊在一起
    const gp = window.cloneGap ? cloneGap() : 0;
    if (gp <= 0) cloneAt(p, drag.r);
    else {
      const a = drag.lastDab || p;
      const need = Math.max(1, drag.r * 2 * gp);
      if (Math.hypot(p.x - a.x, p.y - a.y) >= need) {
        cloneAt(p, drag.r);
        drag.lastDab = {x: p.x, y: p.y};
      }
    }
    ev.preventDefault(); return;
  }
  if (drag.mode === 'fix') { paintFix(p, drag.r); ev.preventDefault(); return; }
  if (drag.mode === 'erase') {
    const a = drag.last || p;
    const dist = Math.hypot(p.x - a.x, p.y - a.y);
    const step = Math.max(1, drag.r * 0.34);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      const q = {x: a.x + (p.x - a.x) * i / n, y: a.y + (p.y - a.y) * i / n};
      st().mask.push({x: q.x, y: q.y, r: drag.r});
    }
    wipe(a, p, drag.r);
    drag.last = {x: p.x, y: p.y};
  } else if (drag.mode === 'new') {
    const b = st().boxes[drag.i];
    b.x = Math.min(drag.ox, p.x); b.y = Math.min(drag.oy, p.y);
    b.w = Math.abs(p.x - drag.ox); b.h = Math.abs(p.y - drag.oy);
    renderBoxes();
  } else if (drag.mode === 'resize') {
    const b = st().boxes[drag.i];
    b.w = Math.max(12, p.x - b.x); b.h = Math.max(12, p.y - b.y);
    renderBoxes();
  }
  ev.preventDefault();
});

/* 双指一来就把这笔整笔撤掉，当它没发生过。
   和 endDrag 的区别：endDrag 是正常收笔（进历史栈），这个是作废（不进栈） */
function abortDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  try {
    if (d.mode === 'erase' && d.bf) {
      const t = st().mask; t.length = 0; d.bf.forEach(o => t.push(o));
      repaint();
    } else if ((d.mode === 'new' || d.mode === 'resize') && d.bf) {
      const t = st().boxes; t.length = 0; d.bf.forEach(o => t.push(o));
      renderBoxes();
    } else if (d.mode === 'clone') {
      // 图章已经改了像素，按这一笔记下的补丁倒着贴回去
      const k = curStroke;
      curStroke = null;
      if (k && k.patches.length) {
        for (let i = k.patches.length - 1; i >= 0; i--) restore(k.patches[i]);
        repaint();
      }
    } else if (d.mode === 'fix') {
      resetFix();
    }
  } catch (e) { console.warn('回滚这笔时出错，不连坐别的', e); }
}

const endDrag = () => {
  if (!drag) return;
  if (drag.mode === 'new') {
    const b = st().boxes[drag.i];
    if (b && (b.w < 26 || b.h < 26)) st().boxes.splice(drag.i, 1);
    renderBoxes();
    if (drag.bf) histArr(() => st().boxes, drag.bf, snapArr(st().boxes), renderBoxes);
  } else if (drag.mode === 'erase' && drag.bf) {
    histArr(() => st().mask, drag.bf, snapArr(st().mask), repaint);
    repaint();
  } else if (drag.mode === 'resize' && drag.bf) {
    histArr(() => st().boxes, drag.bf, snapArr(st().boxes), renderBoxes);
  } else if (drag.mode === 'clone') {
    endStroke();
  }
  drag = null;
};
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);

function renderBoxes() {
  if (S.cur < 0 || !S.imgs[S.cur]) return;   // 还没开图就别画框
  const s = st(), k = stage.clientWidth / cv.width;
  $('boxes').innerHTML = '';
  s.boxes.forEach((b, i) => {
    const d = document.createElement('div');
    d.className = 'box';
    d.style.left = (b.x * k) + 'px'; d.style.top = (b.y * k) + 'px';
    d.style.width = (b.w * k) + 'px'; d.style.height = (b.h * k) + 'px';
    d.innerHTML = `<div class="lab">${i + 1}</div><div class="rm">×</div><div class="hd"></div>`;
    d.querySelector('.rm').onclick = e => {
      e.stopPropagation();
      const bf = snapArr(s.boxes);
      s.boxes.splice(i, 1); renderBoxes();
      histArr(() => st().boxes, bf, snapArr(st().boxes), renderBoxes);
    };
    d.querySelector('.hd').addEventListener('pointerdown', e => {
      e.stopPropagation();
      stage.setPointerCapture(e.pointerId);
      drag = {mode: 'resize', i, bf: snapArr(st().boxes)};
    });
    $('boxes').appendChild(d);
  });
  $('btnCut').disabled = !s.boxes.length;
}
addEventListener('resize', () => { if (S.cur >= 0) renderBoxes(); });


/* ---------- 统一历史栈：一个箭头退，一个箭头回 ---------- */
const HIST = {past: [], future: []};
/* 每种笔各自计数，提示里能说"第几笔" */
const STEPN = {};
const stepName = k => {
  const nm = {erase: '橡皮', clone: '仿制图章', fix: '水印笔', wand: '魔棒',
              box: '框选', pipe: '吸管', alpha: '底色开关', edge: '边缘收圈'}[k] || k;
  STEPN[k] = (STEPN[k] || 0) + 1;
  return nm + ' 第 ' + STEPN[k] + ' 笔';
};
function hpush(cmd) {
  if (!cmd.name) cmd.name = stepName(cmd.kind || S.tool);
  HIST.past.push(cmd);
  if (HIST.past.length > 300) HIST.past.shift();
  HIST.future.length = 0;
  hsync();
}
function hsync() {
  const u = $('btnUndo'), r = $('btnRedo');
  if (u) u.disabled = !HIST.past.length;
  if (r) r.disabled = !HIST.future.length;
}
function hundo() {
  const c = HIST.past.pop();
  if (!c) return say($('editTip2'), '没有可退的步骤了。', '');
  // 大图重算要一两秒，先说一声，不然看着像卡死
  say($('editTip2'), '正在退回：' + c.name + ' …', '');
  requestAnimationFrame(() => {
    c.undo();
    HIST.future.push(c);
    hsync();
    // 历史栈是按时间排的，不分工具（和 Procreate 一样）：
    // 现在手里拿着图章，退掉的也可能是上几步的橡皮，所以得写明白退了啥
    say($('editTip2'), '已退回：' + c.name
      + (HIST.past.length ? '（还能再退 ' + HIST.past.length + ' 步）' : '（到底了）'), 'ok');
  });
}
function hredo() {
  const c = HIST.future.pop();
  if (!c) return say($('editTip2'), '没有可重做的步骤了。', '');
  say($('editTip2'), '正在重做：' + c.name + ' …', '');
  requestAnimationFrame(() => {
    c.redo();
    HIST.past.push(c);
    hsync();
    say($('editTip2'), '已重做：' + c.name, 'ok');
  });
}
function hclear() {
  HIST.past.length = 0; HIST.future.length = 0;
  Object.keys(STEPN).forEach(k => delete STEPN[k]);
  hsync();
}
const snapArr = a => a.map(o => Object.assign({}, o));
function histArr(getter, before, after, redraw, kind) {
  hpush({
    kind: kind,
    undo: () => { const t = getter(); t.length = 0; before.forEach(o => t.push(o)); redraw(); },
    redo: () => { const t = getter(); t.length = 0; after.forEach(o => t.push(o)); redraw(); },
  });
}

/* ---------- ③ 切 ---------- */
function trim(c) {
  // 去掉四周全透明的空白，让素材贴边
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (d[(y * c.width + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return c;
  const o = document.createElement('canvas');
  o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}

const DROP = {on: true, ratio: 0.02};
$('btnCut').onclick = () => {
  const s = st();
  let specks = 0;
  S.raw = s.boxes.map((b, i) => {
    const c = document.createElement('canvas');
    c.width = Math.round(b.w); c.height = Math.round(b.h);
    c.getContext('2d').drawImage(cv, Math.round(b.x), Math.round(b.y),
      c.width, c.height, 0, 0, c.width, c.height);
    let n = 0;
    if (DROP.on) n = dropSpecks(c, DROP.ratio);
    if (n) specks += n;
    return {canvas: trim(c), label: i + 1};
  });
  $('cardEdge').classList.remove('hide');
  if (specks) say($('msgOut'), `顺手清掉了 ${specks} 块边角碎渣。`, 'ok');
  BUS.emit('cuts');                       // 贴纸砖听到自己去描边
  $('btnSave').disabled = false;
  if (window.goTab) window.goTab('cardEdge');
};


/* ---------- ④ 存 ---------- */
$('fmt').onchange = e =>
  $('rowBg').style.display = e.target.value === 'jpeg' ? 'flex' : 'none';

$('btnSave').onclick = async () => {
  if (!S.cuts.length) return;
  $('btnSave').disabled = true;
  const fmt = $('fmt').value, size = $('size').value, bg = $('bg').value.trim() || '#ffffff';
  const base = ($('stem').value.trim() ||
    S.imgs[S.cur].name.replace(/\.[a-z]+$/i, '')).replace(/[\\/:*?"<>|]/g, '_');
  let ok = 0, fail = [];
  for (const c of S.cuts) {
    try {
      const j = await api('/api/export', {
        png: c.canvas.toDataURL('image/png'),
        format: fmt, size, bg,
        name: `${base}_${String(c.label).padStart(2, '0')}`,
      });
      ok++;
      say($('msgOut'), `已存 ${ok}/${S.cuts.length} — ${j.name} ${j.w}×${j.h} ${j.kb}KB`, 'ok');
    } catch (e) { fail.push(c.label + '号:' + e.message); }
  }
  say($('msgOut'), `存好 ${ok} 张` + (fail.length ? `，失败：${fail.join('；')}` : '，已下载到手机'),
    fail.length ? 'err' : 'ok');
  S.cuts = []; S.raw = [];
  BUS.emit('cuts');
  $('cardEdge').classList.add('hide');
  await loadLib();
  $('cardLib').scrollIntoView({behavior: 'smooth', block: 'start'});
};

/* ---------- ⑤ 素材库 ---------- */
const SEL = new Set();
let LIB = [];
const zipMark = () => +(localStorage.getItem('xhsZipAt') || 0);

function libSync() {
  $('lib').querySelectorAll('.it').forEach(el =>
    el.classList.toggle('on', SEL.has(el.dataset.n)));
  const n = SEL.size;
  $('selCount').textContent = n ? `选了 ${n} 张` : '';
  $('btnSaveSel').disabled = !n;
  $('btnDelSel').disabled = !n;
}

async function loadLib() {
  try {
    const j = await api('/api/list');
    LIB = j.items;
    $('cardLib').classList.toggle('hide', !LIB.length);
    $('libCount').textContent = LIB.length ? `${LIB.length} 张` : '';
    const mk = zipMark();
    $('lib').innerHTML = '';
    LIB.forEach(it => {
      const d = document.createElement('div');
      d.className = 'it';
      d.dataset.n = it.name;
      const isNew = it.mt > mk;
      d.innerHTML = `<img src="out/${encodeURIComponent(it.name)}?t=${it.mt}" loading="lazy">
        <div class="kb">${it.kb}KB</div>
        ${isNew ? '<div class="newdot">新</div>' : ''}
        <div class="tick"></div>
        <div class="dl" title="单独存这张">&#10515;</div>
        <div class="fx" title="送回编辑台再修">&#9998;</div>
        <div class="x">×</div>`;
      if (it.by) d.appendChild(Object.assign(document.createElement('div'), {className: 'by', textContent: it.by}));
      d.querySelector('.x').onclick = async e => {
        e.stopPropagation();
        await api('/api/del', {name: it.name});
        SEL.delete(it.name);
        loadLib();
      };
      d.querySelector('.dl').onclick = e => {
        e.stopPropagation();
        const a2 = document.createElement('a');
        a2.href = 'out/' + encodeURIComponent(it.name);
        a2.download = it.name;
        a2.click();
      };
      d.querySelector('img').onclick = e => {
        e.stopPropagation();
        Viewer.openUrl('out/' + encodeURIComponent(it.name) + '?t=' + it.mt);
      };
      d.querySelector('.fx').onclick = e => {
        e.stopPropagation();
        say($('msgLib'), '正在送回编辑台…');
        const im = new Image();
        im.onload = async () => {
          try {
            await window.toEdit(im, it.name.replace(/\.[a-z]+$/i, ''));
            say($('msgLib'), '已经在编辑台了，橡皮、仿制图章都能用。', 'ok');
            if (window.goTab) window.goTab('cardEdit');
          } catch (err) { say($('msgLib'), '送不回去：' + err.message, 'err'); }
        };
        im.src = 'out/' + encodeURIComponent(it.name) + '?t=' + it.mt;
      };
      d.onclick = () => {
        if (SEL.has(it.name)) SEL.delete(it.name); else SEL.add(it.name);
        libSync();
      };
      $('lib').appendChild(d);
    });
    [...SEL].forEach(n => { if (!LIB.some(x => x.name === n)) SEL.delete(n); });
    libSync();
  } catch (e) { /* 库是空的，不吵 */ }
}

$('btnSelAll').onclick = () => {
  if (SEL.size === LIB.length) SEL.clear();
  else LIB.forEach(it => SEL.add(it.name));
  libSync();
};
$('btnSelNew').onclick = () => {
  const mk = zipMark();
  SEL.clear();
  LIB.forEach(it => { if (it.mt > mk) SEL.add(it.name); });
  libSync();
  say($('msgLib'), SEL.size ? `选中 ${SEL.size} 张新的（上次打包之后做的）` : '没有新的，都打包过了', 'ok');
};
$('btnSaveSel').onclick = () => {
  if (!SEL.size) return;
  if (SEL.size === 1) {
    const n = [...SEL][0];
    const a2 = document.createElement('a');
    a2.href = 'out/' + encodeURIComponent(n);
    a2.download = n;
    a2.click();
    return;
  }
  location.href = '/api/zip?names=' + encodeURIComponent([...SEL].join('|'));
};
$('btnDelSel').onclick = async () => {
  if (!SEL.size) return;
  if (!confirm(`删掉选中的 ${SEL.size} 张？`)) return;
  for (const n of [...SEL]) await api('/api/del', {name: n});
  SEL.clear();
  loadLib();
};
$('btnRefresh').onclick = loadLib;
$('btnZip').onclick = () => {
  localStorage.setItem('xhsZipAt', Date.now());
  location.href = '/api/zip';
  setTimeout(loadLib, 1200);
};
loadLib();

/* 退回修复前 */
$('btnFixBack').onclick = () => {
  const h = (S.fixHist || {})[S.cur];
  if (!h || !h.length) { say($('editTip2'), '这张没做过去水印，没得退。', 'err'); return; }
  const prev = h.pop();
  S.imgs[S.cur] = {name: prev};
  say($('editTip2'), '退回修复前了：' + prev, 'ok');
  openImg(S.cur);
};


/* ======== 以下为后挂模块：各自隔离，一块出错不连坐 ======== */
/* ======== 仿制图章（对齐模式）======== */
let clonePt = null, cloneOff = null, armSrc = false;
let srcLock = false;   // 固定源点：拖多长都从同一处取样（底下「小开关们」那块管它）


let curStroke = null;
function strokeStart(p) {
  cloneOff = {dx: clonePt.x - p.x, dy: clonePt.y - p.y};
  curStroke = {patches: [], dabs: [], off: {dx: cloneOff.dx, dy: cloneOff.dy}, src: {x: clonePt.x, y: clonePt.y}, lock: srcLock};
}
function endStroke() {
  const k = curStroke;
  curStroke = null;
  if (!k || !k.patches.length) return;
  hpush({
    kind: 'clone',
    undo: () => {
      for (let i = k.patches.length - 1; i >= 0; i--) restore(k.patches[i]);
      clonePt = {x: k.src.x, y: k.src.y}; markClone(); repaint();
    },
    redo: () => {
      const sv = srcLock;
      srcLock = !!k.lock;               // 按当初那一笔的模式重放，不管现在开关在哪
      clonePt = {x: k.src.x, y: k.src.y};
      cloneOff = {dx: k.off.dx, dy: k.off.dy};
      k.dabs.forEach(dd => cloneAt(dd.p, dd.r, true));
      srcLock = sv;
      markClone(); repaint();
    },
  });
}
function restore(u) {
  const od = orig.data, w = cv.width;
  for (let y = 0; y < u.h; y++)
    for (let x = 0; x < u.w; x++) {
      const si = (y * u.w + x) * 4, di = ((u.y + y) * w + u.x + x) * 4;
      od[di] = u.data[si]; od[di + 1] = u.data[si + 1];
      od[di + 2] = u.data[si + 2]; od[di + 3] = u.data[si + 3];
    }
}

function cloneAt(p, r, replay) {
  if (!clonePt) return;
  if (!srcLock && !cloneOff) return;
  const w = cv.width, h = cv.height, od = orig.data;
  const R = Math.max(2, Math.round(r));
  const x0 = Math.max(0, Math.round(p.x) - R), y0 = Math.max(0, Math.round(p.y) - R);
  const x1 = Math.min(w, Math.round(p.x) + R + 1), y1 = Math.min(h, Math.round(p.y) + R + 1);
  if (x1 <= x0 || y1 <= y0) return;
  const bw = x1 - x0, bh = y1 - y0;
  const snap = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const si = ((y0 + y) * w + x0 + x) * 4, di = (y * bw + x) * 4;
      snap[di] = od[si]; snap[di + 1] = od[si + 1];
      snap[di + 2] = od[si + 2]; snap[di + 3] = od[si + 3];
    }
  if (curStroke) {
    curStroke.patches.push({x: x0, y: y0, w: bw, h: bh, data: snap});
    if (!replay) curStroke.dabs.push({p: {x: p.x, y: p.y}, r});
  }
  // 锁住源点：每一下都重算偏移，取样区永远是源点那一圈
  const dx = srcLock ? Math.round(clonePt.x - p.x) : Math.round(cloneOff.dx);
  const dy = srcLock ? Math.round(clonePt.y - p.y) : Math.round(cloneOff.dy);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const ax = x - p.x, ay = y - p.y, d2 = ax * ax + ay * ay;
      if (d2 > R * R) continue;
      const sx = x + dx, sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const soft = Math.min(1, (R - Math.sqrt(d2)) / Math.max(1, R * 0.45));
      const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
      for (let t = 0; t < 4; t++) od[di + t] = od[di + t] * (1 - soft) + od[si + t] * soft;
    }
  if (!srcLock) { clonePt = {x: p.x + dx, y: p.y + dy}; markClone(); }   // 没锁才跟着笔走
  repaint();
}

$('btnReset').addEventListener('click', () => { while (HIST.past.length) hundo(); hclear(); });
$('btnSrc').onclick = () => {
  armSrc = true;
  say($('editTip2'), '点一下图上干净的地方，源点就定在那儿。', '');
};

/* ======== 源点标记（可直接拖） ======== */
let cmark = null;
function markClone() {
  if (!cmark) {
    cmark = document.createElement('div');
    cmark.className = 'clonemark';
    $('wrap').appendChild(cmark);
    cmark.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const move = ev => {
        const r = cv.getBoundingClientRect();
        clonePt = {
          x: Math.max(0, Math.min(cv.width, (ev.clientX - r.left) / r.width * cv.width)),
          y: Math.max(0, Math.min(cv.height, (ev.clientY - r.top) / r.height * cv.height)),
        };
        markClone();
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }
  cmark.style.display = clonePt ? '' : 'none';
  if (clonePt) {
    cmark.style.left = (clonePt.x / cv.width * 100) + '%';
    cmark.style.top = (clonePt.y / cv.height * 100) + '%';
  }
}

/* ======== 双指缩放 / 拖动 ======== */
const wrap = $('wrap');
const stg = $('stage');
const Z = {k: 1, x: 0, y: 0};
const pts = new Map();
let pinch = null, multi = false, tapOK = false, tapT = 0, lastTap = 0;

// 10.14：图按「整张塞进框里」摆，竖长图不再被切半截。
// 放大后能拖的范围按图的真实大小算；比框小的那一边居中。
function clampAxis(v, box, len) {
  if (len <= box) return (box - len) / 2;
  return Math.max(box - len, Math.min(0, v));
}
function applyZ() {
  Z.k = Math.max(1, Math.min(14, Z.k));
  const sw = stg.clientWidth, sh = stg.clientHeight || wrap.offsetHeight;
  Z.x = clampAxis(Z.x, sw, wrap.offsetWidth * Z.k);
  Z.y = clampAxis(Z.y, sh, wrap.offsetHeight * Z.k);
  wrap.style.transform = `translate(${Z.x}px,${Z.y}px) scale(${Z.k})`;
  $('zoomTip').textContent = Z.k.toFixed(1) + '×';
  $('zReset').style.display = Z.k > 1.02 ? '' : 'none';
  stg.classList.toggle('zoomed', Z.k > 1.02);
}
function resetZ() { Z.k = 1; Z.x = 0; Z.y = 0; applyZ(); }
$('zReset').onclick = resetZ;

let fitKey = '';
function fitWrap() {
  const onEdit = document.body.dataset.tab === 'cardEdit' || document.body.dataset.layout !== 'tabs';
  const cw = cv.width, ch = cv.height;
  if (!onEdit || cw < 2 || ch < 2 || !stg.clientWidth) return;
  const sw = stg.clientWidth, sh = stg.clientHeight;
  const fixedH = document.body.dataset.tab === 'cardEdit' && sh > 40;
  const s = fixedH ? Math.min(sw / cw, sh / ch) : sw / cw;
  wrap.style.width = Math.max(1, Math.floor(cw * s)) + 'px';
  const key = cw + 'x' + ch;
  if (key !== fitKey) { fitKey = key; Z.k = 1; Z.x = 0; Z.y = 0; }   // 换了图就回到整张
  applyZ();
}
window.fitWrap = fitWrap;
new MutationObserver(() => requestAnimationFrame(fitWrap))
  .observe(cv, {attributes: true, attributeFilter: ['width', 'height']});
new MutationObserver(() => requestAnimationFrame(fitWrap))
  .observe(document.body, {attributes: true, attributeFilter: ['data-tab']});
window.addEventListener('resize', () => requestAnimationFrame(fitWrap));
setTimeout(fitWrap, 0);

const uiK = () => { const w = stg.clientWidth; return w ? (stg.getBoundingClientRect().width / w) || 1 : 1; };
stg.addEventListener('pointerdown', ev => {
  pts.set(ev.pointerId, {x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY});
  if (pts.size === 1) { tapOK = true; tapT = Date.now(); }
  if (pts.size >= 2) {
    multi = true; tapOK = false;
    const [a, b] = [...pts.values()];
    pinch = {d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k: Z.k,
             cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, x: Z.x, y: Z.y};
    // 想缩放的手，不该在图上留一笔。
    // 第一指按下时橡皮/图章已经真的画下去了（而且写进 mask 了），
    // 以前这儿只是 drag=null，那半截笔留在图上还撤不回来 —— 整笔退掉。
    abortDrag();
  }
}, true);

stg.addEventListener('pointermove', ev => {
  const q = pts.get(ev.pointerId);
  if (!q) return;
  if (Math.abs(ev.clientX - q.sx) > 8 || Math.abs(ev.clientY - q.sy) > 8) tapOK = false;
  const px = q.x, py = q.y;
  q.x = ev.clientX; q.y = ev.clientY;
  if (pinch && pts.size >= 2) {
    const [a, b] = [...pts.values()];
    const k2 = Math.max(1, Math.min(14, pinch.k * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
    const r = stg.getBoundingClientRect(), u = uiK();
    const ox = (pinch.cx - r.left) / u, oy = (pinch.cy - r.top) / u;
    // 两指一起挪也算拖图：跟着两指中点走
    const mx = ((a.x + b.x) / 2 - pinch.cx) / u, my = ((a.y + b.y) / 2 - pinch.cy) / u;
    Z.x = ox - (ox - pinch.x) * k2 / pinch.k + mx;
    Z.y = oy - (oy - pinch.y) * k2 / pinch.k + my;
    Z.k = k2;
    applyZ();
    ev.preventDefault();
    return;
  }
  if (S.tool === 'pan' && pts.size === 1 && Z.k > 1.02) {
    const u = uiK();
    Z.x += (ev.clientX - px) / u; Z.y += (ev.clientY - py) / u;
    applyZ();
    ev.preventDefault();
  }
}, true);

const dropPt = ev => {
  const wasMulti = multi;
  pts.delete(ev.pointerId);
  if (pts.size < 2) pinch = null;
  if (pts.size === 0) {
    multi = false;
    // 只有「单指、没移动、没发生过多指」才算一次有效轻点
    if (tapOK && !wasMulti && Date.now() - tapT < 320) {
      const t = Date.now();
      if (t - lastTap < 320) {
        const r = stg.getBoundingClientRect(), u = uiK();
        const ox = (ev.clientX - r.left) / u, oy = (ev.clientY - r.top) / u;
        if (Z.k > 1.6) resetZ();
        else { const k2 = 3; Z.x = ox - (ox - Z.x) * k2 / Z.k; Z.y = oy - (oy - Z.y) * k2 / Z.k; Z.k = k2; applyZ(); }
        lastTap = 0;
      } else lastTap = t;
    }
    tapOK = false;
  }
};
stg.addEventListener('pointerup', dropPt, true);
stg.addEventListener('pointercancel', dropPt, true);

/* ======== 贴纸放大看：缩放 / 拖动 / 旋转 ======== */

/* ---------- 眼睛：显示/隐藏框和源点 ---------- */
let eyeOn = true;
$('btnEye').onclick = () => {
  eyeOn = !eyeOn;
  $('btnEye').innerHTML = '&#128065;';   // 关掉的样子用 CSS 划一道斜线，不用捂脸猴
  $('btnEye').classList.toggle('off', !eyeOn);
  $('boxes').style.visibility = eyeOn ? '' : 'hidden';
  if (cmark) cmark.style.visibility = eyeOn ? '' : 'hidden';
};

/* ---------- 切出来之后清掉边角碎渣 ---------- */
function dropSpecks(c, keepRatio) {
  const g = c.getContext('2d', {willReadFrequently: true});
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data, w = c.width, h = c.height, N = w * h;
  const lab = new Int32Array(N).fill(-1);
  const stack = new Int32Array(N);
  const areas = [];
  for (let i = 0; i < N; i++) {
    if (lab[i] >= 0 || d[i * 4 + 3] <= 10) continue;
    const id = areas.length;
    let sp = 0, n = 0;
    lab[i] = id; stack[sp++] = i;
    while (sp > 0) {
      const q = stack[--sp], x = q % w;
      n++;
      const t = j => { if (lab[j] < 0 && d[j * 4 + 3] > 10) { lab[j] = id; stack[sp++] = j; } };
      if (x > 0) t(q - 1);
      if (x < w - 1) t(q + 1);
      if (q >= w) t(q - w);
      if (q < N - w) t(q + w);
      if (x > 0 && q >= w) t(q - w - 1);
      if (x < w - 1 && q >= w) t(q - w + 1);
      if (x > 0 && q < N - w) t(q + w - 1);
      if (x < w - 1 && q < N - w) t(q + w + 1);
    }
    areas.push(n);
  }
  if (areas.length <= 1) return 0;
  const big = Math.max.apply(null, areas);
  const floor = big * keepRatio;
  let killed = 0;
  for (let i = 0; i < N; i++) {
    const id = lab[i];
    if (id >= 0 && areas[id] < floor) { d[i * 4 + 3] = 0; killed++; }
  }
  if (killed) g.putImageData(im, 0, 0);
  return areas.filter(a => a < floor).length;
}

/* ---------- 导入本地图片（可多选） ---------- */
$('fileIn').onchange = async e => {
  const fs = [...e.target.files];
  if (!fs.length) return;
  say($('msgFetch'), `正在读 ${fs.length} 张…`);
  try {
    const files = await Promise.all(fs.map(f => new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok({name: f.name, data: r.result});
      r.onerror = no;
      r.readAsDataURL(f);
    })));
    const j = await api('/api/upload', {files});
    const old = S.imgs.length;
    j.saved.forEach(n => S.imgs.push({name: n}));
    S.imgs.forEach(x => { if (!S.states[x.name])
      S.states[x.name] = {boxes: [], mask: [], alpha: true, tol: 34, erode: false, key: null, wands: []}; });
    renderGrid();
    $('cardPick').classList.remove('hide');
    say($('msgFetch'), `导入 ${j.count} 张，排在第 ${old + 1} 位往后。点缩略图开始切。`, 'ok');
  } catch (err) {
    say($('msgFetch'), '导入失败：' + err.message, 'err');
  }
  e.target.value = '';
};



window.renderBoxes = renderBoxes;

/* ======================================================================
   10.14 小开关们：固定源点 / 间距 / 框线颜色 / 整体缩放
   四个各自独立，谁坏了不连坐；全部记在 localStorage，下次开还是这样
   ====================================================================== */
(function () {

  /* ---- ① 固定源点 + 间距 ---- */
  const LK = 'xhsSrcLock', GP = 'xhsCloneGap';
  const bl = $('btnLock'), gs = $('gap'), gv = $('gapV');

  window.cloneGap = () => srcLock ? (+gs.value / 100) : 0;   // 没锁就连续涂，别改她习惯的手感

  function paintLock() {
    bl.classList.toggle('on', srcLock);
    bl.innerHTML = srcLock ? '&#128274; 源点锁住' : '&#128275; 固定源点';
    bl.title = srcLock
      ? '源点锁住了：拖多长都从同一处取样，配合间距能盖出一串一样的花'
      : '现在源点跟着笔走（对齐模式），点一下锁住它';
    $('rowClone').classList.toggle('nogap', !srcLock);
    gs.disabled = !srcLock;
  }
  function paintGap() {
    gv.textContent = (+gs.value / 100).toFixed(1) + '×';
  }

  srcLock = localStorage.getItem(LK) === '1';
  const g0 = localStorage.getItem(GP);
  if (g0 !== null) gs.value = g0;
  paintLock(); paintGap();

  bl.onclick = () => {
    srcLock = !srcLock;
    localStorage.setItem(LK, srcLock ? '1' : '0');
    paintLock();
    if (srcLock && clonePt) cloneOff = null;
    say($('editTip2'), srcLock
      ? '源点锁住了。拖一条线就是一串一样的图案，一朵挨多近看「间距」。'
      : '源点松开了，又跟着笔走（想搬一整块就用这个）。', srcLock ? 'ok' : '');
  };
  gs.oninput = () => { paintGap(); localStorage.setItem(GP, gs.value); };

  /* ---- ② 框线：金 / 银 ---- */
  const LN = 'xhsLine', bn = $('btnLine');
  function paintLine() {
    const s = document.body.dataset.line === 'silver';
    bn.innerHTML = s ? '&#9680;' : '&#9681;';
    bn.title = s ? '框线现在是银白，点一下换回金' : '框线现在是金，点一下换银白';
  }
  document.body.dataset.line = localStorage.getItem(LN) || 'gold';
  paintLine();
  bn.onclick = () => {
    const s = document.body.dataset.line === 'silver';
    document.body.dataset.line = s ? 'gold' : 'silver';
    localStorage.setItem(LN, document.body.dataset.line);
    paintLine();
  };

  /* ---- ③ 整体缩放 75 / 85 / 100 ---- */
  const UI = 'xhsUi', bu = $('btnUi'), STEP = [75, 85, 100];
  function paintUi(v) {
    document.documentElement.style.setProperty('--ui', v / 100);
    bu.textContent = v + '%';
    bu.classList.toggle('on', v !== 100);
  }
  let uv = +(localStorage.getItem(UI) || 75);
  if (!STEP.includes(uv)) uv = 75;
  paintUi(uv);
  bu.onclick = () => {
    uv = STEP[(STEP.indexOf(uv) + 1) % STEP.length];
    localStorage.setItem(UI, uv);
    paintUi(uv);
    if (window.syncStage) try { syncStage(); } catch (e) {}
    requestAnimationFrame(() => window.fitWrap && fitWrap());
  };

})();
