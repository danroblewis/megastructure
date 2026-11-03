# minimal Chrome DevTools Protocol client over a hand-rolled websocket (no deps)
import socket, json, os, base64, struct, sys, time, subprocess, urllib.request
class WS:
    def __init__(self,url):
        host,port,path=url.split('/')[2].split(':')[0],int(url.split('/')[2].split(':')[1]),'/'+'/'.join(url.split('/')[3:])
        self.s=socket.create_connection((host,port)); key=base64.b64encode(os.urandom(16)).decode()
        self.s.send(f"GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        buf=b''
        while b'\r\n\r\n' not in buf: buf+=self.s.recv(4096)
        self.id=0
    def send(self,method,params=None):
        self.id+=1; d=json.dumps({'id':self.id,'method':method,'params':params or {}}).encode()
        hdr=bytearray([0x81]); n=len(d)
        if n<126: hdr.append(0x80|n)
        elif n<65536: hdr.append(0x80|126); hdr+=struct.pack('>H',n)
        else: hdr.append(0x80|127); hdr+=struct.pack('>Q',n)
        mask=os.urandom(4); hdr+=mask; self.s.send(bytes(hdr)+bytes(b^mask[i%4] for i,b in enumerate(d))); return self.id
    def _recvn(self,n):
        b=b''
        while len(b)<n: b+=self.s.recv(n-len(b))
        return b
    def recv(self):
        h=self._recvn(2); n=h[1]&0x7f
        if n==126: n=struct.unpack('>H',self._recvn(2))[0]
        elif n==127: n=struct.unpack('>Q',self._recvn(8))[0]
        return json.loads(self._recvn(n))
    def call(self,method,params=None):
        i=self.send(method,params)
        while True:
            m=self.recv()
            if m.get('id')==i: return m.get('result',m)
def main():
    shell=sys.argv[1]; url=sys.argv[2]; port=9333
    p=subprocess.Popen([shell,'--headless','--remote-debugging-port=%d'%port,'--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=800,500','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(50):
            try: tabs=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json')); break
            except Exception: time.sleep(0.2)
        ws=WS([t for t in tabs if t['type']=='page'][0]['webSocketDebuggerUrl'])
        ws.call('Page.enable'); ws.call('Network.enable'); ws.call('Runtime.enable')
        ws.call('Page.navigate',{'url':url}); time.sleep(8)
        ev=lambda js: ws.call('Runtime.evaluate',{'expression':js,'returnByValue':True}).get('result',{}).get('value')
        print('online:',ev('document.title'))
        ws.call('Network.emulateNetworkConditions',{'offline':True,'latency':0,'downloadThroughput':-1,'uploadThroughput':-1})
        ws.call('Page.navigate',{'url':sys.argv[3]}); time.sleep(float(sys.argv[4]) if len(sys.argv)>4 else 8)
        print('offline:',ev('document.title'))
        print('offline scripts loaded:',ev('typeof SIM+","+typeof GEN+","+typeof SCHEMES'))
    finally: p.terminate()
main()
