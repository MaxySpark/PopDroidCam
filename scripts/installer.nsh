!macro customInstall
  CreateDirectory "$LOCALAPPDATA\Microsoft\WindowsApps"
  FileOpen $0 "$LOCALAPPDATA\Microsoft\WindowsApps\popdroidcam.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "set ELECTRON_RUN_AS_NODE=1$\r$\n"
  FileWrite $0 '"$INSTDIR\PopDroidCam.exe" "$INSTDIR\resources\app.asar\dist\cli.js" %*$\r$\n'
  FileClose $0
!macroend

!macro customUnInstall
  Delete "$LOCALAPPDATA\Microsoft\WindowsApps\popdroidcam.cmd"
!macroend
