!include "x64.nsh"

!macro customInstall
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /IM PopDroidCam.exe /T /F'
  Pop $0
  ${DisableX64FSRedirection}
  nsExec::ExecToLog '"$SYSDIR\regsvr32.exe" /s "$INSTDIR\resources\native-vcam\PopDroidCamVirtualCameraSource.dll"'
  Pop $1
  ${EnableX64FSRedirection}
  ${If} $1 != 0
    MessageBox MB_ICONSTOP "Could not register the PopDroidCam virtual camera (regsvr32 exit code $1)."
    Abort
  ${EndIf}

  nsExec::ExecToLog '"$INSTDIR\resources\native-vcam\PopDroidCamCameraRegistrar.exe" register'
  Pop $1
  ${If} $1 != 0
    ${DisableX64FSRedirection}
    nsExec::ExecToLog '"$SYSDIR\regsvr32.exe" /u /s "$INSTDIR\resources\native-vcam\PopDroidCamVirtualCameraSource.dll"'
    Pop $2
    ${EnableX64FSRedirection}
    MessageBox MB_ICONSTOP "Could not create the PopDroidCam camera device (exit code $1)."
    Abort
  ${EndIf}

  CreateDirectory "$LOCALAPPDATA\Microsoft\WindowsApps"
  FileOpen $0 "$LOCALAPPDATA\Microsoft\WindowsApps\popdroidcam.cmd" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "set ELECTRON_RUN_AS_NODE=1$\r$\n"
  FileWrite $0 '"$INSTDIR\PopDroidCam.exe" "$INSTDIR\resources\app.asar\dist\cli.js" %*$\r$\n'
  FileClose $0
!macroend

!macro customUnInstall
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /IM PopDroidCam.exe /T /F'
  Pop $0
  nsExec::ExecToLog '"$INSTDIR\resources\native-vcam\PopDroidCamCameraRegistrar.exe" remove'
  Pop $1
  ${If} $1 != 0
    MessageBox MB_ICONSTOP "Could not remove the PopDroidCam camera device (exit code $1). Close camera apps and try again."
    Abort
  ${EndIf}
  ${DisableX64FSRedirection}
  nsExec::ExecToLog '"$SYSDIR\regsvr32.exe" /u /s "$INSTDIR\resources\native-vcam\PopDroidCamVirtualCameraSource.dll"'
  Pop $1
  ${EnableX64FSRedirection}
  ${If} $1 != 0
    MessageBox MB_ICONSTOP "Could not unregister the PopDroidCam camera source (exit code $1)."
    Abort
  ${EndIf}
  Delete "$LOCALAPPDATA\Microsoft\WindowsApps\popdroidcam.cmd"
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c del /q "%PUBLIC%\PopDroidCam\virtual-camera-frame.dat" 2>nul'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c rmdir "%PUBLIC%\PopDroidCam" 2>nul'
  Pop $0
!macroend
