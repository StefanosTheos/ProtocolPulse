"""One continuous cursor-led take, original motion identity, quiet ambient mix."""
import json, math, os, re, struct, subprocess, sys, wave
from pathlib import Path,PureWindowsPath

ROOT=Path(__file__).resolve().parents[3]
os.chdir(ROOT)
sys.path.insert(0,str(ROOT/'demo/assets/production-python'))
import imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFilter
import brand

BASE=Path('demo/v2');ASSETS=BASE/'assets';EDIT=ASSETS/'edit';EDIT.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe();FPS=30;INTRO=6.7;OUTRO=55.0;VOICE_SPEED=.92;VOICE_TRIM=.18
PROOF=json.loads((BASE/'recordings/take02/journey.json').read_text())
PROOF['video']=str(BASE/'recordings/take02'/PureWindowsPath(PROOF['video']).name)
assert not PROOF['errors'] and not PROOF['pageErrors']
MARKS={m['name']:m['time'] for m in PROOF['marks']};MARKS['end']=PROOF['duration']-.15

def run(args,log):
    with (EDIT/log).open('w',encoding='utf-8') as f:subprocess.run([FF,'-y','-hide_banner',*map(str,args)],stdout=f,stderr=f,check=True)

def timeline():
    names=['start','extract-wait','extract-ready','rules','source','approve-protocol','protocol-complete','screen-wait','screen-ready','cohort','uncertainty','participation-start','participation-complete','event-form','event-wait','event-ready','ai-wait','ai-ready','case','case-evidence','review','done','end']
    durations=[3,.4,.5,1.7,3.5,1.8,1.2,.4,1,3.2,4.8,2.5,2.4,2.6,.4,2.2,.5,1.8,2.7,6.8,3.4,1.5]
    total=round((OUTRO-INTRO)*30);counts=[round(d*30) for d in durations];counts[-1]+=total-sum(counts)
    result=[];at=INTRO
    for i,(a,b) in enumerate(zip(names,names[1:])):
        length=counts[i]/30
        result.append(dict(name=a,source_start=MARKS[a],source_end=MARKS[b],start=at,end=at+length,frames=counts[i]))
        at+=length
    (ASSETS/'timeline.json').write_text(json.dumps(result,indent=2))
    return result

def map_time(t,timeline):
    for item in timeline:
        if item['source_start']<=t<=item['source_end']:
            p=(t-item['source_start'])/(item['source_end']-item['source_start'])
            return item['start']+p*(item['end']-item['start'])
    return None

def retime(timeline):
    clips=[]
    for i,item in enumerate(timeline):
        target=EDIT/f'part-{i:02}.mp4';clips.append(target)
        source_duration=item['source_end']-item['source_start'];output_duration=item['frames']/30
        vf=f'setpts={output_duration/source_duration:.9f}*(PTS-STARTPTS),fps=30,tpad=stop_mode=clone:stop_duration=2'
        run(['-ss',item['source_start'],'-t',source_duration,'-i',PROOF['video'],'-an','-vf',vf,'-frames:v',item['frames'],'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',target],f'part-{i:02}.log')
    listing=EDIT/'concat.txt';listing.write_text('\n'.join("file '"+p.name+"'" for p in clips))
    run(['-f','concat','-safe','0','-i',listing,'-c','copy',EDIT/'journey-retimed.mp4'],'retime.log')

def captions():
    d=json.loads((ASSETS/'transcript-master-job.json').read_text())['result']
    words=[w for w in d['words'] if w['type']=='word'];groups=[];current=[]
    for w in words:
        if current and (len(' '.join(x['text'] for x in current))+len(w['text'])>65 or w['start']-current[-1]['end']>.55):groups.append(current);current=[]
        current.append(w)
        if re.search(r'[.!?]$',w['text']):groups.append(current);current=[]
    if current:groups.append(current)
    cues=[]
    for g in groups:
        start=max(0,(g[0]['start']-VOICE_TRIM)/VOICE_SPEED)
        end=(g[-1]['end']-VOICE_TRIM)/VOICE_SPEED+.12
        s=' '.join(w['text'] for w in g).replace('Protocol Pulse','ProtocolPulse')
        cues.append([start,min(end,59.4),s])
    for i in range(len(cues)-1):cues[i][1]=min(cues[i][1],cues[i+1][0]-.025)
    def timestamp(t,ass=False):
        ms=round(t*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
        return f'{h}:{m:02}:{s:02}.{ms//10:02}' if ass else f'{h:02}:{m:02}:{s:02},{ms:03}'
    (BASE/'subtitles.srt').write_text('\n\n'.join(f'{i}\n{timestamp(a)} --> {timestamp(b)}\n{s}' for i,(a,b,s) in enumerate(cues,1))+'\n',encoding='utf-8')
    header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,35,&H00F2F7F6,&H00F2F7F6,&H002B3912,&H002B3912,0,0,0,0,100,100,0,0,3,8,0,2,150,150,25,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    (ASSETS/'subtitles.ass').write_text(header+'\n'.join(f'Dialogue: 0,{timestamp(a,True)},{timestamp(b,True)},Default,,0,0,0,,{{\\fad(60,60)}}{s}' for a,b,s in cues),encoding='utf-8')
    return cues

def click_track(timeline):
    rate=48000;count=60*rate;data=[0.0]*count
    for action in PROOF['actions']:
        if action['type']!='click':continue
        t=map_time(action['time'],timeline)
        if t is None:continue
        begin=int(t*rate)
        for i in range(int(.027*rate)):
            if begin+i<count:
                p=i/rate
                data[begin+i]+=.026*math.exp(-p*170)*(math.sin(2*math.pi*850*p)+.25*math.sin(2*math.pi*1700*p))
    with wave.open(str(ASSETS/'clicks.wav'),'wb') as w:
        w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate)
        w.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,v))*32767)) for v in data))

