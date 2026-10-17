"use strict";(function(){const K="xhsDesk",b=document.body,css=document.createElement("style");
css.textContent=`body.desk .wrap{max-width:440px!important;width:440px!important;margin-left:auto!important;margin-right:auto!important}
body.desk:has(#stageHost:not(.off)) .wrap{margin-right:0!important}
body.desk #stageHost:not(.off){position:fixed;left:0;top:0;bottom:0;right:440px;padding:12px;display:flex;flex-direction:column;gap:6px;z-index:5;background:var(--bg,#0d0f12)}
body.desk #stageHost:not(.off) .stage{flex:1 1 auto;height:auto!important;max-height:none!important;min-height:0;margin:0}
#deskBtn{position:fixed;top:8px;right:8px;z-index:10000;padding:5px 10px;font-size:12px;border-radius:999px;border:1px solid rgba(217,179,108,.5);background:#15181cee;color:#f0d9a8;cursor:pointer}`;
document.head.appendChild(css);const btn=document.createElement("button");btn.id="deskBtn";btn.type="button";
function set(on){b.classList.toggle("desk",on);btn.textContent=on?"📱 手机版":"🖥 电脑版";btn.title=on?"切回手机布局":"切到电脑布局：画布在左边放大，工具在右边";try{localStorage.setItem(K,on?"1":"0")}catch(_){}
requestAnimationFrame(()=>{window.fitWrap&&fitWrap();window.renderBoxes&&renderBoxes();dispatchEvent(new Event("resize"))})}
btn.onclick=()=>set(!b.classList.contains("desk"));b.appendChild(btn);let on=!1;try{on=localStorage.getItem(K)==="1"}catch(_){}set(on)})();
