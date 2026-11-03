#!/usr/bin/env python3
"""Dev server: serves the repo and records what the game reports to POST /log (see v2/report.js).
usage: python3 tools/devserver.py [port] [logfile]"""
import sys, json, time, http.server, socketserver, os
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 8080
LOG=sys.argv[2] if len(sys.argv)>2 else 'devserver.log'
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOKEN=os.environ.get('DEV_TOKEN') or ''
CMDS=[]   # [{id, js, sid}] — remote JavaScript for the page to evaluate (see v2/report.js)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def end_headers(self):
        self.send_header('Cache-Control','no-store'); super().end_headers()
    def do_GET(self):
        if '/cmd' in self.path:
            from urllib.parse import urlparse, parse_qs
            q=parse_qs(urlparse(self.path).query); after=int(q.get('after',['0'])[0]); sid=q.get('sid',[''])[0]
            out=[c for c in CMDS if c['id']>after and (not c['sid'] or c['sid']==sid)]
            body=json.dumps(out).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_POST(self):
        n=int(self.headers.get('Content-Length',0)); body=self.rfile.read(n)
        if self.path.endswith('/cmd'):
            if not TOKEN or self.headers.get('X-Token')!=TOKEN: self.send_response(403); self.end_headers(); return
            try: d=json.loads(body)
            except Exception: d={'js':body.decode('utf8','replace')}
            c={'id':(CMDS[-1]['id']+1 if CMDS else 1),'js':d.get('js',''),'sid':d.get('sid','')}; CMDS.append(c)
            out=json.dumps({'id':c['id']}).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(out))); self.end_headers(); self.wfile.write(out); return
        if not self.path.endswith('/log'): self.send_response(404); self.end_headers(); return
        try: items=json.loads(body)
        except Exception: items=[{'type':'bad','msg':body[:500].decode('utf8','replace')}]
        with open(LOG,'a') as f:
            for it in items:
                it['recv']=time.strftime('%H:%M:%S'); f.write(json.dumps(it)+'\n')
                print(f"[{it['recv']}] {it.get('sid','')} {it.get('type')}: {str(it.get('msg',''))[:200]}", flush=True)
        self.send_response(204); self.end_headers()
    def log_message(self,fmt,*a):
        if self.command=='POST' or '/cmd' in self.path: return
        sys.stderr.write("%s %s\n"%(self.command,self.path)); sys.stderr.flush()
socketserver.TCPServer.allow_reuse_address=True
with socketserver.ThreadingTCPServer(('',PORT),H) as s:
    print(f'devserver on http://localhost:{PORT}/v2/  log -> {LOG}', flush=True); s.serve_forever()
