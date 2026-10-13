'use strict';
/* ======== 砖 1：外壳（标签栏 + 谁在屏幕上）========
   只做三件事：把画布区钉在顶上、把卡片装进可滚区、底下一条标签栏。
   不监听别人的 class（上一版那个 MutationObserver 会和 app.js 互相弹成死循环，已拔掉）。
   对外只给 window.goTab(id)。 */
(function () {
  const body = document.body;
  const host0 = body.querySelector('.wrap') || body;
  const cards = [].slice.call(host0.children).filter(
    el => el.classList && el.classList.contains('card'));
  if (!cards.length) return;
  if (!cards[0].id) cards[0].id = 'cardGet';

  /* 1) 编辑台画布：搬到顶上固定取景区 */
  const editHost = document.createElement('div');
  editHost.className = 'stagehost off';
  editHost.id = 'stageHost';
  host0.insertBefore(editHost, host0.firstChild);
  const stage = document.getElementById('stage');
  if (stage) editHost.appendChild(stage);
  const tip2 = document.getElementById('editTip2');
  if (tip2) editHost.appendChild(tip2);

  /* 2) 贴纸台画布：另一块地，贴纸砖自己往里填。两块画布彻底分开，
        编辑页的框和手柄结构上不可能漏到贴纸页 */
  const edgeHost = document.createElement('div');
  edgeHost.className = 'stagehost off';
  edgeHost.id = 'edgeHost';
  host0.insertBefore(edgeHost, editHost.nextSibling);

  /* 3) 卡片装进可滚动面板区 */
  const panels = document.createElement('div');
  panels.className = 'panels';
  panels.id = 'panels';
  cards.forEach(c => panels.appendChild(c));
  body.setAttribute('data-layout', 'tabs');
  host0.appendChild(panels);

  const wait = document.createElement('p');
  wait.className = 'waitTip hide';
  wait.id = 'waitTip';
  panels.appendChild(wait);

  /* 4) 「切出来 / 存进素材库」跟着内容滑，排在面板内容最下面 */
  const actbar = body.querySelector('.bar');
  if (actbar) panels.appendChild(actbar);

  /* 5) 标签栏 */
  const TABS = [
    ['cardGet', '抓图', '&#128279;'],
    ['cardPick', '选图', '&#128443;'],
    ['cardEdit', '编辑', '&#9988;'],
    ['cardEdge', '贴纸边', '&#9728;'],
    ['cardOut', '导出', '&#128190;'],
    ];
  const bar = document.createElement('div');
  bar.className = 'tabbar';
  bar.id = 'tabbar';
  bar.innerHTML = TABS.map(t =>
    `<button data-t="${t[0]}"><i>${t[2]}</i><span>${t[1]}</span></button>`).join('');
  host0.appendChild(bar);

  const NEED = {
    cardPick: '先在「抓图」里抓个链接，或者导入本地图片。',
    cardEdit: '先去「选图」点一张图。',
    cardEdge: '先在「编辑」里框好要的部分，按「切出来」。',
    cardOut: '先切出至少一块。',
    cardLib: '素材库还是空的，存几张进来。',
  };
  const SHOWBAR = {cardEdit: 1, cardEdge: 1, cardOut: 1, cardLib: 1};
  /* 哪页显示哪块画布：edit=原图取景，edge/out=成品贴纸 */
  const STAGE = {cardEdit: 'edit', cardEdge: 'edge', cardOut: 'edge'};

  let cur = 'cardGet';
  function go(id, force) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!force && el.classList.contains('hide') && NEED[id]) {
      wait.textContent = NEED[id];
      wait.classList.remove('hide');
    } else {
      wait.classList.add('hide');
    }
    cur = id;
    body.dataset.tab = id;
    cards.forEach(c => c.classList.toggle('on', c.id === id));
    bar.querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', b.dataset.t === id));
    if (actbar) actbar.classList.toggle('off', !SHOWBAR[id]);
    syncStage();
    panels.scrollTop = 0;
    if (STAGE[id] === 'edit' && window.__hasImg && typeof window.renderBoxes === 'function') {
      setTimeout(window.renderBoxes, 30);
    }
    BUS.emit('tab', id);
  }

  function syncStage() {
    const want = STAGE[cur] || '';
    const hasImg = !!window.__hasImg;
    const hasCut = !!(S.cuts && S.cuts.length);
    editHost.classList.toggle('off', !(want === 'edit' && hasImg));
    edgeHost.classList.toggle('off', !(want === 'edge' && hasCut));
  }
  window.syncStage = syncStage;
  BUS.on('cuts', syncStage);

  bar.addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (b) go(b.dataset.t);
  });
  window.goTab = go;

  /* 6) 有图没图，决定编辑取景区显不显示 */
  const cvEl = document.getElementById('cv');
  if (cvEl) {
    const chk = () => {
      window.__hasImg = S.cur >= 0 && cvEl.width > 1 && cvEl.height > 1;
      syncStage();
    };
    new MutationObserver(chk).observe(cvEl, {attributes: true, attributeFilter: ['width', 'height']});
    chk();
  }

  /* 7) 老代码里的 scrollIntoView 在分页里没意义，改成切页 */
  const oldSIV = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (o) {
    if (this.classList && this.classList.contains('card') && this.id) {
      go(this.id);
      return;
    }
    return oldSIV.call(this, o);
  };

  go('cardGet', true);
})();
