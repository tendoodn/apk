"""Browser-only smoke test of TV/mobile interaction using a mocked transport.
Requires: pip install playwright && playwright install chromium
This is NOT a replacement for integration testing the Rust WebSocket server.
"""
from __future__ import annotations
from pathlib import Path
import base64
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
def inline_html(name):
    html=(ROOT/'public'/name).read_text()
    html=html.replace('<link rel="stylesheet" href="/styles.css">',
                      '<style>'+(ROOT/'public'/'styles.css').read_text()+'</style>')
    for script in ['shared.js','character-art.js','tv.js','remote.js']:
        prefix = ''
        if script == 'character-art.js':
            # Offline visual QA: embed the shipped artwork, never depend on localhost networking.
            images = {f.stem: 'data:image/webp;base64,'+base64.b64encode(f.read_bytes()).decode()
                      for f in (ROOT/'public'/'assets'/'characters').glob('*.webp')}
            prefix = '<script>window.RF.spriteData='+json.dumps(images,separators=(',',':'))+';</script>'
        html=html.replace(f'<script src="/{script}"></script>',
                          prefix+'<script>'+(ROOT/'public'/script).read_text()+'</script>')
    return html

def snapshot(phase='lobby', connected=(False,False), mode=2):
    return {'type':'state','id':'demo','mode':mode,'phase':phase,
            'codes':[{'slot':1,'code':'123456','connected':connected[0]},
                     {'slot':2,'code':'654321','connected':connected[1]}],
            'connected':list(connected),'picks':[0,5],'ready':[True,True],
            'rematch':[False,False], 'round':1,'scores':[0,0], 'reversed':False,
            'phase_ticks':90,'seconds':75,
            'fighters':[{'x':340,'y':0,'hp':100,'meter':50,'stun':0,'facing':1,'guarding':False,'attack':'','attack_frames':0,'moving':False,'jumping':False},
                        {'x':940,'y':0,'hp':100,'meter':0,'stun':0,'facing':-1,'guarding':False,'attack':'','attack_frames':0,'moving':False,'jumping':False}],
            'message':''}

MOCK_JS='''
class FakeSocket {
    constructor(url){this.url=url;this.readyState=0;window.__fake_socket=this;
      setTimeout(()=>{this.readyState=1;this.onopen?.();
        if(url.includes('role=remote'))this.push({type:'welcome',slot:1,mode:2,room:'demo'});
      },20);
    }
    send(v){(window.__sent_messages??=[]).push(JSON.parse(v));}
    push(msg){this.onmessage?.({data:JSON.stringify(msg)});}
    close(){this.readyState=3;this.onclose?.();}
}
FakeSocket.OPEN=1;window.WebSocket=FakeSocket;
'''

if __name__=='__main__':
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1600,'height':900},device_scale_factor=1)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.add_init_script(MOCK_JS)
        page.goto('about:blank')  # install fake WebSocket before inline scripts execute
        page.set_content(inline_html('index.html'))
        page.screenshot(path='/mnt/data/rust-fighter-tv-2026/preview-setup.png')
        page.locator('#modeDuo').click()
        page.locator('#createRoom').click()
        page.wait_for_selector('#gameShell:not(.hidden)')
        page.evaluate('(s)=>window.__fake_socket.push(s)',snapshot(connected=(False,False)))
        assert page.locator('.pair-code').all_text_contents()==['123456','654321']
        page.evaluate('(s)=>window.__fake_socket.push(s)',snapshot(connected=(True,False)))
        assert page.locator('.pair-code').all_text_contents()==['ĐÃ KẾT NỐI','654321']
        page.screenshot(path='/mnt/data/rust-fighter-tv-2026/preview-selection.png')
        page.evaluate('(s)=>window.__fake_socket.push(s)',snapshot(phase='fight',connected=(True,True)))
        assert page.locator('#selectOverlay').evaluate('(e)=>e.classList.contains("hidden")')
        page.screenshot(path='/mnt/data/rust-fighter-tv-2026/preview-fight.png')

        mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile.on('pageerror',lambda e:errors.append(str(e)))
        mobile.add_init_script(MOCK_JS)
        mobile.goto('about:blank')
        mobile.set_content(inline_html('remote.html'))
        mobile.locator('#roomCode').fill('123456')
        mobile.locator('#connectButton').click()
        mobile.wait_for_selector('#selectionView:not(.hidden)')
        assert mobile.locator('.remote-character').count()==10
        mobile.locator('[data-character="5"]').click()
        mobile.locator('#readyButton').click()
        sent=mobile.evaluate('window.__sent_messages')
        assert any(m.get('type')=='select' and m.get('character')==5 for m in sent)
        assert any(m.get('type')=='ready' for m in sent)
        mobile.evaluate('(s)=>window.__fake_socket.push(s)',snapshot(phase='fight',connected=(True,True)))
        mobile.screenshot(path='/mnt/data/rust-fighter-tv-2026/preview-remote.png')
        button=mobile.locator('[data-input="light"]')
        button.dispatch_event('pointerdown',{'pointerId':5,'pointerType':'touch'})
        assert any(m.get('type')=='input' and m.get('light') for m in mobile.evaluate('window.__sent_messages'))
        browser.close()
    if errors:
        raise AssertionError('Browser JavaScript errors: '+repr(errors))
    print('PASS: TV pairing, auto-hidden code, selection, arena, mobile select/ready, touch input.')
