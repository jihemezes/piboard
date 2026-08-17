; ============================================================
; PiBoard - build/installer.nsh
; Page optionnelle, apres le choix du dossier d'installation : propose
; d'installer ffmpeg et/ou VLC (necessaires au mode de compatibilite
; video des chaines IPTV en direct, lui-meme facultatif et desactive
; par defaut). Deux VRAIES CASES A COCHER, decochees par defaut --
; PAS une fenetre modale Oui/Non qui redemanderait a chaque
; reinstallation tant qu'on repond Non (signale par l'utilisateur :
; "j'en ai assez de repondre non a l'installation ffmpeg"). Ici, ne
; rien cocher fait simplement passer a la page suivante, sans jamais
; redemander bruyamment.
;
; La page entiere est sautee si les deux outils sont deja presents --
; une mise a jour de PiBoard ne doit pas re-proposer ces
; telechargements a chaque fois. Si un seul des deux manque, seule sa
; case s'affiche (positionnement dynamique).
;
; Refuser ou echouer au telechargement n'empeche JAMAIS l'installation
; de PiBoard elle-meme de se terminer normalement.
;
; Les deux binaires viennent de releases DEDIEES sur le depot GitHub
; de PiBoard (pas directement des sources amont) : des versions
; PRECISES et STABLES plutot que "la derniere en date", pour eviter
; qu'un changement en amont ne casse silencieusement l'installateur.
; Voir ATTRIBUTION.txt dans chaque release pour le detail complet de
; la provenance et de la licence (GPL) de ces binaires. PiBoard les
; LANCE comme des processus separes, jamais lies dans son propre
; code : leur licence GPL ne s'applique qu'a ces fichiers, pas au
; reste de l'application.
;
; ============================================================
; PiBoard - build/installer.nsh
; Optional page, after choosing the install folder: offers to install
; ffmpeg and/or VLC (needed for the IPTV live channels' video
; compatibility mode, itself optional and off by default). Two REAL
; CHECKBOXES, unchecked by default -- NOT a Yes/No modal dialog that
; would keep re-asking on every reinstall as long as the answer is No
; (reported by the user: "I'm tired of answering no to the ffmpeg
; install"). Here, checking nothing simply moves to the next page,
; never noisily asking again.
;
; The whole page is skipped if both tools are already present -- a
; PiBoard update shouldn't re-offer these downloads every time. If
; only one is missing, only its checkbox shows (dynamic positioning).
;
; Declining or a failed download NEVER prevents PiBoard's own
; installation from completing normally.
;
; Both binaries come from DEDICATED releases on PiBoard's own GitHub
; repo (not directly from upstream sources): PRECISE, STABLE versions
; rather than "whatever is newest", so an upstream change can't
; silently break the installer. See ATTRIBUTION.txt in each release
; for the full provenance and license (GPL) detail of these binaries.
; PiBoard LAUNCHES them as separate processes, never linked into its
; own code: their GPL license applies only to those files, not to the
; rest of the application.
; ============================================================

!include nsDialogs.nsh
!include LogicLib.nsh

; URLs des releases dediees (voir le depot GitHub du projet) -- a
; mettre a jour manuellement si une nouvelle version est un jour
; rehebergee. URLs of the dedicated releases (see the project's GitHub
; repo) -- update manually if a new version is ever rehosted.
!define FFMPEG_DOWNLOAD_URL "https://github.com/jihemezes/piboard/releases/download/ffmpeg-win64-v8.1.2/ffmpeg-piboard-win64-gpl.zip"
!define VLC_DOWNLOAD_URL "https://github.com/jihemezes/piboard/releases/download/vlc-win64-v3.0.20/vlc-piboard-win64.zip"

; Tout ce qui suit (variables, macro, ET fonctions) est enveloppe dans
; !ifndef BUILD_UNINSTALLER -- meme raisonnement que pour les
; fonctions ci-dessous : sans ce garde-fou etendu aux variables, la
; passe de compilation du desinstalleur les declare sans jamais les
; utiliser (les fonctions qui les utilisent etant elles-memes
; desormais conditionnelles), causant un second type d'avertissement
; ("Variable non referencee") -- reproduit et corrige directement avec
; makensis.
; Everything below (variables, macro, AND functions) is wrapped in
; !ifndef BUILD_UNINSTALLER -- same reasoning as for the functions
; below: without this guard extended to the variables, the uninstaller
; compile pass declares them without ever using them (the functions
; that use them being themselves now conditional), causing a second
; kind of warning ("Variable not referenced") -- reproduced and fixed
; directly with makensis.
!ifndef BUILD_UNINSTALLER

Var OptDlg
Var CheckFfmpeg
Var CheckVlc
Var NeedFfmpeg
Var NeedVlc

; Tout ce qui suit (macro ET fonctions) beneficie de la meme
; protection : sans elle, la declaration de page est absente pendant
; la passe de compilation du desinstalleur (ou BUILD_UNINSTALLER est
; defini) tandis que les fonctions, elles, restaient compilees sans
; condition, causant "fonction non referencee" (reproduit et confirme
; directement avec makensis).
; Everything below (macro AND functions) benefits from the same
; guard: without it, the page declaration is absent during the
; uninstaller compile pass (where BUILD_UNINSTALLER is defined) while
; the functions themselves stayed compiled unconditionally, causing
; "function not referenced" (reproduced and confirmed directly with
; makensis).

!macro customPageAfterChangeDir
  Page custom OptDownloadsPageCreate OptDownloadsPageLeave
!macroend

Function OptDownloadsPageCreate
  StrCpy $NeedFfmpeg "0"
  StrCpy $NeedVlc "0"
  ${IfNot} ${FileExists} "$APPDATA\PiBoard\ffmpeg\ffmpeg.exe"
    StrCpy $NeedFfmpeg "1"
  ${EndIf}
  ${IfNot} ${FileExists} "$APPDATA\PiBoard\vlc\vlc.exe"
    StrCpy $NeedVlc "1"
  ${EndIf}

  ; Les deux sont deja presents : rien a proposer, page entierement
  ; sautee (Abort dans un callback Create est la maniere standard NSIS
  ; de sauter une page). Both already present: nothing to offer, page
  ; entirely skipped (Abort in a Create callback is the standard NSIS
  ; way to skip a page).
  ${If} $NeedFfmpeg == "0"
  ${AndIf} $NeedVlc == "0"
    Abort
  ${EndIf}

  nsDialogs::Create 1018
  Pop $OptDlg
  ${If} $OptDlg == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 32u "PiBoard peut installer ces composants facultatifs, necessaires uniquement pour le mode de compatibilite video des chaines IPTV en direct (facultatif, desactive par defaut). Rien cocher ne change rien : ces composants pourront etre installes plus tard.$\r$\n$\r$\nPiBoard can install these optional components, only needed for the IPTV live channels' video compatibility mode (optional, off by default). Checking nothing changes nothing: these components can still be installed later."
  Pop $0

  ; Positions FIXES selon la combinaison exacte (3 cas possibles, le
  ; 4eme -- aucun des deux necessaire -- est deja ecarte par l'Abort
  ; ci-dessus) : plus simple et fiable qu'une variable d'execution
  ; concatenee a un suffixe d'unite, syntaxe non supportee par
  ; NSD_CreateCheckbox. FIXED positions for the exact combination (3
  ; possible cases, the 4th -- neither needed -- is already ruled out
  ; by the Abort above): simpler and more reliable than a runtime
  ; variable concatenated with a unit suffix, a syntax not supported by
  ; NSD_CreateCheckbox.
  ${If} $NeedFfmpeg == "1"
  ${AndIf} $NeedVlc == "1"
    ${NSD_CreateCheckbox} 0 40u 100% 12u "Installer ffmpeg (~55 Mo) / Install ffmpeg (~55 MB)"
    Pop $CheckFfmpeg
    ${NSD_CreateCheckbox} 0 56u 100% 12u "Installer VLC (~80 Mo) / Install VLC (~80 MB)"
    Pop $CheckVlc
  ${ElseIf} $NeedFfmpeg == "1"
    ${NSD_CreateCheckbox} 0 40u 100% 12u "Installer ffmpeg (~55 Mo) / Install ffmpeg (~55 MB)"
    Pop $CheckFfmpeg
  ${Else}
    ${NSD_CreateCheckbox} 0 40u 100% 12u "Installer VLC (~80 Mo) / Install VLC (~80 MB)"
    Pop $CheckVlc
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function OptDownloadsPageLeave
  ${If} $NeedFfmpeg == "1"
    ${NSD_GetState} $CheckFfmpeg $0
    ${If} $0 == ${BST_CHECKED}
      Call InstallFfmpeg
    ${EndIf}
  ${EndIf}

  ${If} $NeedVlc == "1"
    ${NSD_GetState} $CheckVlc $0
    ${If} $0 == ${BST_CHECKED}
      Call InstallVlc
    ${EndIf}
  ${EndIf}
FunctionEnd

Function InstallFfmpeg
  DetailPrint "Telechargement de ffmpeg... / Downloading ffmpeg..."
  ; inetc (pas NSISdl) : NSISdl telecharge TOUJOURS en HTTP, meme pour
  ; une URL https://, et echoue par delai depasse des lors que le lien
  ; redirige de HTTP vers HTTPS (comportement documente du plugin) --
  ; exactement le cas d'un lien de release GitHub (redirection vers le
  ; CDN de stockage des binaires). C'est la cause identifiee du bug :
  ; "case cochee mais ffmpeg absent", sans le moindre message d'erreur
  ; visible puisque le seul signal (DetailPrint) n'est jamais consulte
  ; en usage normal. inetc utilise WinINet (le meme moteur reseau que
  ; Windows/Internet Explorer), qui gere HTTPS et les redirections
  ; correctement -- c'est aussi le plugin qu'electron-builder utilise
  ; lui-meme pour sa propre fonctionnalite d'installateur web.
  ; inetc (not NSISdl): NSISdl ALWAYS downloads over HTTP, even for an
  ; https:// URL, and fails with a timeout as soon as the link
  ; redirects from HTTP to HTTPS (documented plugin behavior) --
  ; exactly the case for a GitHub release link (redirects to the
  ; binary storage CDN). This is the identified cause of the bug: "box
  ; checked but ffmpeg missing", with no visible error message at all
  ; since the only signal (DetailPrint) is never consulted in normal
  ; use. inetc uses WinINet (the same network engine as Windows/
  ; Internet Explorer), which handles HTTPS and redirects correctly --
  ; it's also the plugin electron-builder itself uses for its own web
  ; installer feature.
  !ifndef BUILD_UNINSTALLER
	  DetailPrint "Telechargement de ffmpeg / Downloading ffmpeg..."
	  nsExec::ExecToLog '"$SYSDIR\curl.exe" -L --fail --show-error --retry 2 -o "$PLUGINSDIR\ffmpeg.zip" "https://github.com/jihemezes/piboard/releases/download/ffmpeg-win64-v8.1.2/ffmpeg-piboard-win64-gpl.zip"'
	  Pop $0
	  ${If} $0 != 0
		DetailPrint "Echec du telechargement ffmpeg (code $0) / ffmpeg download failed (code $0)"
	  ${EndIf}
	!endif
  !ifndef BUILD_UNINSTALLER
	  DetailPrint "Telechargement de VLC / Downloading VLC..."
	  nsExec::ExecToLog '"$SYSDIR\curl.exe" -L --fail --show-error --retry 2 -o "$PLUGINSDIR\vlc.zip" "https://github.com/jihemezes/piboard/releases/download/vlc-win64-v3.0.20/vlc-piboard-win64.zip"'
	  Pop $0
	  ${If} $0 != 0
		DetailPrint "Echec du telechargement VLC (code $0) / VLC download failed (code $0)"
	  ${EndIf}
	!endif
    ; Echec du telechargement (pas d'internet, source injoignable...) :
    ; n'empeche JAMAIS l'installation de PiBoard de se terminer. Le
    ; mode de compatibilite video restera simplement indisponible tant
    ; que ffmpeg n'est pas installe (message clair deja affiche par
    ; PiBoard lui-meme dans ce cas, avec la commande d'installation
    ; adaptee). Download failure (no internet, source unreachable...):
    ; NEVER prevents PiBoard's own installation from completing. The
    ; video compatibility mode will simply remain unavailable until
    ; ffmpeg is installed (a clear message is already shown by PiBoard
    ; itself in that case, with the matching install command).
    DetailPrint "Echec du telechargement de ffmpeg (installation de PiBoard non affectee) / ffmpeg download failed (PiBoard's own installation unaffected): $0"
    Return
  ${EndIf}

  CreateDirectory "$APPDATA\PiBoard\ffmpeg"
  DetailPrint "Extraction de ffmpeg... / Extracting ffmpeg..."
  ; Expand-Archive : disponible nativement depuis PowerShell 5.0
  ; (Windows 10 et plus recent), pas besoin d'un plugin NSIS
  ; supplementaire pour la decompression. Expand-Archive: natively
  ; available since PowerShell 5.0 (Windows 10 and newer), no extra
  ; NSIS plugin needed for extraction.
  nsExec::ExecToLog 'powershell -NoProfile -WindowStyle Hidden -Command "Expand-Archive -Path \"$TEMP\ffmpeg-piboard.zip\" -DestinationPath \"$TEMP\ffmpeg-piboard-extracted\" -Force"'
  Pop $0
  ${If} $0 == "0"
    CopyFiles /SILENT "$TEMP\ffmpeg-piboard-extracted\ffmpeg.exe" "$APPDATA\PiBoard\ffmpeg\ffmpeg.exe"
    CopyFiles /SILENT "$TEMP\ffmpeg-piboard-extracted\GPLv3-LICENSE.txt" "$APPDATA\PiBoard\ffmpeg\GPLv3-LICENSE.txt"
    CopyFiles /SILENT "$TEMP\ffmpeg-piboard-extracted\ATTRIBUTION.txt" "$APPDATA\PiBoard\ffmpeg\ATTRIBUTION.txt"
    ; Verification a posteriori : CopyFiles /SILENT n'interrompt pas le
    ; script en cas d'echec silencieux (chemin source inattendu,
    ; permissions...). Sans ce controle, un probleme a cette etape
    ; passerait tout aussi inapercu que le bug initial. Post-copy
    ; verification: CopyFiles /SILENT doesn't halt the script on a
    ; silent failure (unexpected source path, permissions...). Without
    ; this check, a problem at this step would go just as unnoticed as
    ; the original bug.
    ${If} ${FileExists} "$APPDATA\PiBoard\ffmpeg\ffmpeg.exe"
      DetailPrint "ffmpeg installe / ffmpeg installed."
    ${Else}
      DetailPrint "Echec de la copie de ffmpeg apres extraction (installation de PiBoard non affectee) / ffmpeg copy failed after extraction (PiBoard's own installation unaffected)."
    ${EndIf}
  ${Else}
    DetailPrint "Echec de l'extraction de ffmpeg (installation de PiBoard non affectee) / ffmpeg extraction failed (PiBoard's own installation unaffected)."
  ${EndIf}

  ; Nettoyage des fichiers temporaires, reussite ou non.
  ; Cleanup of temporary files, whether it succeeded or not.
  Delete "$TEMP\ffmpeg-piboard.zip"
  RMDir /r "$TEMP\ffmpeg-piboard-extracted"
