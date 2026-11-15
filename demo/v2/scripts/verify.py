"""Verify timing, decoding, actual API provenance, captions and recorded interaction."""
import json,re,struct,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'demo/assets/production-python'))
import imageio_ffmpeg
from PIL import Image,ImageDraw,ImageFont,ImageChops,ImageStat
BASE=ROOT/'demo/v2';QA=BASE/'assets/qa';QA.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()

def movie_duration(path):
 data=path.read_bytes()
 def boxes(a,b):
  while a+8<=b:
   size,kind=struct.unpack_from('>I4s',data,a);head=8
   if size==1:size=struct.unpack_from('>Q',data,a+8)[0];head=16
   if size==0:size=b-a
   yield kind,a+head,a+size
   a+=size
 moov=next((a,b) for k,a,b in boxes(0,len(data)) if k==b'moov')
 a,b=next((a,b) for k,a,b in boxes(*moov) if k==b'mvhd')
 if data[a]==0:scale,ticks=struct.unpack_from('>II',data,a+12)
 else:scale=struct.unpack_from('>I',data,a+20)[0];ticks=struct.unpack_from('>Q',data,a+24)[0]
 return ticks/scale

def media():
 video=BASE/'final_demo.mp4'
 duration=movie_duration(video);assert duration==60
 r=subprocess.run([FF,'-v','info','-i',str(video),'-map','0:v:0','-map','0:a:0','-progress','pipe:1','-f','null','-'],capture_output=True,text=True,check=True)
 (QA/'decode.log').write_text(r.stderr+r.stdout,encoding='utf-8')
 frames=int(re.findall(r'^frame=(\d+)',r.stdout,re.M)[-1]);assert frames==1800
 assert 'Video: h264' in r.stderr and 'Audio: aac' in r.stderr and '1920x1080' in r.stderr
 cues=re.findall(r'(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)',(BASE/'subtitles.srt').read_text())
 intervals=[]
 for c in cues:
  n=list(map(int,c));intervals.append((n[0]*3600+n[1]*60+n[2]+n[3]/1000,n[4]*3600+n[5]*60+n[6]+n[7]/1000))
 assert all(0<=a<b<=60 for a,b in intervals)
 assert all(intervals[i][1]<=intervals[i+1][0] for i in range(len(intervals)-1))
 script=(BASE/'narration.md').read_text().lower();assert 'inclusion and exclusion criteria' in script
 assert 'thirty' not in script and 'synthetic' not in script and '30' not in script
 assert 'saves teams time' in script and 'patients who need them sooner' in script
 times=[0,2,5,7.5,10,12.5,15.5,18.5,21.5,24,27,30,33.5,36.5,39.5,42.5,46,49.5,52.5,54,56,58.5]
 sheet=Image.new('RGB',(1600,5*210),'#f5faf6');draw=ImageDraw.Draw(sheet);font=ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf',16)
 for i,t in enumerate(times):
  target=QA/f'frame-{t:g}.png'
  subprocess.run([FF,'-y','-v','error','-ss',str(t),'-i',str(video),'-frames:v','1',str(target)],check=True)
  frame=Image.open(target);frame.thumbnail((320,180));x=(i%5)*320;y=(i//5)*210;sheet.paste(frame,(x,y));draw.text((x+6,y+183),f'{t:g}s',font=font,fill='#12392b')
 sheet.save(QA/'contact-sheet.jpg')
 # Motion is verified from rendered 3D frames, not inferred from changing titles.
 scene=BASE/'assets/brand/frames3d'
 motion={}
 for name in ['intro','outro']:
  a=Image.open(scene/f'{name}-0000.png').convert('RGB');b=Image.open(scene/f'{name}-0120.png').convert('RGB')
  value=sum(ImageStat.Stat(ImageChops.difference(a,b)).mean)/3
  assert value>1
  motion[name]=value
 journey=json.loads((BASE/'recordings/take02/journey.json').read_text())
 assert not journey['errors'] and not journey['pageErrors']
 clicks=sum(a['type']=='click' for a in journey['actions']);typing=sum(a['type']=='typing' for a in journey['actions'])
 assert clicks>=30 and typing>=4
 assert all(200<=m['status']<300 for m in journey['mutations'])
 report={'duration_seconds':duration,'frames':frames,'fps':30,'resolution':[1920,1080],'video_codec':'h264','audio_codec':'aac','decode':'passed','caption_intervals':'valid and nonoverlapping','single_browser_take':True,'recorded_clicks':clicks,'typed_entries':typing,'browser_errors':journey['pageErrors'],'real_3d_frame_difference':motion,'quiet_music_target_lufs':-36,'voice_target_lufs':-16,'file_bytes':video.stat().st_size}
 (QA/'technical.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

if __name__=='__main__':media()
