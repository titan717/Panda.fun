#!/usr/bin/env bash
set -euo pipefail

failed=0
while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  status="$(curl -L -sS -o /dev/null -w '%{http_code}' -r 0-0 --max-time 25 "$url" || true)"
  case "$status" in
    200|206) echo "OK $status $url" ;;
    *) echo "BROKEN ${status:-no-response} $url"; failed=1 ;;
  esac
done <<'URLS'
https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=800&q=80
https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80
https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80
https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80
https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80
https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80
https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80
https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80
https://assets.mixkit.co/videos/101416/101416-720.mp4
https://assets.mixkit.co/videos/4308/4308-720.mp4
https://assets.mixkit.co/videos/52427/52427-720.mp4
https://assets.mixkit.co/videos/35540/35540-720.mp4
https://assets.mixkit.co/videos/41576/41576-720.mp4
https://assets.mixkit.co/videos/39912/39912-720.mp4
URLS

exit "$failed"