FunctionEnd

Function InstallVlc
  DetailPrint "Telechargement de VLC... / Downloading VLC..."
  ; inetc, meme raison que pour ffmpeg ci-dessus (NSISdl echoue sur les
  ; liens https:// avec redirection, comme un lien de release GitHub).
  ; inetc, same reason as ffmpeg above (NSISdl fails on https:// links
  ; with a redirect, like a GitHub release link).
  inetc::get /TIMEOUT=60000 "${VLC_DOWNLOAD_URL}" "$TEMP\vlc-piboard.zip" /END
  Pop $0
  ${If} $0 != "OK"
    ; Meme principe que pour ffmpeg : un echec ici n'affecte jamais
    ; l'installation de PiBoard lui-meme. Same principle as ffmpeg: a
    ; failure here never affects PiBoard's own installation.
    DetailPrint "Echec du telechargement de VLC (installation de PiBoard non affectee) / VLC download failed (PiBoard's own installation unaffected): $0"
    Return
  ${EndIf}

  CreateDirectory "$APPDATA\PiBoard\vlc"
  DetailPrint "Extraction de VLC... / Extracting VLC..."
  nsExec::ExecToLog 'powershell -NoProfile -WindowStyle Hidden -Command "Expand-Archive -Path \"$TEMP\vlc-piboard.zip\" -DestinationPath \"$TEMP\vlc-piboard-extracted\" -Force"'
  Pop $0
  ${If} $0 == "0"
    ; VLC, contrairement a ffmpeg, n'est PAS un executable autonome :
    ; il depend de son dossier "plugins" et de plusieurs DLL pour
    ; fonctionner. Le contenu COMPLET du dossier extrait est donc
    ; copie, pas seulement vlc.exe. VLC, unlike ffmpeg, is NOT a
    ; standalone executable: it depends on its "plugins" folder and
    ; several DLLs to function. The FULL content of the extracted
    ; folder is therefore copied, not just vlc.exe.
    CopyFiles /SILENT "$TEMP\vlc-piboard-extracted\*.*" "$APPDATA\PiBoard\vlc\"
    ${If} ${FileExists} "$APPDATA\PiBoard\vlc\vlc.exe"
      DetailPrint "VLC installe / VLC installed."
    ${Else}
      DetailPrint "Echec de la copie de VLC apres extraction (installation de PiBoard non affectee) / VLC copy failed after extraction (PiBoard's own installation unaffected)."
    ${EndIf}
  ${Else}
    DetailPrint "Echec de l'extraction de VLC (installation de PiBoard non affectee) / VLC extraction failed (PiBoard's own installation unaffected)."
  ${EndIf}

  Delete "$TEMP\vlc-piboard.zip"
  RMDir /r "$TEMP\vlc-piboard-extracted"
FunctionEnd

!endif ; BUILD_UNINSTALLER
