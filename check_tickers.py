import re,urllib.request,time
import build_monthly_videos_auto as b
e=b.load_env_local()
k=e.get('TWELVE_DATA_API_KEY')
p='app/api/cron/refresh-monthly-rankings/route.ts'
src=open(p,encoding='utf-8').read()
blk=src.split('CURATED_UNIVERSE = [')[1].split(']')[0]
syms=re.findall(r"'([A-Z]+)'",blk)
print(len(syms),'symbols to check')
dead=[]
for i,s in enumerate(syms,1):
    u='https://api.twelvedata.com/time_series?symbol='+s+'&interval=1day&outputsize=2&apikey='+k
    try:
        urllib.request.urlopen(u,timeout=20).read()
    except Exception as ex:
        dead.append(s)
        print(i,s,'DEAD',ex)
    time.sleep(8)
print('')
print('DEAD TICKERS:',dead)
