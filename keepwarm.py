import os
import urllib.request

# Render cron job: periodically hit the health endpoint so a free-tier web
# instance doesn't fall asleep (preventing 30-60s cold starts for visitors).
if __name__ == '__main__':
    url = os.environ.get('KEEP_WARM_URL', 'https://raaji-collections.onrender.com/api/health')
    try:
        with urllib.request.urlopen(url, timeout=45) as r:
            print('keep-warm OK', r.status)
    except Exception as e:
        # A timeout can happen while the instance is waking up; the scheduler
        # runs again in 10 minutes, so a single miss is harmless.
        print('keep-warm failed:', e)