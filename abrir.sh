#!/usr/bin/env bash
# Abre o Repertor.io com o servidor local (127.0.0.1:4321).
# O servidor serve o app e a importação por link (servidor.py, só Python 3, sem instalar nada).
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTA=4321
URL="http://127.0.0.1:$PORTA/"
if ! curl -s "${URL}api/status" | grep -q Repertor; then
  # algo antigo ocupando a porta (ex.: versão anterior com http.server): encerra
  if curl -s -o /dev/null "$URL"; then
    (command -v fuser >/dev/null && fuser -k "$PORTA/tcp") >/dev/null 2>&1 || pkill -f "http.server $PORTA" >/dev/null 2>&1
    sleep 0.5
  fi
  nohup python3 "$DIR/servidor.py" "$PORTA" >/dev/null 2>&1 &
  for _ in $(seq 1 20); do curl -s "${URL}api/status" | grep -q Repertor && break; sleep 0.25; done
fi
xdg-open "$URL" >/dev/null 2>&1 &
