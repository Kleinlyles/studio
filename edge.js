'use strict';
/* ======== 砖 3：贴纸边 ========
   自己的画布（#edgeHost 里）、自己的缩略条、自己的参数面板。
   只和外面说三句话：
     听 BUS 'cuts'   —— 切块变了，重算重画
     喊 BUS 'cuts'   —— 自己改完参数了，告诉别人
     调 window.makeSticker / Viewer.open / toEdit
   编辑页那套框选手柄在另一块画布上，碰不到这里。 */
(function () {

  /* ---------- 预加载材质贴图 ---------- */
  const MATS = ['gold_foil', 'silver_brush', 'porcelain', 'glitter_duo', 'holo', 'holo_flame',
                'nacre', 'nacre_pink', 'nacre_black', 'nacre_gold'];
  window.TEX = window.TEX || {};
  let texReady = 0;
  MATS.forEach(k => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const cc = c.getContext('2d', {willReadFrequently: true});
      cc.drawImage(im, 0, 0);
      const g = cc.getImageData(0, 0, c.width, c.height);
      window.TEX[k] = {data: g.data, w: c.width, h: c.height};
      if (++texReady === MATS.length && S.raw && S.raw.length) apply();
    };
    im.onerror = () => console.warn('贴图没加载上', k);
    im.src = 'tex/' + k + '.png';
  });

  /* ---------- 贴纸台：自己搭自己的画布 ---------- */
  const host = $('edgeHost');
  host.innerHTML =
    '<div class="einfo"><span id="eInfo">还没切</span>' +
    '<button class="ezoom" id="eZoom" title="放大看">&#128269;</button></div>' +
    '<div class="estage ' + 'echk"><canvas id="ecv"></canvas></div>' +
    '<div class="estrip" id="eStrip"></div>';
  const ecv = $('ecv'), ectx = ecv.getContext('2d');
  let sel = 0;   // 当前看第几块

  function paintStage() {
    const c = (S.cuts[sel] || {}).canvas;
    if (!c) {
      ecv.width = 1; ecv.height = 1;
      $('eInfo').textContent = '还没切';
      return;
    }
    ecv.width = c.width; ecv.height = c.height;
    ectx.clearRect(0, 0, c.width, c.height);
    ectx.imageSmoothingQuality = 'high';
    ectx.drawImage(c, 0, 0);
    $('eInfo').textContent = (S.cuts.length > 1 ? `第 ${sel + 1} / ${S.cuts.length} 块 · ` : '')
      + `${c.width}×${c.height}`;
  }

  function paintStrip() {
    const strip = $('eStrip');
    strip.innerHTML = '';
    strip.classList.toggle('hide', S.cuts.length < 2);
    S.cuts.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'ethumb' + (i === sel ? ' on' : '');
      const k = Math.min(1, 150 / Math.max(c.canvas.width, c.canvas.height));
      const m = document.createElement('canvas');
      m.width = Math.max(1, Math.round(c.canvas.width * k));
      m.height = Math.max(1, Math.round(c.canvas.height * k));
      const mc = m.getContext('2d');
      mc.imageSmoothingQuality = 'high';
      mc.drawImage(c.canvas, 0, 0, m.width, m.height);
      d.appendChild(m);
      const n = document.createElement('i');
      n.textContent = c.label;
      d.appendChild(n);
      d.onclick = () => { sel = i; paintStage(); paintStrip(); };
      strip.appendChild(d);
    });
  }

  /* ---------- 算：给每块切块描边 ---------- */
  function apply() {
    if (!S.raw.length) {
      S.cuts = [];
      paintStage(); paintStrip();
      if (window.syncStage) window.syncStage();
      return;
    }
    S.cuts = S.raw.map(r => ({
      label: r.label,
      canvas: window.makeSticker(r.canvas, {
        border: EDGE.border, outer: EDGE.outer,
        color: EDGE.color, outerColor: EDGE.outerColor, freq: EDGE.freq,
      }),
    }));
    if (sel >= S.cuts.length) sel = 0;
    paintStage(); paintStrip();
    if (window.syncStage) window.syncStage();
    say($('msgEdge'), `${S.cuts.length} 块已就绪。调什么都是实时的，这套边会套给全部切块。`, 'ok');
  }
  window.applyEdge = apply;          // 老代码还在喊这个名字，留个门
  BUS.on('cuts', apply);

  let t = 0;
  const later = () => { clearTimeout(t); t = setTimeout(apply, 110); };

  $('eZoom').onclick = () => {
    if (!S.cuts.length) return;
    Viewer.open(S.cuts.map(c => c.canvas), sel);
  };

  /* ---------- 参数：白边 / 第二圈 / 纹理缩放 ---------- */
  $('bw').oninput = e => { $('bwV').textContent = e.target.value; EDGE.border = +e.target.value; later(); };
  $('ow').oninput = e => {
    $('owV').textContent = e.target.value; EDGE.outer = +e.target.value;
    $('rowOuter').classList.toggle('hide', EDGE.outer === 0);
    syncFreq(); later();
  };
  $('freq').oninput = e => {
    EDGE.freq = +e.target.value;
    $('freqV').textContent = (EDGE.freq / 16).toFixed(1) + '×';
    later();
  };

  const isTex = c => !!c && c[0] !== '#' && c !== 'custom';
  function syncCustom() {
    const on = EDGE.color === 'custom' || (EDGE.outer > 0 && EDGE.outerColor === 'custom');
    $('boxCustom').classList.toggle('hide', !on);
    if (on) $('boxCustom').open = true;
  }
  function syncFreq() {
    const on = isTex(EDGE.color) || (EDGE.outer > 0 && isTex(EDGE.outerColor))
      || (CUSTOM.tex && CUSTOM.tex !== 'none');
    $('rowFreq').classList.toggle('hide', !on);
    syncCustom();
  }

  $('edgeColor').onclick = e => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    EDGE.color = b.dataset.c;
    [...$('edgeColor').children].forEach(x => x.classList.toggle('on', x === b));
    b.scrollIntoView({block: 'nearest', inline: 'center'});
    syncFreq(); apply();
  };
  $('outerColor').onclick = e => {
    const b = e.target.closest('button[data-c]');
    if (!b) return;
    EDGE.outerColor = b.dataset.c;
    [...$('outerColor').children].forEach(x => x.classList.toggle('on', x === b));
    b.scrollIntoView({block: 'nearest', inline: 'center'});
    syncFreq(); apply();
  };

  /* ---------- 自选色 ---------- */
  function renderStops() {
    $('stops').innerHTML = CUSTOM.stops.map((c, i) =>
      `<span class="st"><input type="color" value="${c}" data-i="${i}">` +
      (CUSTOM.stops.length > 1 ? `<b data-del="${i}">×</b>` : '') + '</span>').join('')
      + (CUSTOM.stops.length < 6 ? '<button class="addst" id="addSt">＋</button>' : '');
  }
  $('stops').addEventListener('input', e => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    CUSTOM.stops[+i] = e.target.value;
    later();
  });
  $('stops').addEventListener('click', e => {
    if (e.target.id === 'addSt') { CUSTOM.stops.push('#ffffff'); renderStops(); return; }
    const d = e.target.dataset.del;
    if (d !== undefined && CUSTOM.stops.length > 1) {
      CUSTOM.stops.splice(+d, 1); renderStops(); later();
    }
  });
  $('quickC').onclick = e => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    CUSTOM.stops = [b.dataset.q];
    renderStops(); later();
  };
  $('cTex').onclick = e => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    CUSTOM.tex = b.dataset.t;
    [...$('cTex').children].forEach(x => x.classList.toggle('on', x === b));
    b.scrollIntoView({block: 'nearest', inline: 'center'});
    syncTexRow(); syncFreq(); apply();
  };
  function syncTexRow() {
    const on = CUSTOM.tex && CUSTOM.tex !== 'none';
    $('rowMix').classList.toggle('hide', !on);
    $('rowBleed').classList.toggle('hide', !on);
  }
  $('cMix').oninput = e => {
    CUSTOM.mix = +e.target.value / 100;
    $('cMixV').textContent = e.target.value + '%'; later();
  };
  $('cBleed').oninput = e => {
    CUSTOM.bleed = +e.target.value / 100;
    $('cBleedV').textContent = e.target.value + '%'; later();
  };
  $('cAngle').oninput = e => {
    CUSTOM.angle = +e.target.value;
    $('cAngleV').textContent = e.target.value + '°'; later();
  };
  $('cGrain').oninput = e => {
    CUSTOM.grain = +e.target.value / 100;
    $('cGrainV').textContent = e.target.value + '%'; later();
  };

  /* ---------- 我的配方：一套参数存下来，一键套 ---------- */
  const KEY = 'xhsEdgeRecipes';
  const loadR = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const saveR = r => localStorage.setItem(KEY, JSON.stringify(r));
  function renderR() {
    const r = loadR(), names = Object.keys(r);
    $('recipe').innerHTML = '<option value="">— 我的配方 —</option>'
      + names.map(n => `<option value="${n}">${n}</option>`).join('');
    $('btnRecDel').disabled = !names.length;
  }
  $('btnRecSave').onclick = () => {
    const n = (prompt('这套叫什么名字？', '配方 ' + (Object.keys(loadR()).length + 1)) || '').trim();
    if (!n) return;
    const r = loadR();
    r[n] = {EDGE: JSON.parse(JSON.stringify(EDGE)), CUSTOM: JSON.parse(JSON.stringify(CUSTOM))};
    saveR(r); renderR();
    $('recipe').value = n;
    say($('msgEdge'), `存好了：${n}。以后在上面那个下拉里一键套。`, 'ok');
  };
  $('btnRecDel').onclick = () => {
    const n = $('recipe').value;
    if (!n) return say($('msgEdge'), '先在下拉里选一套要删的。', 'err');
    const r = loadR();
    delete r[n]; saveR(r); renderR();
    say($('msgEdge'), `删了：${n}`, 'ok');
  };
  $('recipe').onchange = e => {
    const n = e.target.value;
    if (!n) return;
    const r = loadR()[n];
    if (!r) return;
    Object.assign(EDGE, r.EDGE);
    Object.assign(CUSTOM, r.CUSTOM);
    pushToUI();
    apply();
    say($('msgEdge'), `套上了：${n}`, 'ok');
  };

  /* 参数回写到控件上（套配方、外部改过都靠它） */
  function pushToUI() {
    $('bw').value = EDGE.border; $('bwV').textContent = EDGE.border;
    $('ow').value = EDGE.outer; $('owV').textContent = EDGE.outer;
    $('freq').value = EDGE.freq; $('freqV').textContent = (EDGE.freq / 16).toFixed(1) + '×';
    $('rowOuter').classList.toggle('hide', EDGE.outer === 0);
    [...$('edgeColor').children].forEach(x => x.classList.toggle('on', x.dataset.c === EDGE.color));
    [...$('outerColor').children].forEach(x => x.classList.toggle('on', x.dataset.c === EDGE.outerColor));
    [...$('cTex').children].forEach(x => x.classList.toggle('on', x.dataset.t === CUSTOM.tex));
    $('cMix').value = Math.round(CUSTOM.mix * 100); $('cMixV').textContent = Math.round(CUSTOM.mix * 100) + '%';
    $('cBleed').value = Math.round(CUSTOM.bleed * 100); $('cBleedV').textContent = Math.round(CUSTOM.bleed * 100) + '%';
    $('cAngle').value = CUSTOM.angle; $('cAngleV').textContent = CUSTOM.angle + '°';
    $('cGrain').value = Math.round(CUSTOM.grain * 100); $('cGrainV').textContent = Math.round(CUSTOM.grain * 100) + '%';
    renderStops(); syncTexRow(); syncFreq();
  }

  /* ---------- 存了去修：带边贴纸送回编辑台 ---------- */
  $('btnToEdit').onclick = async () => {
    const c = S.cuts[sel];
    if (!c) return say($('msgEdge'), '还没有切块。', 'err');
    $('btnToEdit').disabled = true;
    say($('msgEdge'), '正在送回编辑台…');
    try {
      await window.toEdit(c.canvas, '贴纸' + c.label);
      say($('msgEdge'), '已经在编辑台了，橡皮、仿制图章、水印笔都能用在这张贴纸上。', 'ok');
      if (window.goTab) window.goTab('cardEdit');
    } catch (e) {
      say($('msgEdge'), '送不回去：' + e.message, 'err');
    }
    $('btnToEdit').disabled = false;
  };

  renderR();
  pushToUI();
})();
