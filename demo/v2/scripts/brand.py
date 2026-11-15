"""Original vector identity and deterministic motion graphics; no fabricated app UI."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

INK=(245,250,246);MINT=(20,130,82);WHITE=(18,57,43);MUTED=(81,113,96);BLUE=(174,212,185)
DISPLAY='C:/Windows/Fonts/bahnschrift.ttf'
TEXT='C:/Windows/Fonts/segoeui.ttf'
FONTS={}
def font(size,display=False):
    key=(size,display)
    if key not in FONTS:FONTS[key]=ImageFont.truetype(DISPLAY if display else TEXT,size)
    return FONTS[key]
def ease(t):
    t=max(0,min(1,t));return t*t*(3-2*t)
def label(im,xy,s,size=24,color=WHITE,display=False):
    ImageDraw.Draw(im).text(xy,s,font=font(size,display),fill=color)

def bezier(a,b,c,d,n=40):
    return [((1-t)**3*a[0]+3*(1-t)**2*t*b[0]+3*(1-t)*t*t*c[0]+t**3*d[0],(1-t)**3*a[1]+3*(1-t)**2*t*b[1]+3*(1-t)*t*t*c[1]+t**3*d[1]) for t in [i/n for i in range(n+1)]]

def logo(size=300):
    s=4
    im=Image.new('RGBA',(192*s,192*s))
    d=ImageDraw.Draw(im)
    def scale(points):return [(int(x*s),int(y*s)) for x,y in points]
    outer=[(28,164),(28,30),(103,30)]+bezier((103,30),(160,30),(160,125),(103,125))+[(70,125),(70,164)]
    d.polygon(scale(outer),fill=MINT)
    inner=[(70,65),(102,65)]+bezier((102,65),(119,65),(119,89),(102,89))+[(70,89)]
    d.polygon(scale(inner),fill=INK)
    d.polygon(scale([(105,30),(148,60),(148,36)]),fill=BLUE)
    d.line(scale([(11,127),(27,127),(45,106),(60,140),(79,116),(103,116)]),fill=(255,255,255),width=5*s,joint='curve')
    return im.resize((size,size),Image.Resampling.LANCZOS)

def background():
    im=Image.new('RGB',(1920,1080),INK)
    glow=Image.new('RGB',(480,270),INK);d=ImageDraw.Draw(glow)
    d.ellipse((200,-80,590,350),fill=(224,241,230))
    d.ellipse((300,100,600,500),fill=(233,245,235))
    glow=glow.filter(ImageFilter.GaussianBlur(70)).resize(im.size,Image.Resampling.BICUBIC)
    return glow

BG=background()
def trails(im,t,opacity=1):
    layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer)
    for n in range(7):
        pts=[]
        for x in range(-20,1960,8):
            y=610+n*30+145*math.sin(x/490+t*.28+n*.19)
            pts.append((x,y))
        d.line(pts,fill=(*MINT,int((15+n*3)*opacity)),width=2)
    x=(t*310)%2400-200
    points=bezier((x-500,830),(x-180,760),(x-120,370),(x+120,370),60)
    for i in range(1,len(points)):
        d.line(points[max(0,i-1):i+1],fill=(*MINT,int(220*i/len(points)*opacity)),width=4)
    blur=layer.filter(ImageFilter.GaussianBlur(13));im.paste(blur,(0,0),blur)
    im.paste(layer,(0,0),layer)

def cinematic(t,closing=False):
    folder=Path(__file__).resolve().parents[1]/'assets/brand/frames3d'
    name='outro' if closing else 'intro';index=max(0,min(150 if closing else 215,round(t*30)))
    source=folder/f'{name}-{index:04}.png'
    im=Image.open(source).convert('RGB')
    label(im,(112,73),'PROTOCOLPULSE',27,MINT,True)
    label(im,(112,117),'CLINICAL INTELLIGENCE, IN MOTION',17,MUTED)
    d=ImageDraw.Draw(im)
    if closing:
        e=ease(t/.7)
        label(im,(110,int(290+22*(1-e))),'Keep the trial',88,WHITE,True)
        label(im,(110,int(388+22*(1-e))),'moving.',104,MINT,True)
        label(im,(116,573),'Bring new medicines closer',32,WHITE,True)
        label(im,(116,621),'to the patients who need them.',32,WHITE,True)
        label(im,(116,766),'AI assists. Clinical teams decide.',23,MUTED)
        label(im,(116,969),'Potential benefit. Clinical and regulatory review remain essential.',18,MUTED)
    else:
        label(im,(110,292),'From protocol.',86,WHITE,True)
        e=ease((t-.2)/.75)
        color=tuple(round(INK[i]*(1-e)+MINT[i]*e) for i in range(3))
        label(im,(110,int(398+22*(1-e))),'To progress.',96,color,True)
        label(im,(116,570),'Helping clinical teams move',30,MUTED)
        label(im,(116,614),'promising research forward.',30,MUTED)
        labels=['INTERPRET','MATCH','MONITOR']
        for i,s in enumerate(labels):
            x=115+i*240
            d.rounded_rectangle((x,774,x+210,826),radius=26,outline=(174,212,185),width=1)
            label(im,(x+24,787),s,19,MINT if t>i*.65 else MUTED,True)
    return im

def save_assets(out):
    out.mkdir(parents=True,exist_ok=True)
    logo(768).save(out/'symbol.png')
    svg='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><path fill="#63f0c9" fill-rule="evenodd" d="M28 164V30h75c76 0 76 95 0 95H70v39z M70 65v24h32c23 0 23-24 0-24z"/><path fill="#8b97ff" d="M105 30l43 30V36z"/><path fill="none" stroke="#f6f7f2" stroke-width="5" stroke-linejoin="round" d="M11 127h16l18-21 15 34 19-24h24"/></svg>'''
    svg=svg.replace('#63f0c9','#148252').replace('#8b97ff','#aed4b9')
    (out/'symbol.svg').write_text(svg)
    lockup='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 192"><rect width="960" height="192" fill="#081222"/>'+svg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">','<svg width="192" height="192" viewBox="0 0 192 192">')+'<text x="215" y="119" fill="#f6f7f2" font-family="Bahnschrift, sans-serif" font-size="82">ProtocolPulse</text></svg>'
    lockup=lockup.replace('#081222','#f5faf6').replace('#f6f7f2','#12392b')
    (out/'lockup.svg').write_text(lockup)
    sheet=BG.copy();m=logo(400);sheet.paste(m,(110,170),m)
    label(sheet,(560,235),'ProtocolPulse',98,WHITE,True)
    label(sheet,(570,368),'Keep the trial moving.',37,MUTED)
    for i,(name,color) in enumerate([('PAPER / F5FAF6',INK),('EMERALD / 148252',MINT),('SAGE / AED4B9',BLUE),('FOREST / 12392B',WHITE)]):
        x=112+i*430;ImageDraw.Draw(sheet).rounded_rectangle((x,660,x+370,820),radius=16,fill=color,outline=MUTED)
        label(sheet,(x,844),name,22,MUTED)
    sheet.save(out/'identity.png')
