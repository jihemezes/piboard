#!/usr/bin/env bash
# ============================================================
# PiBoard - relance complete depuis le bureau (1.180.0)
# Lance par l'icone « PiBoard » du bureau et du menu du Raspberry Pi.
#   1. ferme l'affichage plein ecran (Chromium kiosque) s'il tourne ;
#   2. redemarre le serveur PiBoard (service systemd « piboard ») :
#      sans mot de passe si install/enable-launcher.sh a ete lance une
#      fois, sinon avec la fenetre de mot de passe du systeme -- et s'il
#      est refuse alors que le serveur repond, on continue sans lui ;
#   3. attend que le serveur reponde (60 s au plus) ;
#   4. rouvre le tableau de bord en plein ecran, comme au demarrage.
#
# Full relaunch from the desktop: close the kiosk display, restart the
# PiBoard server (passwordless once install/enable-launcher.sh has been
# run, otherwise through the system password prompt), wait for it, then
# reopen the dashboard full screen, as at boot.
# ============================================================
set -u

PORT="$(systemctl show piboard.service -p Environment --value 2>/dev/null | tr ' ' '\n' | sed -n 's/^PIBOARD_PORT=//p' | head -1)"
PORT="${PORT:-8090}"
URL="http://localhost:${PORT}/"
LOG="${XDG_RUNTIME_DIR:-/tmp}/piboard-launch.log"

say() {
  echo "$(date '+%H:%M:%S') $*" >> "$LOG"
  command -v notify-send >/dev/null 2>&1 && notify-send -a PiBoard -t 4000 "PiBoard" "$*" 2>/dev/null || true
}

: > "$LOG"
say "Relance de PiBoard… / Relaunching PiBoard…"

# 1. Affichage plein ecran / kiosk display
pkill -x lwrespawn 2>/dev/null || true
pkill -x chromium 2>/dev/null || true
pkill -x chromium-browser 2>/dev/null || true
sleep 1

# 2. Serveur / server
up() { curl -fsS -m 3 "${URL}api/settings" >/dev/null 2>&1; }
if systemctl restart --no-ask-password piboard.service 2>>"$LOG"; then
  echo "service redemarre / service restarted" >> "$LOG"
elif command -v pkexec >/dev/null 2>&1 && pkexec systemctl restart piboard.service 2>>"$LOG"; then
  echo "service redemarre (pkexec) / service restarted (pkexec)" >> "$LOG"
elif up; then
  echo "redemarrage refuse, serveur deja actif / restart refused, server already up" >> "$LOG"
else
  say "Le serveur PiBoard ne démarre pas. Voir : journalctl -u piboard / The PiBoard server does not start."
  exit 1
fi

# 3. Attente du serveur / wait for the server
for _ in $(seq 1 60); do
  up && break
  sleep 1
done
if ! up; then
  say "Le serveur PiBoard ne répond pas. Voir : journalctl -u piboard / The PiBoard server does not answer."
  exit 1
fi

# 4. Tableau de bord plein ecran / full-screen dashboard
BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [[ -z "$BROWSER" ]]; then
  say "Chromium introuvable / Chromium not found"
  exit 1
fi
ARGS=(--kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble
      --password-store=basic --check-for-update-interval=31536000
      --autoplay-policy=no-user-gesture-required "$URL")
if command -v lwrespawn >/dev/null 2>&1; then
  setsid lwrespawn "$BROWSER" "${ARGS[@]}" >/dev/null 2>&1 < /dev/null &
else
  setsid "$BROWSER" "${ARGS[@]}" >/dev/null 2>&1 < /dev/null &
fi
echo "kiosque relance / kiosk relaunched" >> "$LOG"
exit 0
