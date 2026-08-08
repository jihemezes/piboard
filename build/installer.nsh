; ============================================================
; PiBoard - build/installer.nsh
; Etape optionnelle, a la fin de l'installation : propose de
; telecharger ffmpeg (necessaire au mode de compatibilite video des
; chaines IPTV, lui-meme facultatif et desactive par defaut). Refuser
; ou echouer au telechargement n'empeche jamais l'installation de
; PiBoard de se terminer normalement.
;
; Le binaire vient d'une release DEDIEE sur le depot GitHub de
; PiBoard (pas directement de BtbN/FFmpeg-Builds) : une version
; PRECISE et STABLE plutot que "la derniere en date", pour eviter
; qu'une modification en amont ne casse silencieusement
; l'installateur. Void ATTRIBUTION.txt dans cette meme release pour
; le detail de la provenance et de la licence (GPLv3) de ce binaire.
; PiBoard le LANCE comme un processus separe, jamais lie dans son
; propre code : la licence GPL de ffmpeg ne s'applique qu'a ce
; fichier, pas au reste de l'application.
;
; ============================================================
; PiBoard - build/installer.nsh
; Optional step, at the end of installation: offers to download
; ffmpeg (needed for the IPTV channels' video compatibility mode,
; itself optional and off by default). Declining or a failed download
; never prevents PiBoard's installation from completing normally.
;
; The binary comes from a DEDICATED release on PiBoard's own GitHub
; repo (not directly from BtbN/FFmpeg-Builds): a PRECISE, STABLE
; version rather than "whatever is newest", so an upstream change
; can't silently break the installer. See ATTRIBUTION.txt in that
; same release for the full provenance and license (GPLv3) detail of
; this binary. PiBoard LAUNCHES it as a separate process, never linked
; into its own code: ffmpeg's GPL license applies only to that file,
; not to the rest of the application.
; ============================================================

; URL de la release dediee (voir le depot GitHub du projet) -- a
; mettre a jour manuellement si une nouvelle version de ffmpeg est
; un jour rehebergee. URL of the dedicated release (see the project's
; GitHub repo) -- update manually if a new ffmpeg version is ever
; rehosted.
!define FFMPEG_DOWNLOAD_URL "https://github.com/jihemezes/piboard/releases/download/ffmpeg-win64-v8.1.2/ffmpeg-piboard-win64-gpl.zip"

!macro customInstall
  ; Ne propose l'installation de ffmpeg que s'il n'est pas deja
  ; present a l'emplacement que PiBoard sait retrouver -- une mise a
  ; jour de PiBoard ne doit pas re-proposer le telechargement de
  ; ~55 Mo a chaque fois. Only offers to install ffmpeg if it isn't
  ; already present at the location PiBoard knows to look for -- a
  ; PiBoard update shouldn't re-offer the ~55 MB download every time.
  ${if} ${FileExists} "$APPDATA\PiBoard\ffmpeg\ffmpeg.exe"
    Goto ffmpeg_done
  ${endIf}

  MessageBox MB_YESNO|MB_ICONQUESTION \
    "PiBoard peut installer ffmpeg (~55 Mo), necessaire uniquement si vous activez un jour le mode de compatibilite video des chaines IPTV (facultatif, desactive par defaut).$\r$\n$\r$\nInstaller ffmpeg maintenant ?$\r$\n$\r$\nPiBoard peut install ffmpeg (~55 MB), only needed if you ever enable the IPTV channels' video compatibility mode (optional, off by default).$\r$\n$\r$\nInstall ffmpeg now?" \
    IDYES ffmpeg_download
  Goto ffmpeg_done

  ffmpeg_download:
    DetailPrint "Telechargement de ffmpeg... / Downloading ffmpeg..."
    NSISdl::download "${FFMPEG_DOWNLOAD_URL}" "$TEMP\ffmpeg-piboard.zip"
    Pop $0
    ${if} $0 != "success"
      ; Echec du telechargement (pas d'internet, source injoignable...) :
      ; n'empeche JAMAIS l'installation de PiBoard de se terminer. Le
      ; mode de compatibilite video restera simplement indisponible tant
      ; que ffmpeg n'est pas installe (message clair deja affiche par
      ; PiBoard lui-meme dans ce cas, avec la commande d'installation
      ; adaptee).
      ; Download failure (no internet, source unreachable...): NEVER
      ; prevents PiBoard's own installation from completing. The video
      ; compatibility mode will simply remain unavailable until ffmpeg is
      ; installed (a clear message is already shown by PiBoard itself in
      ; that case, with the matching install command).
      DetailPrint "Echec du telechargement de ffmpeg (installation de PiBoard non affectee) / ffmpeg download failed (PiBoard's own installation unaffected): $0"
      Goto ffmpeg_done
    ${endIf}

    CreateDirectory "$APPDATA\PiBoard\ffmpeg"
    DetailPrint "Extraction de ffmpeg... / Extracting ffmpeg..."
    ; Expand-Archive : disponible nativement depuis PowerShell 5.0
    ; (Windows 10 et plus recent), pas besoin d'un plugin NSIS
    ; supplementaire pour la decompression. Expand-Archive: natively
    ; available since PowerShell 5.0 (Windows 10 and newer), no extra
    ; NSIS plugin needed for extraction.
    nsExec::ExecToLog 'powershell -NoProfile -Command "Expand-Archive -Path \'$TEMP\ffmpeg-piboard.zip\' -DestinationPath \'$TEMP\ffmpeg-piboard-extracted\' -Force"'
    Pop $0
    ${if} $0 == "0"
      CopyFiles /SILENT "$TEMP\ffmpeg-piboard-extracted\ffmpeg.exe" "$APPDATA\PiBoard\ffmpeg\ffmpeg.exe"
      CopyFiles /SILENT "$TEMP\ffmpeg-piboard-extracted\GPLv3-LICENSE.txt" "$APPDATA\PiBoard\ffmpeg\GPLv3-LICENSE.txt"
      CopyFiles /SILENT "$TEMP\ffmpeg-piboard-extracted\ATTRIBUTION.txt" "$APPDATA\PiBoard\ffmpeg\ATTRIBUTION.txt"
      DetailPrint "ffmpeg installe / ffmpeg installed."
    ${else}
      DetailPrint "Echec de l'extraction de ffmpeg (installation de PiBoard non affectee) / ffmpeg extraction failed (PiBoard's own installation unaffected)."
    ${endIf}

    ; Nettoyage des fichiers temporaires, reussite ou non.
    ; Cleanup of temporary files, whether it succeeded or not.
    Delete "$TEMP\ffmpeg-piboard.zip"
    RMDir /r "$TEMP\ffmpeg-piboard-extracted"

  ffmpeg_done:
!macroend
