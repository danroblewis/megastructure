#!/bin/sh
# run JavaScript in the phone's page through the dev server: tools/rjs.sh 'expression'  (needs DEV_TOKEN and the log path)
# prints the page's result (type eval) when it arrives, waiting up to 20 s.
JS="$1"; PORT="${PORT:-8080}"; LOG="${LOG:-devserver.log}"
START=$(wc -l < "$LOG" 2>/dev/null || echo 0)
ID=$(python3 -c "import json,sys,urllib.request; req=urllib.request.Request('http://localhost:$PORT/v2/cmd',data=json.dumps({'js':sys.argv[1]}).encode(),headers={'X-Token':'$DEV_TOKEN','Content-Type':'application/json'}); print(json.load(urllib.request.urlopen(req))['id'])" "$JS") || exit 1
for i in $(seq 1 40); do
  R=$(python3 -c "
import json,sys
for i,l in enumerate(open(sys.argv[1])):
    if i<int(sys.argv[2]): continue
    try: r=json.loads(l)
    except Exception: continue
    if r.get('type')=='eval' and (r.get('extra') or {}).get('id')==$ID: print(r.get('recv'),r.get('sid'),'=>',r.get('msg')); print(r.get('stack') or '',end='')
" "$LOG" "$START"); [ -n "$R" ] && { echo "$R"; exit 0; }; sleep 0.5; done; echo "(no reply from the page within 20 s; cmd id $ID queued)"
