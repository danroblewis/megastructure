#!/usr/bin/env python3
# relay.py — a tiny websocket relay for Megastructure rooms (stdlib only).
#   python3 tools/relay.py 8765
# Every player opens a socket, says hello with a room name and the level they loaded, and from then on sends a small state
# packet eight times a second. The relay gives each socket a number (pid), tells the room who arrived and who left, and
# forwards every state packet to the rest of the room. It keeps one thing per room: the level the room is on (the level of
# the most recent arrival who came by clearing a level, else the first arrival's), so a friend who opens the link lands on it.
import asyncio, base64, hashlib, json, struct, sys, time, os

GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
rooms={}   # name -> {'level':..., 'members': {pid: writer}}
nextPid=1
log=lambda *a: print(time.strftime('%H:%M:%S'),*a,flush=True)

async def recv_frame(reader):
    h=await reader.readexactly(2); fin=h[0]&0x80; op=h[0]&0x0f; masked=h[1]&0x80; n=h[1]&0x7f
    if n==126: n=struct.unpack('>H',await reader.readexactly(2))[0]
    elif n==127: n=struct.unpack('>Q',await reader.readexactly(8))[0]
    if n>1_000_000: raise ValueError('frame too large')
    mask=await reader.readexactly(4) if masked else None
    data=await reader.readexactly(n)
    if mask: data=bytes(b^mask[i%4] for i,b in enumerate(data))
    return op,data

def frame(op,data):
    n=len(data); h=bytearray([0x80|op])
    if n<126: h.append(n)
    elif n<65536: h.append(126); h+=struct.pack('>H',n)
    else: h.append(127); h+=struct.pack('>Q',n)
    return bytes(h)+data

def send(w,obj):
    try: w.write(frame(1,json.dumps(obj,separators=(',',':')).encode()))
    except Exception: pass

async def handle(reader,writer):
    global nextPid
    try:
        req=await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'),10)
    except Exception:
        writer.close(); return
    head=req.decode('latin1').split('\r\n'); line=head[0]; hdr={}
    for l in head[1:]:
        if ':' in l: k,v=l.split(':',1); hdr[k.strip().lower()]=v.strip()
    if 'upgrade' not in hdr.get('connection','').lower() or 'sec-websocket-key' not in hdr:
        body=json.dumps({'rooms':{k:{'n':len(v['members']),'level':v['level']} for k,v in rooms.items()}}).encode()
        writer.write(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: %d\r\n\r\n'%len(body)+body)
        await writer.drain(); writer.close(); return
    acc=base64.b64encode(hashlib.sha1((hdr['sec-websocket-key']+GUID).encode()).digest()).decode()
    writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n'%acc).encode())
    await writer.drain()
    pid=nextPid; nextPid+=1; room=None
    try:
        while True:
            op,data=await asyncio.wait_for(recv_frame(reader),60)
            if op==8: break
            if op==9: writer.write(frame(10,data)); continue
            if op!=1: continue
            try: m=json.loads(data)
            except Exception: continue
            t=m.get('t')
            if t=='hello':
                name=str(m.get('room','lobby'))[:32]; r=rooms.setdefault(name,{'level':None,'members':{},'epoch':time.time()})
                if room is not None and room!=name: leave(room,pid)
                room=name; r['members'][pid]=writer
                # the room's level: set by the first arrival, and by anyone arriving fresh from clearing a level
                if r['level'] is None or m.get('fresh') or len(r['members'])==1: r['level']=m.get('level')
                send(writer,{'t':'welcome','pid':pid,'level':r['level'],'peers':[p for p in r['members'] if p!=pid],'now':time.time(),'epoch':r['epoch']})
                for p,w in r['members'].items():
                    if p!=pid: send(w,{'t':'join','pid':pid,'level':r['level']})
                log('join',name,pid,'members',len(r['members']),'level',r['level'])
            elif t=='s' and room:
                m['pid']=pid; r=rooms[room]
                for p,w in r['members'].items():
                    if p!=pid: send(w,m)
            elif t=='ping':
                send(writer,{'t':'pong','now':time.time(),'c':m.get('c')})
    except Exception as e:
        pass
    finally:
        if room: leave(room,pid)
        try: writer.close()
        except Exception: pass

def leave(room,pid):
    r=rooms.get(room)
    if not r or pid not in r['members']: return
    del r['members'][pid]
    for p,w in r['members'].items(): send(w,{'t':'leave','pid':pid})
    log('leave',room,pid,'members',len(r['members']))
    if not r['members']: del rooms[room]

async def main():
    port=int(sys.argv[1]) if len(sys.argv)>1 else 8765
    srv=await asyncio.start_server(handle,'0.0.0.0',port)
    log('relay on',port)
    async with srv: await srv.serve_forever()

if __name__=='__main__':
    try: asyncio.run(main())
    except KeyboardInterrupt: pass
