'use strict';
/* Original hand-drawn Canvas shapes representing ten recognizable fighter silhouettes.
 * No copied textures, models or third-party sprite files are distributed here.
 * For licensed high-detail art, place PNG sprites inside public/assets/characters
 * and replace this function with a sprite-sheet renderer.
 */
(() => {
  const C = window.RF.characters;
  const spriteImages = C.map((c) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => paintPortraits(document);
    img.src = window.RF.spriteData?.[c.kind] || `/assets/characters/${c.kind}.webp`;
    return img;
  });
  const imageReady = (idx) => spriteImages[idx]?.complete && spriteImages[idx]?.naturalWidth > 0;
  const PI = Math.PI;
  function path(ctx, pts, fill, stroke='#15161f', width=3) {
    ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let j=1;j<pts.length;j++)ctx.lineTo(pts[j][0],pts[j][1]);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function limb(ctx, x1,y1,x2,y2,size,color,edge='#1d2027') {
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=edge;ctx.lineWidth=size+5;ctx.stroke();
    ctx.strokeStyle=color;ctx.lineWidth=size;ctx.stroke();
  }
  function oval(ctx,x,y,w,h,color,stroke='#161821',lw=3){
    ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,2*PI);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function head(ctx,c,bob) {
    const k=c.kind;
    ctx.save();ctx.translate(0,bob);
    const headY=k==='zangief'?-204:k==='honda'?-201:-207;
    const faceW=(k==='zangief'||k==='honda')?32:24;
    oval(ctx,0,headY,faceW,30,c.skin,'#29202a',3);
    if(k==='blanka'){
      path(ctx,[[-38,-222],[-59,-230],[-34,-238],[-48,-252],[-23,-246],[-21,-264],[-4,-249],[10,-266],[19,-246],[40,-252],[31,-236],[50,-230],[25,-225]],c.hair);
      oval(ctx,0,headY+6,27,21,c.skin,'#1d3230',1);
      rect(ctx,0,headY+1,11,3,'#21272d');rect(ctx,-18,headY+1,11,3,'#21272d');
    } else if(k==='chunli'){
      oval(ctx,-30,-228,13,13,c.hair);oval(ctx,31,-228,13,13,c.hair);
      rect(ctx,-39,-229,15,7,'#f7f0e7');rect(ctx,26,-229,14,7,'#f7f0e7');
      path(ctx,[[-26,-218],[-22,-242],[3,-244],[26,-223],[14,-232],[-8,-228]],c.hair);
      limb(ctx,-34,-227,-45,-246,5,'#faf7ef');limb(ctx,35,-227,47,-244,5,'#faf7ef');
    } else if(k==='guile'){
      path(ctx,[[-28,-220],[-31,-258],[24,-258],[27,-222]],c.hair);
      rect(ctx,-29,-261,58,6,'#f8dc8c');
    } else if(k==='cammy'){
      limb(ctx,-20,-218,-51,-178,12,c.hair);limb(ctx,23,-220,54,-176,12,c.hair);
      limb(ctx,-51,-177,-57,-154,10,c.hair);limb(ctx,54,-176,60,-155,10,c.hair);
      path(ctx,[[-32,-235],[21,-249],[38,-233],[18,-224],[-25,-222]],'#b52b35');
      rect(ctx,-32,-235,66,7,'#e5464b');
    } else if(k==='ken'){
      path(ctx,[[-29,-209],[-31,-233],[-10,-240],[2,-261],[15,-240],[29,-245],[36,-229],[21,-224],[7,-234],[-4,-218]],c.hair);
    } else if(k==='ryu'){
      path(ctx,[[-29,-216],[-22,-242],[-9,-230],[-1,-245],[15,-233],[27,-236],[30,-216],[9,-224]],c.hair);
      rect(ctx,-28,-222,57,7,'#d62d35');limb(ctx,25,-218,61,-226,5,'#dc3a44');limb(ctx,27,-213,52,-201,5,'#dc3a44');
    } else if(k==='zangief'){
      path(ctx,[[-18,-233],[-8,-259],[3,-247],[14,-260],[20,-234]],c.hair);
      path(ctx,[[-24,-197],[-18,-179],[16,-180],[24,-196],[4,-187]],'#6e3829');
      rect(ctx,-17,-205,11,4,'#2f1c1c');rect(ctx,8,-205,12,4,'#2f1c1c');
    } else if(k==='dhalsim'){
      oval(ctx,0,-231,8,3,'#d93037',null);
      rect(ctx,-3,-236,6,12,'#efeee3');
      oval(ctx,-31,-202,6,11,'#d5ac67',null);oval(ctx,31,-202,6,11,'#d5ac67',null);
    } else if(k==='honda'){
      oval(ctx,0,-247,14,17,c.hair);rect(ctx,-20,-244,40,15,c.hair);
      // stylized white kabuki-inspired face markings
      rect(ctx,-19,-213,12,3,'#f9ede1');rect(ctx,8,-213,12,3,'#f9ede1');
      rect(ctx,-8,-197,17,4,'#f9ede1');
    } else if(k==='bison'){
      path(ctx,[[-34,-236],[33,-236],[31,-211],[-28,-210]],'#b52e39');
      rect(ctx,-38,-240,76,9,'#de454a');rect(ctx,-6,-237,16,7,'#e8c78b');
      rect(ctx,-34,-212,69,5,'#a72835');
    }
    if(k!=='blanka'&&k!=='zangief'){
      ctx.strokeStyle='#24212a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,headY+4);ctx.lineTo(-5,headY+3);ctx.moveTo(8,headY+3);ctx.lineTo(18,headY+4);ctx.stroke();
    }
    ctx.restore();
  }
  function energy(ctx,kind,c,reach,t) {
    const e=c.energy;ctx.save();ctx.globalAlpha=.86;
    if(['ryu','ken','dhalsim','bison','guile'].includes(kind)){
      const x=reach+52,y=-135;
      if(kind==='ken'||kind==='dhalsim'){
        path(ctx,[[x-18,y+23],[x-8,y-28],[x+2,y-14],[x+22,y-48],[x+27,y+6],[x+44,y-6],[x+29,y+26]],e,null);
        path(ctx,[[x-4,y+15],[x+4,y-20],[x+13,y-6],[x+21,y+15]],'#ffeeb9',null);
      }else{
        for(let j=3;j>=0;j--){ctx.globalAlpha=.25+j*.14;oval(ctx,x+j*9,y,34+j*11,29+j*3,j%2?e:'#d5f6ff',null);}
        ctx.globalAlpha=.8;ctx.strokeStyle=e;ctx.lineWidth=4;for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(x,y,31+j*10,t*.002+j,t*.002+j+1.8);ctx.stroke();}
      }
    }else if(kind==='blanka'){
      ctx.strokeStyle=e;ctx.lineWidth=5;
      for(let j=0;j<8;j++){const a=t*.003+j*PI/4;const r1=65,r2=99;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,-130+Math.sin(a)*r1);ctx.lineTo(Math.cos(a+.15)*r2,-130+Math.sin(a+.15)*r2);ctx.lineTo(Math.cos(a+.3)*r2*1.25,-130+Math.sin(a+.3)*r2*1.25);ctx.stroke();}
    }else{
      ctx.lineWidth=7;ctx.strokeStyle=e;for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(0,-117,65+j*10,62+j*13,t*.004+j,0,2*PI);ctx.stroke();}
    }
    ctx.restore();
  }
  function render(ctx,f,idx,time=0,player=0){
    const c=C[idx]||C[0],k=c.kind;
    if(imageReady(idx)) {
      const img=spriteImages[idx];
      const w=({honda:400,zangief:395,blanka:375,guile:365,dhalsim:325,cammy:340,chunli:345})[k]||355;
      const h=355;
      const motion= f.moving&&!f.jumping ? Math.sin(time*.013)*2 : 0;
      const kick= f.attack==='heavy' ? -0.048 : 0;
      const power= f.attack==='special';
      ctx.save();ctx.translate(f.x||0,550-(f.y||0));
      ctx.scale(f.facing||1,1);ctx.rotate(kick);
      const lunge=f.attack ? 12 : 0;
      ctx.drawImage(img,-w/2+lunge,-h+motion,w,h);
      if(f.stun>0){ctx.fillStyle='#fff4';ctx.fillRect(-w/2,-h,w,h);}
      if(power)energy(ctx,k,c,105,time);
      if(f.guarding){ctx.strokeStyle=c.energy;ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,-159,165,-1.15,1.15);ctx.stroke();}
      ctx.restore();
      return;
    }
    const wide=({zangief:1.34,honda:1.48,blanka:1.14,guile:1.06,dhalsim:.77,cammy:.79,chunli:.84})[k]||1;
    const tall=({honda:.9,zangief:1.06,dhalsim:1.09,cammy:.96,chunli:.98})[k]||1;
    const moving=!!f.moving,air=!!f.jumping,attack=f.attack||'';
    const walking=moving&&!air?Math.sin(time*.016+(f.x||0)*.03)*11:0;
    const bob=air?0:Math.sin(time*.008+player)*2;
    const striking=!!attack;
    const strikeX=striking?(attack==='special'?108:attack==='heavy'?82:72):57;
    const strikeY=attack==='heavy'?-107:-142;
    ctx.save();ctx.translate(f.x||0,0);
    ctx.fillStyle='#04091a80';ctx.beginPath();ctx.ellipse(0,560,64*wide,12,0,0,2*PI);ctx.fill();
    ctx.translate(0,550-(f.y||0));ctx.scale((f.facing||1)*wide,tall);
    if(f.stun>0)ctx.globalAlpha=.7+Math.sin(time*.08)*.22;
    const legColor=['ryu','ken','guile','bison','chunli'].includes(k)?c.color:
      ['zangief','honda','blanka','dhalsim'].includes(k)?c.skin:c.color;
    const boots=['ryu','ken'].includes(k)?'#efe7dd':k==='bison'?'#29283c':k==='cammy'?'#4b3928':
      k==='chunli'?'#f6e5c2':k==='guile'?'#312e2b':k==='blanka'?c.skin:k==='dhalsim'?'#c9a97e':'#604339';
    const legGap=k==='honda'?30:17;
    limb(ctx,-legGap,-88,-23-walking,-30,({honda:35,zangief:31})[k]||24,legColor);
    limb(ctx,legGap,-88,24+walking,-30,({honda:35,zangief:31})[k]||24,legColor);
    limb(ctx,-23-walking,-31,-33-walking,-15,20,boots);
    limb(ctx,24+walking,-30,37+walking,-15,20,boots);
    if(k==='chunli'){rect(ctx,-45,-44,19,8,'#ebd8bf');rect(ctx,24,-44,18,8,'#ebd8bf');}
    // Stance and torso
    const torsoColor=['blanka','zangief','dhalsim','honda'].includes(k)?c.skin:c.color;
    const shoulders=({honda:66,zangief:62,guile:43,blanka:46,dhalsim:27})[k]||38;
    path(ctx,[[-shoulders,-163],[shoulders,-163],[shoulders*.87,-97],[22,-79],[-24,-79],[-shoulders*.9,-98]],torsoColor);
    if(['ryu','ken'].includes(k)){
      path(ctx,[[-shoulders,-159],[-7,-154],[5,-137],[19,-154],[shoulders,-157],[26,-99],[0,-90],[-35,-102]],c.color);
      path(ctx,[[-12,-161],[0,-144],[7,-159],[15,-117],[0,-108],[-19,-126]],c.skin,null);
      path(ctx,[[-shoulders,-161],[-12,-147],[-28,-101],[-37,-104]],'#b5b0a4',null);
      limb(ctx,-31,-104,35,-102,9,'#20202a');rect(ctx,30,-108,18,11,'#22202b');
    }else if(k==='chunli'){
      path(ctx,[[-40,-152],[-24,-170],[0,-164],[24,-171],[40,-151],[36,-92],[0,-65],[-37,-92]],c.color);
      limb(ctx,-2,-158,2,-77,3,'#f2d6a0');limb(ctx,-25,-140,25,-140,3,'#e8d89d');
      path(ctx,[[-33,-96],[32,-96],[48,-51],[25,-63],[14,-87],[-15,-87],[-27,-62],[-48,-53]],'#236ec0');
    }else if(k==='cammy'){
      path(ctx,[[-27,-156],[27,-156],[23,-92],[-23,-92]],'#3c8355');
      limb(ctx,-20,-154,-13,-107,6,'#234635');limb(ctx,20,-154,13,-107,6,'#234635');
      path(ctx,[[-25,-96],[25,-96],[30,-72],[-30,-72]],'#3e9160');
    }else if(k==='guile'){
      path(ctx,[[-37,-161],[-22,-169],[19,-169],[38,-160],[32,-112],[-34,-112]],'#5f7747');
      limb(ctx,-34,-102,34,-102,10,'#3a4934');
      for(let j=0;j<3;j++)rect(ctx,-26+j*18,-136+(j%2)*11,14,5,'#364d2c');
    }else if(k==='bison'){
      path(ctx,[[-42,-154],[42,-154],[43,-105],[24,-85],[-28,-85],[-42,-104]],'#bb343e');
      path(ctx,[[-62,-168],[-23,-168],[-18,-154],[-56,-145]],'#c6c8d0');
      path(ctx,[[23,-168],[60,-167],[56,-145],[18,-154]],'#c6c8d0');
      limb(ctx,-40,-110,40,-110,10,'#2b2b3d');rect(ctx,-8,-115,19,12,'#f2d992');
      for(let j=0;j<3;j++)rect(ctx,-21+j*16,-138,7,6,'#e6d9a1');
    }else if(k==='zangief'){
      path(ctx,[[-18,-146],[0,-119],[18,-146],[27,-122],[0,-112],[-27,-122]],'#9a4f38',null);
      path(ctx,[[-37,-96],[39,-96],[38,-62],[18,-61],[12,-80],[-12,-80],[-17,-61],[-40,-63]],'#b92d37');
      path(ctx,[[-30,-162],[-22,-141],[-9,-137],[12,-138],[24,-144],[35,-164]],'#ddaa86',null);
      for(let j=0;j<4;j++)rect(ctx,-21+j*13,-135,5,4,'#8d4a37');
    }else if(k==='honda'){
      path(ctx,[[-33,-95],[36,-95],[39,-60],[18,-57],[9,-78],[-10,-79],[-22,-58],[-43,-59]],'#375eae');
      path(ctx,[[-36,-150],[37,-150],[22,-120],[-20,-121]],'#edc19b',null);
      rect(ctx,-8,-99,16,20,'#f4ebdc');
    }else if(k==='dhalsim'){
      path(ctx,[[-25,-96],[26,-96],[25,-67],[-24,-67]],'#e49c3c');
      for(let j=0;j<6;j++)oval(ctx,-20+j*8,-150+(j%2)*5,5,6,'#e7d9bd',null);
      oval(ctx,-12,-119,6,7,'#d7c9ac',null);oval(ctx,5,-119,6,7,'#d7c9ac',null);
    }else if(k==='blanka'){
      path(ctx,[[-32,-92],[34,-92],[29,-69],[-32,-69]],'#d48938');
      for(let j=0;j<5;j++)path(ctx,[[-42+j*19,-158],[-28+j*19,-170],[-22+j*19,-158]],'#34713c',null);
    }
    // Near arm, includes attack poses and gloves.
    const armColor=['bison','guile','ken','ryu','chunli'].includes(k)?c.color:c.skin;
    const armSize=({zangief:33,honda:34,blanka:30,dhalsim:15,cammy:19,chunli:18})[k]||25;
    limb(ctx,-shoulders+4,-149,-shoulders-17,-116,armSize,armColor);
    limb(ctx,-shoulders-17,-116,-55,-93,armSize-4,armColor);
    oval(ctx,-58,-96,13,14,['ryu','ken','cammy','chunli','bison'].includes(k)?c.accent:c.skin);
    // Front arm moves in/out as the player strikes.
    limb(ctx,shoulders-3,-151,shoulders+15,-127,armSize,armColor);
    limb(ctx,shoulders+15,-127,strikeX,strikeY,armSize-3,['bison','guile'].includes(k)?c.color:c.skin);
    oval(ctx,strikeX+5,strikeY,14,14,['ryu','ken','cammy','chunli','bison'].includes(k)?c.accent:c.skin);
    if(k==='zangief'){limb(ctx,-35,-140,-46,-109,8,'#af252a');limb(ctx,39,-139,43,-121,8,'#af252a');}
    if(k==='guile')rect(ctx,38,-126,28,7,'#303e27');
    head(ctx,c,bob);
    if(striking){
      ctx.strokeStyle=c.energy;ctx.globalAlpha=.75;ctx.lineWidth=5;ctx.beginPath();ctx.arc(strikeX+9,strikeY,27,-1.7,1.2);ctx.stroke();ctx.globalAlpha=1;
      if(attack==='special')energy(ctx,k,c,strikeX,time);
    }
    if(f.guarding){ctx.strokeStyle=c.energy;ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,-130,104,-1.28,1.24);ctx.stroke();}
    ctx.restore();
  }
  function paintPortraits(root=document){
    for(const canvas of root.querySelectorAll('canvas[data-fighter-index]')){
      const idx=Number(canvas.dataset.fighterIndex);const ctx=canvas.getContext('2d');if(!ctx)continue;
      const w=canvas.width,h=canvas.height,c=C[idx];ctx.clearRect(0,0,w,h);
      if(imageReady(idx)){
        const gradient=ctx.createRadialGradient(w*.5,h*.25,5,w*.5,h*.5,w*.72);
        gradient.addColorStop(0,window.RF.hexAlpha(c.color,.43));gradient.addColorStop(1,'#111522');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
        const size=Math.max(w*1.16,h*1.12);
        ctx.drawImage(spriteImages[idx],(w-size)/2,h*1.06-size,size,size);
        continue;
      }
      const grad=ctx.createRadialGradient(w*.47,h*.33,0,w*.45,h*.4,w*.8);
      grad.addColorStop(0,window.RF.hexAlpha(c.color,.45));grad.addColorStop(1,'#111522');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
      // Bust view: intentionally crops the legs to enlarge character identity.
      ctx.save();const zoom=w>140?1.0:(w>75?.49:.35);ctx.translate(w*.5,h*1.25);
      ctx.scale(zoom,zoom);ctx.translate(0,-550);render(ctx,{x:0,y:0,facing:1,attack:'',moving:false,jumping:false},idx,0,idx);ctx.restore();
    }
  }
  window.RF.drawFighterArt=render;
  window.RF.paintPortraits=paintPortraits;
})();
