#!/usr/bin/env bash
# ============================================================
# PiBoard - install/install.sh
# Installation sur Raspberry Pi OS (Bookworm, Lite ou Desktop)
#   1. Node.js LTS (NodeSource) si absent
#   2. Dependances npm et service systemd "piboard"
#   3. Optionnel : mode kiosque (Chromium plein ecran via cage)
#
# Installation on Raspberry Pi OS (Bookworm, Lite or Desktop)
#   1. Node.js LTS (NodeSource) if missing
#   2. npm dependencies and "piboard" systemd service
#   3. Optional: kiosk mode (fullscreen Chromium through cage)
#
# Usage:  sudo ./install/install.sh [--kiosk] [--port 8090]
# ============================================================
set -euo pipefail

KIOSK=0
PORT=8090
for arg in "$@"; do
  case "$arg" in
    --kiosk) KIOSK=1 ;;
    --port) : ;;
    --port=*) PORT="${arg#*=}" ;;
    *) if [[ "${prev:-}" == "--port" ]]; then PORT="$arg"; fi ;;
  esac
  prev="$arg"
done

if [[ $EUID -ne 0 ]]; then
  echo "Merci de lancer ce script avec sudo. / Please run this script with sudo." >&2
  exit 1
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-pi}"
NODE_MIN_MAJOR=18

echo "==> PiBoard installer"
echo "    App dir : $APP_DIR"
echo "    User    : $RUN_USER"
echo "    Port    : $PORT"
echo "    Kiosk   : $KIOSK"

# ---------- 1. Node.js ----------
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/^v\([0-9]*\).*/\1/')"
  if [[ "$major" -ge "$NODE_MIN_MAJOR" ]]; then
    need_node=0
    echo "==> Node.js $(node -v) deja present / already installed"
  fi
fi
if [[ "$need_node" -eq 1 ]]; then
  echo "==> Installation de Node.js 22 LTS (NodeSource) / installing Node.js 22 LTS"
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

# ---------- 2. Dependances + service ----------
echo "==> Dependances npm / npm dependencies"
cd "$APP_DIR"
sudo -u "$RUN_USER" npm ci --omit=dev 2>/dev/null || sudo -u "$RUN_USER" npm install --omit=dev

mkdir -p "$APP_DIR/data"
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR/data"

echo "==> Service systemd : piboard"
sed -e "s|@APP_DIR@|$APP_DIR|g" \
    -e "s|@USER@|$RUN_USER|g" \
    -e "s|@PORT@|$PORT|g" \
    "$APP_DIR/install/piboard.service" > /etc/systemd/system/piboard.service
systemctl daemon-reload
systemctl enable --now piboard.service
sleep 1
systemctl --no-pager --lines=3 status piboard.service || true

# ---------- 3. Kiosque (optionnel) ----------
if [[ "$KIOSK" -eq 1 ]]; then
  # cage (compositeur Wayland minimal) ne fonctionne que si RIEN d'autre ne
  # tient deja le siege d'affichage (TTY1). Sur une image "Lite" (sans
  # bureau), c'est le cas et cage demarre normalement. Mais sur une image
  # "Desktop" (Bookworm ou Trixie Desktop) avec connexion automatique,
  # labwc (ou un autre compositeur) tient deja ce siege des le demarrage :
  # le service kiosque base sur cage reste alors bloque en attente du TTY et
  # ne demarre jamais, sans message d'erreur explicite -- exactement le
  # probleme rencontre et documente lors de la mise au point de ce projet.
  # Plutot que d'installer silencieusement un service qui ne fonctionnera
  # pas, on detecte ce cas et on redirige vers la methode qui fonctionne
  # reellement pour Desktop (voir INSTALL.md).
  #
  # cage (minimal Wayland compositor) only works if NOTHING else already
  # holds the display seat (TTY1). On a "Lite" image (no desktop), that's
  # the case and cage starts normally. But on a "Desktop" image (Bookworm
  # or Trixie Desktop) with autologin, labwc (or another compositor)
  # already holds that seat at boot: the cage-based kiosk service then
  # stays stuck waiting for the TTY and never starts, with no clear error
  # message -- exactly the issue encountered and documented while building
  # this project. Rather than silently installing a service that won't
  # work, this is detected and redirected to the method that actually
  # works for Desktop (see INSTALL.md).
  DESKTOP_DETECTED=0
  if pgrep -x labwc >/dev/null 2>&1 || pgrep -x wayfire >/dev/null 2>&1 || pgrep -x lxsession >/dev/null 2>&1; then
    DESKTOP_DETECTED=1
  elif systemctl is-active --quiet lightdm.service 2>/dev/null || systemctl is-active --quiet gdm.service 2>/dev/null; then
    DESKTOP_DETECTED=1
  elif dpkg -l 2>/dev/null | grep -qi "raspberrypi-ui-mods\|labwc"; then
    DESKTOP_DETECTED=1
  fi

  if [[ "$DESKTOP_DETECTED" -eq 1 ]]; then
    echo "==> Environnement de bureau detecte (labwc/lightdm/gdm ou paquet Desktop)."
    echo "    Le mode kiosque automatique (cage) NE FONCTIONNERA PAS ici : le"
    echo "    compositeur de bureau tient deja le siege d'affichage."
    echo "    Suivez plutot la section \"Kiosque sur image Desktop\" de INSTALL.md"
    echo "    (methode labwc autostart, testee et fonctionnelle)."
    echo ""
    echo "    Desktop environment detected (labwc/lightdm/gdm or Desktop package)."
    echo "    Automatic kiosk mode (cage) WILL NOT WORK here: the desktop"
    echo "    compositor already holds the display seat."
    echo "    Follow the \"Kiosk on a Desktop image\" section of INSTALL.md instead"
    echo "    (labwc autostart method, tested and working)."
  else
    echo "==> Mode kiosque : chromium + cage (compositeur Wayland minimal)"
    apt-get install -y -qq --no-install-recommends chromium-browser cage seatd || \
    apt-get install -y -qq --no-install-recommends chromium cage seatd

    usermod -aG video,render,input "$RUN_USER" || true

    sed -e "s|@USER@|$RUN_USER|g" \
        -e "s|@PORT@|$PORT|g" \
        "$APP_DIR/install/piboard-kiosk.service" > /etc/systemd/system/piboard-kiosk.service
    systemctl daemon-reload
    systemctl enable piboard-kiosk.service
    echo "==> Kiosque installe. Il demarrera au prochain redemarrage."
    echo "    Kiosk installed. It will start on next reboot."
  fi
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "============================================================"
echo " PiBoard est installe / PiBoard is installed"
echo "   URL : http://${IP:-<ip-du-pi>}:$PORT"
echo "   Logs: journalctl -u piboard -f"
if [[ "$KIOSK" -eq 1 ]]; then
  echo "   Kiosque / kiosk: sudo reboot"
fi
echo "============================================================"
