'use strict';
/* ======== 砖 2：放大窗（只看，不调）========
   对外只有 Viewer.open(图或图数组, 从第几张开始)。
   调边的面板已经撤走了 —— 调边在贴纸页做，这里纯看效果，左右能翻页。 */
window.Viewer = (function () {

  function open(src, idx) {
    const list = Array.isArray(src) ? src : [src];
    let i = Math.max(0, Math.min(list.length - 1, idx || 0));

    const box = document.createElement('div');
    box.className = 'lightbox';
    const view = document.createElement('div');
    view.className = 'lbview lbchk';
    const c = document.createElement('canvas');
    view.appendChild(c);
    box.appendChild(view);

    const lab = document.createElement('div');
    lab.className = 'lblab';
    box.appendChild(lab);

    const bar = document.createElement('div');
    bar.className = 'lbbar';
    bar.innerHTML = '<button data-a="out">－</button><button data-a="fit">适配</button>'
      + '<button data-a="in">＋</button><button data-a="rot">旋转</button>'
      + '<button data-a="close">关掉</button>';
    box.appendChild(bar);

    /* 左右翻页箭头：只有多张时才挂上来 */
    let navL = null, navR = null;
    if (list.length > 1) {
      navL = document.createElement('button');
      navL.className = 'lbnav l';
      navL.innerHTML = '&#8249;';
      navR = document.createElement('button');
      navR.className = 'lbnav r';
      navR.innerHTML = '&#8250;';
      box.appendChild(navL);
      box.appendChild(navR);
      navL.onclick = e => { e.stopPropagation(); step(-1); };
      navR.onclick = e => { e.stopPropagation(); step(1); };
    }

    let cur = null, fit = 1, k = 1, rot = 0, tx = 0, ty = 0;

    function load(n) {
      cur = list[n];
      c.width = cur.width; c.height = cur.height;
      const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(cur, 0, 0);
      // 贴纸放大了不一定好看，默认就停在「适配」这一档
      fit = Math.max(0.04, Math.min(window.innerWidth * 0.92 / cur.width,
                                    (window.innerHeight - 160) / cur.height));
      k = fit; rot = 0; tx = 0; ty = 0;
      put();
    }
    function step(d) {
      i = (i + d + list.length) % list.length;
      load(i);
    }
    function put() {
      c.style.width = (cur.width * k) + 'px';
      c.style.height = (cur.height * k) + 'px';
      c.style.transform = `translate(${tx}px,${ty}px) rotate(${rot}deg)`;
      lab.textContent = (list.length > 1 ? `${i + 1}/${list.length} · ` : '')
        + `${cur.width}×${cur.height} · ${Math.round(k / fit * 100)}%`
        + (rot ? ` · ${rot}°` : '');
    }

    const close = () => { box.remove(); document.removeEventListener('keydown', key); };
    const key = e => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft' && list.length > 1) step(-1);
      else if (e.key === 'ArrowRight' && list.length > 1) step(1);
    };
    document.addEventListener('keydown', key);

    bar.addEventListener('click', e => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      e.stopPropagation();
      if (a === 'in') k = Math.min(fit * 16, k * 1.5);
      else if (a === 'out') k = Math.max(fit * 0.35, k / 1.5);
      else if (a === 'fit') { k = fit; tx = 0; ty = 0; rot = 0; }
      else if (a === 'rot') rot = (rot + 90) % 360;
      else if (a === 'close') { close(); return; }
      put();
    });

    /* 单指拖、双指捏 */
    const P = new Map();
    let pk = null, bd = null, moved = false;
    box.addEventListener('pointerdown', e => {
      if (e.target.closest('.lbbar') || e.target.closest('.lbnav')) return;
      P.set(e.pointerId, {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY});
      moved = false;
      if (P.size === 2) {
        const [a, b] = [...P.values()];
        pk = {d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k: k};
      }
      if (e.target === box || e.target === view) bd = {x: e.clientX, y: e.clientY};
    });
    box.addEventListener('pointermove', e => {
      const q = P.get(e.pointerId);
      if (!q) return;
      const px = q.x, py = q.y;
      q.x = e.clientX; q.y = e.clientY;
      if (Math.abs(e.clientX - q.x0) > 8 || Math.abs(e.clientY - q.y0) > 8) moved = true;
      if (pk && P.size >= 2) {
        const [a, b] = [...P.values()];
        k = Math.max(fit * 0.35, Math.min(fit * 16,
          pk.k * Math.hypot(a.x - b.x, a.y - b.y) / pk.d));
        put();
      } else if (P.size === 1) {
        tx += e.clientX - px; ty += e.clientY - py;
        put();
      }
      e.preventDefault();
    });
    const off = e => {
      const q = P.get(e.pointerId);
      // 没缩放的时候，横着甩一下翻页
      if (q && list.length > 1 && !pk && Math.abs(k - fit) < 0.001) {
        const dx = e.clientX - q.x0;
        if (Math.abs(dx) > 55 && Math.abs(e.clientY - q.y0) < 60) {
          P.delete(e.pointerId); bd = null;
          step(dx < 0 ? 1 : -1);
          return;
        }
      }
      // 点空白处关掉（动过就不算）
      if (bd && !moved && (e.target === box || e.target === view) &&
          Math.abs(e.clientX - bd.x) < 9 && Math.abs(e.clientY - bd.y) < 9) {
        bd = null; close(); return;
      }
      bd = null;
      P.delete(e.pointerId);
      if (P.size < 2) pk = null;
    };
    box.addEventListener('pointerup', off);
    box.addEventListener('pointercancel', off);

    load(i);
    document.body.appendChild(box);
  }

  /* 存进来的是文件名，顺手包一层：从 out/ 读出来再放大 */
  function openUrl(url) {
    const im = new Image();
    im.onload = () => open(im);
    im.src = url;
  }

  return {open: open, openUrl: openUrl};
})();
