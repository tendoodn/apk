"""Offline mocked-WebSocket smoke tests for TV auto-lobby, P1 mode, 2 codes, phone controls.
This tests web UI only, not JNI, Rust compilation or device discovery.
"""
import json, base64
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
def document(name):
    html=(ROOT/'public'/name).read_text()
    html=html.replace('<link rel="stylesheet" href="/styles.css">','<style>'+(ROOT/'public/styles.css').read_text()+'</style>')
    for js in ('shared.js','character-art.js','tv.js','remote.js'):
        payload=(ROOT/'public'/js).read_text()
        if js=='character-art.js':
            data={f.stem:'data:image/webp;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (ROOT/'public/assets/characters').glob('*.webp')}
            payload='window.RF.spriteData='+json.dumps(data,separators=(',',':'))+';\n'+payload
        html=html.replace('<script src="/'+js+'"></script>', '<script>'+payload+'</script>')
    return html

MOCK='''
class FakeSocket {
 constructor(url){this.url=url;this.readyState=0;window.__socket=this;window.__sent=[];
  setTimeout(()=>{this.readyState=1;this.onopen?.();
    if(url.includes('role=remote'))this.push({type:'welcome',slot:1,mode:0,room:'room-1'});
  },30);}
 send(msg){window.__sent.push(JSON.parse(msg));}
 push(msg){this.onmessage?.({data:JSON.stringify(msg)});}
 close(){this.readyState=3;this.onclose?.();}
}
FakeSocket.OPEN=1;FakeSocket.CLOSED=3;window.WebSocket=FakeSocket;
'''

def snapshot(mode=0,phase='lobby',conn=(False,False),ready=(False,False)):
    return {'type':'state','id':'room-1','mode':mode,'phase':phase,
            'codes':[{'slot':1,'code':'123456','connected':conn[0]},{'slot':2,'code':'654321','connected':conn[1]}],
            'connected':list(conn),'picks':[0,6],'ready':list(ready),'rematch':[False,False],
            'round':1,'scores':[0,0],'reversed':False,'phase_ticks':90,'seconds':75,
            'fighters':[{'x':x,'y':0,'hp':100,'meter':75,'stun':0,'facing':face,'guarding':False,'attack':'','attack_frames':0,'moving':False,'jumping':False} for x,face in [(340,1),(940,-1)]],
            'message':''}

def main():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,args=['--no-sandbox'])
        tv=browser.new_page(viewport={'width':1600,'height':900})
        tv.on('pageerror',lambda e:errors.append('TV '+str(e)))
        tv.add_init_script(MOCK)
        tv.goto('about:blank');tv.set_content(document('index.html'))
        tv.wait_for_selector('#gameShell:not(.hidden)')
        tv.wait_for_function("window.__socket?.readyState===1")
        assert tv.evaluate('window.__socket.url').endswith('/ws?role=tv')
        tv.evaluate('(s)=>window.__socket.push(s)', snapshot(mode=0))
        assert tv.locator('.pair-code').all_text_contents()==['123456']
        tv.screenshot(path=str(ROOT/'preview-apk-tv-wait.png'))
        phone=browser.new_page(viewport={'width':400,'height':840},has_touch=True,is_mobile=True)
        phone.on('pageerror',lambda e:errors.append('REMOTE '+str(e)))
        phone.add_init_script(MOCK)
        phone.goto('about:blank');phone.set_content(document('remote.html'))
        phone.locator('#roomCode').fill('123456');phone.locator('#connectButton').click()
        phone.wait_for_selector('#modeView:not(.hidden)')
        phone.screenshot(path=str(ROOT/'preview-apk-phone-mode.png'))
        phone.locator('#modeDuoMobile').click()
        assert {'type':'mode','mode':2} in phone.evaluate('window.__sent')
        tv.evaluate('(s)=>window.__socket.push(s)', snapshot(mode=2,conn=(True,False)))
        assert tv.locator('.pair-code').all_text_contents()==['ĐÃ KẾT NỐI','654321']
        tv.screenshot(path=str(ROOT/'preview-apk-tv-choose.png'))
        phone.evaluate('(s)=>window.__socket.push(s)', snapshot(mode=2,conn=(True,False)))
        phone.wait_for_selector('#selectionView:not(.hidden)')
        assert phone.locator('.remote-character').count()==10
        phone.locator('[data-character="6"]').click()
        phone.locator('#readyButton').click()
        sent=phone.evaluate('window.__sent')
        assert any(m.get('type')=='select' and m.get('character')==6 for m in sent)
        assert any(m.get('type')=='ready' for m in sent)
        phone.evaluate('(s)=>window.__socket.push(s)', snapshot(mode=2,phase='fight',conn=(True,True),ready=(True,True)))
        phone.wait_for_selector('#controlView:not(.hidden)')
        phone.locator('[data-input="light"]').dispatch_event('pointerdown',{'pointerId':5,'pointerType':'touch'})
        assert any(m.get('type')=='input' and m.get('light') for m in phone.evaluate('window.__sent'))
        phone.screenshot(path=str(ROOT/'preview-apk-phone-controls.png'))
        tv.evaluate('(s)=>window.__socket.push(s)', snapshot(mode=2,phase='fight',conn=(True,True),ready=(True,True)))
        assert tv.locator('#selectOverlay').evaluate('(el)=>el.classList.contains("hidden")')
        browser.close()
    if errors: raise AssertionError(errors)
    print('PASS: TV auto-lobby, one initial code, P1 selects mode, second code, auto-hide, roster 10, ready, controls, combat view')
if __name__=='__main__': main()