def camera(im,t,timeline):
    zoom_start=next(i['start'] for i in timeline if i['name']=='case-evidence')
    e=brand.ease((t-zoom_start)/1.2)
    zoom=1+.42*e
    cw=1600/zoom;ch=800/zoom
    center_x=800+315*e;center_y=400+18*e
    x=max(0,min(1600-cw,center_x-cw/2));y=max(0,min(800-ch,center_y-ch/2))
    return im.crop((round(x),round(y),round(x+cw),round(y+ch)))

def frame_ui(raw,t,timeline):
    im=brand.BG.copy();d=ImageDraw.Draw(im)
    small=SYMBOL;im.paste(small,(83,17),small)
    brand.label(im,(143,30),'ProtocolPulse',29,brand.WHITE,True)
    stages=[('INTERPRET',INTRO),('MATCH',17.6),('MONITOR',30.6),('REVIEW',40.5)]
    for i,(name,begin) in enumerate(stages):
        x=840+i*230;active=t>=begin
        d.ellipse((x,41,x+7,48),fill=brand.MINT if active else (177,201,184))
        brand.label(im,(x+19,30),name,18,brand.MINT if active else brand.MUTED,True)
    brand.label(im,(98,991),'Synthetic demonstration  •  Real application  •  Processing waits compressed',17,brand.MUTED)
    d.rounded_rectangle((91,91,1829,969),radius=18,fill=(196,220,204))
    # The camera follows the reviewer into the actual right-hand evidence panel.
    ui=camera(raw,t,timeline).resize((1728,864),Image.Resampling.LANCZOS)
    im.paste(ui,(96,98),MASK)
    p=(t-INTRO)/(OUTRO-INTRO)
    d.line((96,1020,1824,1020),fill=(196,220,204),width=2)
    d.line((96,1020,96+int(1728*p),1020),fill=brand.MINT,width=2)
    return im

def render(timeline):
    global SYMBOL,MASK
    SYMBOL=brand.logo(56);MASK=Image.new('L',(1728,864));ImageDraw.Draw(MASK).rounded_rectangle((0,0,1728,864),radius=12,fill=255)
    brand.save_assets(ASSETS/'brand')
    decoder=subprocess.Popen([FF,'-v','error','-i',str(EDIT/'journey-retimed.mp4'),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
    log=(EDIT/'motion.log').open('w')
    encoder=subprocess.Popen([FF,'-v','warning','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1920x1080','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(EDIT/'picture.mp4')],stdin=subprocess.PIPE,stderr=log)
    first=None;last=None
    frame_size=1600*800*3
    for n in range(1800):
        t=n/30
        if t<INTRO:
            frame=brand.cinematic(t)
        elif t<OUTRO:
            buf=decoder.stdout.read(frame_size)
            if len(buf)!=frame_size:raise RuntimeError(f'Browser footage ended at output frame {n}')
            raw=Image.frombytes('RGB',(1600,800),buf)
            frame=frame_ui(raw,t,timeline);last=frame
            if t<INTRO+.45:
                e=brand.ease((t-INTRO)/.45)
                frame=Image.blend(brand.cinematic(t),frame,e)
        else:
            frame=brand.cinematic(t-OUTRO,True)
            if t<OUTRO+.45:frame=Image.blend(last,frame,brand.ease((t-OUTRO)/.45))
        encoder.stdin.write(frame.tobytes())
        if n%300==0:print(f'Motion render {n}/1800',flush=True)
    encoder.stdin.close();assert encoder.wait()==0
    decoder.stdout.close();decoder.wait();log.close()

def master():
    # Ambient is ~20 dB below speech, with further ducking while the narrator speaks.
    filters=f'[0:v]subtitles=demo/v2/assets/subtitles.ass[v];[1:a]atrim=start={VOICE_TRIM},asetpts=PTS-STARTPTS,atempo={VOICE_SPEED},loudnorm=I=-16:TP=-2:LRA=6,apad,atrim=0:60,asplit=2[vo][side];[2:a]loudnorm=I=-36:TP=-8:LRA=3,afade=t=in:d=0.12,afade=t=out:st=58.4:d=1.6[bed];[bed][side]sidechaincompress=threshold=.025:ratio=3:attack=15:release=450[m];[vo][m][3:a]amix=inputs=3:normalize=0,alimiter=limit=.94:level=false[a]'
    run(['-i',EDIT/'picture.mp4','-i',ASSETS/'voice-master.mp3','-i',ASSETS/'ambient.mp3','-i',ASSETS/'clicks.wav','-i',BASE/'subtitles.srt','-filter_complex',filters,'-map','[v]','-map','[a]','-map','4:0','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-c:s','mov_text','-metadata:s:s:0','language=eng','-metadata','title=ProtocolPulse — Keep the trial moving','-t','60','-movflags','+faststart',BASE/'final_demo.mp4'],'master.log')

if __name__=='__main__':
    tl=timeline();captions();click_track(tl)
    if '--mix-only' not in sys.argv:
        if '--motion-only' not in sys.argv:retime(tl)
        if '--retime-only' in sys.argv:sys.exit(0)
        render(tl)
    master()
    print('Finished demo/v2/final_demo.mp4',flush=True)
