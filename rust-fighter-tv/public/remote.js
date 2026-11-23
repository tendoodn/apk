'use strict';
(() => {
  const {characters,wsUrl}=window.RF;
  const $=id=>document.getElementById(id);
  const connectView=$('connectView'),modeView=$('modeView'),selectionView=$('selectionView'),controlView=$('controlView');
  let ws=null,slot=null,pick=0,locked=false,lastState=null;
  const input={left:false,right:false,up:false,light:false,heavy:false,special:false,guard:false};
  const held=new Map();
  function send(msg){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(msg));}
  function resetInputs(){held.clear();document.querySelectorAll('[data-input]').forEach(el=>el.classList.remove('pressed'));Object.keys(input).forEach(k=>input[k]=false);send({type:'input',...input});}
  function show(view){for(const el of [connectView,modeView,selectionView,controlView])el.classList.toggle('hidden',el!==view);}
  function setError(message){$('connectError').textContent=message;}
  const codeField=$('roomCode');
  codeField.addEventListener('input',()=>{codeField.value=codeField.value.replace(/\D/g,'').slice(0,6);});
  const queryCode=new URLSearchParams(location.search).get('code');if(queryCode&&/^\d{6}$/.test(queryCode))codeField.value=queryCode;
  if(new URLSearchParams(location.search).get('auto')==='1' && /^\d{6}$/.test(codeField.value)) {
    setTimeout(()=>$('connectForm').requestSubmit(),250);
  }
  $('connectForm').addEventListener('submit',event=>{
    event.preventDefault();setError('');
    const code=codeField.value.trim();
    if(!/^\d{6}$/.test(code)){setError('Vui lòng nhập đủ 6 chữ số.');return;}
    if(ws)ws.close();
    $('connectButton').disabled=true;$('connectButton').textContent='ĐANG KẾT NỐI…';
    ws=new WebSocket(wsUrl(`/ws?role=remote&code=${code}`));
    ws.onmessage=event=>{
      let data;try{data=JSON.parse(event.data);}catch{return;}
      if(data.type==='error'){setError(data.message);ws.close();return;}
      if(data.type==='welcome'){
        slot=data.slot-1;pick=0;locked=false;
        $('selectionSlot').textContent=`PLAYER ${data.slot} · ĐÃ KẾT NỐI`;
        $('gameSlot').textContent=`PLAYER ${data.slot}`;
        renderRoster();show(data.mode===0&&slot===0?modeView:selectionView);
      }
      if(data.type==='state'){lastState=data;update(data);}
    };
    ws.onerror=()=>setError('Lỗi mạng: không kết nối được máy chủ.');
    ws.onclose=()=>{
      resetInputs();ws=null;slot=null;locked=false;show(connectView);
      $('connectButton').disabled=false;$('connectButton').textContent='KẾT NỐI VỚI TV →';
      if(!$('connectError').textContent)setError('Đã ngắt kết nối. Nhập mã trên TV để thử lại.');
    };
  });
  function renderRoster(){
    $('mobileRoster').innerHTML=characters.map((c,i)=>`<button type="button" class="remote-character ${i===pick?'active':''}" data-character="${i}" style="--fighter-color:${c.color}"><canvas width="62" height="68" class="remote-face" data-fighter-index="${i}"></canvas><span><b>${c.name}</b><small>${c.title}</small></span></button>`).join('');
    window.RF.paintPortraits($('mobileRoster'));
    document.querySelectorAll('[data-character]').forEach(el=>el.addEventListener('click',()=>{
      if(locked)return;
      pick=Number(el.dataset.character);send({type:'select',character:pick});renderRoster();
    }));
  }
  $('modeSoloMobile').addEventListener('click',()=>send({type:'mode',mode:1}));
  $('modeDuoMobile').addEventListener('click',()=>send({type:'mode',mode:2}));
  $('changeModeMobile').addEventListener('click',()=>send({type:'mode',mode:0}));
  $('readyButton').addEventListener('click',()=>{
    if(locked)return;locked=true;send({type:'select',character:pick});send({type:'ready'});
    $('readyButton').classList.add('hidden');$('lockedMessage').classList.remove('hidden');
  });
  function update(s){
    if(slot===null)return;
    const own=s.fighters[slot],other=s.fighters[1-slot];
    pick=s.picks[slot];locked=s.ready[slot];
    if(s.phase==='lobby'){
      if(s.mode===0){if(slot===0)show(modeView);return;}
      if(modeView.classList.contains('hidden')===false || !controlView.classList.contains('hidden')){
        resetInputs();show(selectionView);
      }
      $('changeModeMobile').classList.toggle('hidden',slot!==0||s.ready[0]||s.connected[1]);
      const ready=s.ready[slot];$('readyButton').classList.toggle('hidden',ready);
      $('lockedMessage').classList.toggle('hidden',!ready);
      $('lockedMessage').textContent=ready?(s.mode===1?'ĐÃ XÁC NHẬN · SẮP CHIẾN ĐẤU':'ĐÃ XÁC NHẬN · CHỜ ĐỐI THỦ'):'CHỌN NHÂN VẬT';
      if(!ready && !selectionView.classList.contains('hidden')){
        if(document.querySelector('.remote-character.active')?.dataset.character!==String(pick))renderRoster();
      }
      return;
    }
    if(controlView.classList.contains('hidden'))show(controlView);
    $('characterName').textContent=characters[s.picks[slot]].name;
    $('roundLabel').textContent=`HIỆP ${s.round} / 3`;
    $('ownHp').textContent=`${own.hp}%`;
    $('rivalHp').textContent=`${other.hp}%`;
    $('ownBar').style.width=`${own.hp}%`;
    $('rivalBar').style.width=`${other.hp}%`;
    const status={countdown:`BẮT ĐẦU SAU ${Math.max(1,Math.ceil(s.phase_ticks/30))}…`,fight:'ĐANG GIAO CHIẾN',round_end:`${s.message} · TỈ SỐ ${s.scores.join(' : ')}`,paused:'CHỜ ĐỐI THỦ KẾT NỐI LẠI',match_end:s.message};
    $('mobileStatus').textContent=status[s.phase]||'';
    $('controlPad').classList.toggle('hidden',s.phase==='match_end');
    $('rematchButton').classList.toggle('hidden',s.phase!=='match_end');
    if(s.phase==='match_end'){
      resetInputs();
      $('rematchButton').disabled=s.rematch[slot];
      $('rematchButton').textContent=s.rematch[slot]?'ĐANG CHỜ ĐỐI THỦ…':'ĐẤU LẠI · CHỌN NHÂN VẬT';
    }
  }
  $('rematchButton').addEventListener('click',()=>{
    send({type:'rematch'});$('rematchButton').disabled=true;$('rematchButton').textContent='ĐANG CHỜ ĐỐI THỦ…';
  });
  // Pointer-ID registry: allows true multi-touch and two guard buttons simultaneously.
  function syncHeld(){
    for(const key of Object.keys(input))input[key]=[...held.values()].includes(key);
    for(const el of document.querySelectorAll('[data-input]'))el.classList.toggle('pressed',input[el.dataset.input]);
    send({type:'input',...input});
  }
  document.querySelectorAll('[data-input]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{
      e.preventDefault();if(lastState?.phase!=='fight')return;
      // Synthetic or canceled pointer IDs can throw NotFoundError on some TV/mobile browsers.
      try { button.setPointerCapture?.(e.pointerId); } catch (_) {}
      held.set(e.pointerId,button.dataset.input);
      syncHeld();
    });
    const release=e=>{if(held.has(e.pointerId)){held.delete(e.pointerId);syncHeld();}};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
    button.addEventListener('lostpointercapture',release);
    button.addEventListener('contextmenu',e=>e.preventDefault());
  });
  // Periodic keepalive: server keeps correct inputs while a finger is continuously held.
  setInterval(()=>{if(ws?.readyState===WebSocket.OPEN && slot!==null && lastState?.phase==='fight')send({type:'input',...input});},100);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetInputs();});
  window.addEventListener('blur',resetInputs);
})();
