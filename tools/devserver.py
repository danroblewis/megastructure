#!/usr/bin/env python3
"""Dev server: serves the repo and records what the game reports to POST /log (see v2/report.js).
usage: python3 tools/devserver.py [port] [logfile]"""
import sys, json, time, http.server, socketserver, os
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 8080
LOG=sys.argv[2] if len(sys.argv)>2 else 'devserver.log'
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=ROOT,**k)
    def end_headers(self):
        self.send_header('Cache-Control','no-store'); super().end_headers()
    def do_POST(self):
        if not self.path.endswith('/log'): self.send_response(404); self.end_headers(); return
        n=int(self.headers.get('Content-Length',0)); body=self.rfile.read(n)
        try: items=json.loads(body)
        except Exception: items=[{'type':'bad','msg':body[:500].decode('utf8','replace')}]
        with open(LOG,'a') as f:
            for it in items:
                it['recv']=time.strftime('%H:%M:%S'); f.write(json.dumps(it)+'\n')
                print(f"[{it['recv']}] {it.get('sid','')} {it.get('type')}: {str(it.get('msg',''))[:200]}", flush=True)
        self.send_response(204); self.end_headers()
    def log_message(self,fmt,*a):
        if self.command=='POST': return
        sys.stderr.write("%s %s\n"%(self.command,self.path)); sys.stderr.flush()
socketserver.TCPServer.allow_reuse_address=True
with socketserver.ThreadingTCPServer(('',PORT),H) as s:
    print(f'devserver on http://localhost:{PORT}/v2/  log -> {LOG}', flush=True); s.serve_forever()
