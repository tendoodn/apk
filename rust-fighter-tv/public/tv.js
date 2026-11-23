'use strict';
(() => {
  const {characters, wsUrl, hexAlpha} = window.RF;
  const $ = id => document.getElementById(id);
  const canvas = $('arena'), ctx = canvas.getContext('2d', {alpha:false});
  const bg = document.createElement('canvas'); bg.width=1280; bg.height=720;
  const bgc = bg.getContext('2d', {alpha:false});
  const W=1280, H=720;
  let state=null, socket=null, oldHP=[100,100], lastKey='', lastPairKey='', renderedAt=0;
  let sparks=[];
  const setup=$('setup'), game=$('gameShell');
  setup.classList.add('hidden');
  game.classList.remove('hidden');
  $('newRoom').textContent='PHÒNG MỚI';
  function refreshLanAddress(){
    let ip='';
    try { ip=window.TvHost?.ipAddress?.()||''; } catch (_) {}
    const available=ip && ip!=='0.0.0.0';
    $('tvIpBadge').textContent=available?`TV IP: ${ip}:3000`:'TV CHƯA CÓ IP MẠNG';
    $('phoneUrl').textContent=available?`Trên Remote, nhập IP ${ip} và mã 6 số phía trên`:'TV cần kết nối Wi-Fi/LAN để ghép tay cầm';
  }
  refreshLanAddress();
  setInterval(refreshLanAddress,5000);
  function openRoom(){
    if(socket && socket.readyState !== WebSocket.CLOSED) return;
    try {socket=new WebSocket(wsUrl('/ws?role=tv'));}
    catch(error){$('roomModeLabel').textContent='LỖI MÁY CHỦ: '+error.message;setTimeout(openRoom,2000);return;}
    $('roomModeLabel').textContent='CHỜ TAY CẦM 1 CHỌN CHẾ ĐỘ';
    socket.onopen=()=>{
      refreshLanAddress();
    };
    socket.onmessage=event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='state'){const previous=state;state=data;onState(previous,data);}
      if(data.type==='error')$('roomModeLabel').textContent=data.message;
    };
    socket.onerror=()=>{$('roomModeLabel').textContent='ĐANG KẾT NỐI LẠI MÁY CHỦ…';};
    socket.onclose=()=>{
      socket=null;state=null;lastKey='';lastPairKey='';
      $('pairStrip').innerHTML='';
      $('roomModeLabel').textContent='MẤT KẾT NỐI · ĐANG THỬ LẠI';
      setTimeout(openRoom,2500);
    };
  }
  $('newRoom').addEventListener('click',()=>{if(socket)socket.close();});
  openRoom();

  function onState(prev,s){
    const pairKey=JSON.stringify([s.codes,s.phase,s.mode]);
    if(pairKey!==lastPairKey){
      lastPairKey=pairKey;
      const codes=(s.codes||[]).slice(0,s.mode===2?2:1);
      $('pairStrip').innerHTML=codes.map(c=>`<div class="pair-card ${c.connected?'connected':''}"><span class="pair-icon">${c.connected?'✓':'⌁'}</span><div><div class="pair-player">TAY CẦM ${c.slot}</div><div class="pair-code">${c.connected?'ĐÃ KẾT NỐI':c.code}</div></div></div>`).join('');
    }
    $('roomModeLabel').textContent=s.mode===0?'TAY CẦM 1 CHỌN CHẾ ĐỘ':s.mode===1?'1 NGƯỜI · ĐẤU MÁY':'2 NGƯỜI · ĐỐI KHÁNG';
    const selecting=s.phase==='lobby' && s.mode!==0;
    $('selectOverlay').classList.toggle('hidden',!selecting);
    if(selecting){
      const pickKey=JSON.stringify([s.picks,s.ready,s.connected,s.mode]);
      if(pickKey!==lastKey){lastKey=pickKey;
        $('selectLeft').innerHTML=selectMarkup(0,s);
        $('selectRight').innerHTML=selectMarkup(1,s);
        window.RF.paintPortraits($('selectOverlay'));
      }
    }
    const notice=$('centerNotice');
    const eyebrow=$('noticeEyebrow'),title=$('noticeText'),sub=$('noticeSub');
    notice.classList.toggle('hidden',selecting||s.phase==='fight'||s.phase==='paused');
    if(s.mode===0){
      eyebrow.textContent='CHỦ PHÒNG · PLAYER 01';
      title.textContent='CHỌN CHẾ ĐỘ';
      sub.textContent='KẾT NỐI ĐIỆN THOẠI 1 · CHỌN 1 NGƯỜI HOẶC 2 NGƯỜI';
    }else if(s.phase==='countdown'){
      eyebrow.textContent=`HIỆP ${s.round} / 3`;
      title.textContent=Math.max(1,Math.ceil(s.phase_ticks/30));
      sub.textContent=s.reversed?'ĐÃ ĐỔI VỊ TRÍ · SẴN SÀNG!':'CHUẨN BỊ GIAO CHIẾN';
    }else if(s.phase==='round_end'){
      eyebrow.textContent=`HIỆP ${s.round} KẾT THÚC`;
      title.textContent=`${s.scores[0]} : ${s.scores[1]}`;
      sub.textContent=s.message+(s.round<3?' · HIỆP SAU ĐỔI BÊN':'');
    }else if(s.phase==='match_end'){
      eyebrow.textContent='TRẬN ĐẤU KẾT THÚC';
      title.textContent='KẾT THÚC';
      sub.textContent=s.message+' · BẤM ĐẤU LẠI TRÊN ĐIỆN THOẠI';
    }
    $('disconnected').classList.toggle('hidden',s.phase!=='paused');
    if(prev && s.phase==='fight'){
      s.fighters.forEach((f,i)=>{
        if(f.hp < oldHP[i]){
          const enemy=s.fighters[i];
          const foe=s.fighters[1-i];
          burst(enemy.x,550-enemy.y-90,characters[s.picks[1-i]].accent,Math.min(20,6+oldHP[i]-f.hp));
        }
      });
    }
    oldHP=s.fighters.map(f=>f.hp);
  }
  function selectMarkup(slot,s){
    const pick=characters[s.picks[slot]], connected=s.connected[slot];
    const status=(slot===1&&s.mode===1)?'MÁY ĐÃ SẴN SÀNG':!connected?'CHỜ KẾT NỐI':s.ready[slot]?'ĐÃ XÁC NHẬN':'ĐANG CHỌN';
    const active=s.ready[slot]||(slot===1&&s.mode===1);
    return `<div class="select-top"><span class="player-tag">${slot===1&&s.mode===1?'CPU · ĐẤU MÁY':`PLAYER 0${slot+1}`}</span><span class="ready-status ${active?'ready':''}">${status}</span></div>
    <div class="chosen-hero" style="--fighter-color:${pick.color}"><div class="chosen-emblem"><canvas width="180" height="200" class="hero-portrait" data-fighter-index="${s.picks[slot]}"></canvas></div><div class="chosen-details"><div class="chosen-name">${pick.name}</div><div class="chosen-title">${pick.title}</div><div class="chosen-style">${pick.style} · P${pick.power} / S${pick.speed}</div></div></div>
    <div class="roster-grid">${characters.map((c,i)=>`<div class="roster-portrait ${s.picks[slot]===i?'active':''}" style="--fighter-color:${c.color}"><canvas width="90" height="92" data-fighter-index="${i}"></canvas><b>${c.name}</b></div>`).join('')}</div>`;
  }

  // Deterministic pre-rendered background for weak TV GPUs.
  function randomGen(seed){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
  function paintBackground(){
    const r=randomGen(2026);
    const sky=bgc.createLinearGradient(0,0,0,610);sky.addColorStop(0,'#090f29');sky.addColorStop(.46,'#36254d');sky.addColorStop(1,'#aa5263');bgc.fillStyle=sky;bgc.fillRect(0,0,W,H);
    bgc.fillStyle='#ffb48a';bgc.beginPath();bgc.arc(906,157,82,0,Math.PI*2);bgc.fill();
    bgc.fillStyle='#a6506a';for(let i=0;i<13;i++)bgc.fillRect(824,125+i*8,165,3);
    // layered skyline
    for(const [layer,color,bottom] of [[0,'#322d4e',450],[1,'#1b2340',527],[2,'#131b31',574]]){
      let x=-20;
      while(x<W){const width=40+r()*85,height=65+r()*((layer+1)*70);bgc.fillStyle=color;bgc.fillRect(x,bottom-height,width,height);
        if(layer>0){for(let wy=bottom-height+13;wy<bottom-10;wy+=15){for(let wx=x+7;wx<x+width-4;wx+=13){if(r()>.56){bgc.fillStyle=layer===1?'#ab6d89':'#466f8c';bgc.fillRect(wx,wy,4,7);}}}}
        x+=width+r()*14;
      }
    }
    // pagoda silhouette and red neon sign
    bgc.fillStyle='#121424';
    bgc.fillRect(90,350,190,188);bgc.fillRect(115,295,142,62);
    for(let i=0;i<3;i++){const y=337+i*67;bgc.beginPath();bgc.moveTo(65,y);bgc.lineTo(300,y);bgc.lineTo(267,y-22);bgc.lineTo(105,y-22);bgc.closePath();bgc.fill();}
    bgc.fillStyle='#ff6b73';bgc.fillRect(335,342,12,169);bgc.fillRect(348,342,92,7);bgc.fillRect(348,503,92,7);
    bgc.font='900 34px system-ui';bgc.fillText('RF',365,425);
    // ring floor and rails
    const floor=bgc.createLinearGradient(0,545,0,720);floor.addColorStop(0,'#45516b');floor.addColorStop(.28,'#242a42');floor.addColorStop(1,'#0b1020');bgc.fillStyle=floor;bgc.fillRect(0,545,W,175);
    bgc.fillStyle='#b9686a';bgc.fillRect(0,545,W,6);bgc.fillStyle='#0b1222';bgc.fillRect(0,565,W,10);
    bgc.strokeStyle='#53617e';bgc.lineWidth=2;
    for(let x=-200;x<1500;x+=100){bgc.beginPath();bgc.moveTo(640+(x-640)*.54,550);bgc.lineTo(x,720);bgc.stroke();}
    for(let y=580;y<740;y+=28+(y-560)*.16){bgc.beginPath();bgc.moveTo(0,y);bgc.lineTo(W,y);bgc.stroke();}
    bgc.fillStyle='#ff6473';bgc.fillRect(0,548,135,3);bgc.fillRect(W-135,548,135,3);
  }
  paintBackground();
  function line(x1,y1,x2,y2,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}
  function roundedRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.fill();}
  function burst(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2;const speed=3+Math.random()*12;sparks.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:24+Math.random()*16,color});}if(sparks.length>130)sparks=sparks.slice(-130);}
  function effects(){for(const p of sparks){p.x+=p.vx;p.y+=p.vy;p.vy+=.36;p.life--;ctx.globalAlpha=Math.min(1,p.life/22);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,Math.max(2,p.life*.3),Math.max(2,p.life*.3));}ctx.globalAlpha=1;sparks=sparks.filter(x=>x.life>0);}
  function drawFighter(f, characterIndex, time, player){
    window.RF.drawFighterArt(ctx,f,characterIndex,time,player);
  }
  function hud(s){
    const left=s.reversed?1:0, right=1-left;
    for(const [idx,x,side] of [[left,36,'left'],[right,1244,'right']]){
      const f=s.fighters[idx], c=characters[s.picks[idx]], w=430;
      ctx.textAlign=side;ctx.font='900 30px system-ui';ctx.fillStyle='#fff';ctx.fillText(`${idx===0?'P1':s.mode===1?'CPU':'P2'} · ${c.name}`,x,52);
      const xbar=side==='left'?x:x-w;
      roundedRect(xbar,64,w,29,4,'#0b1320');
      roundedRect(xbar+4,68,Math.max(0,(w-8)*f.hp/100),21,3,idx===0?'#fa6658':'#5ac8ed');
      ctx.fillStyle='#fff';ctx.font='900 18px system-ui';ctx.textAlign=side;ctx.fillText(`${f.hp}%`,x,87);
      roundedRect(xbar,103,w*.62,9,2,'#12192a');roundedRect(xbar,103,w*.62*f.meter/100,9,2,'#ffcf76');
      for(let i=0;i<3;i++){
        const dotX=side==='left'?x+17+i*31:x-17-i*31;
        ctx.fillStyle=i<s.scores[idx]?'#ffd178':'#3a4358';
        ctx.beginPath();ctx.arc(dotX,141,10,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.fillStyle='#0c1423e8';ctx.fillRect(565,19,150,105);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='950 59px system-ui';ctx.fillText(s.seconds.toString(),640,82);
    ctx.font='800 19px system-ui';ctx.fillStyle='#ffbf99';ctx.fillText(`HIỆP ${s.round} / 3`,640,111);
    ctx.fillStyle='#ffd6b7';ctx.textAlign='center';ctx.font='800 13px system-ui';
    ctx.fillText(s.reversed?'ĐÃ ĐỔI BÊN':'',640,136);
  }
  function render(time){
    requestAnimationFrame(render);
    if(time-renderedAt<33) return;renderedAt=time;
    ctx.drawImage(bg,0,0);
    // Sparse neon ground lights to add motion without repaints.
    ctx.strokeStyle='#ff8f8a77';ctx.lineWidth=3;for(let i=0;i<8;i++){
      const xx=(i*185+(time*.015)%185)%1360;ctx.beginPath();ctx.moveTo(xx,568);ctx.lineTo(xx+80,568);ctx.stroke();
    }
    if(state){
      const f=state.fighters;
      const order=[0,1].sort((a,b)=>f[a].x-f[b].x);
      order.forEach(i=>drawFighter(f[i],state.picks[i],time,i));
      if(state.phase!=='lobby')hud(state);
    }else{
      const demoA={x:400,y:0,moving:false,jumping:false,attack:'',facing:1,stun:0,guarding:false};
      const demoB={...demoA,x:880,facing:-1};
      drawFighter(demoA,0,time,0);drawFighter(demoB,1,time,1);
    }
    effects();
  }
  requestAnimationFrame(render);
})();
