Unicode true
!include "FileFunc.nsh"
Name "JAMSTORM"
Icon "${JAM_ICON}"
OutFile "${JAM_OUT}"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow
SetCompressor /SOLID zlib
VIProductVersion "0.5.0.0"
VIAddVersionKey /LANG=1033 "ProductName" "JAMSTORM"
VIAddVersionKey /LANG=1033 "FileDescription" "YouTube Music desktop companion"
VIAddVersionKey /LANG=1033 "FileVersion" "0.5.0"
VIAddVersionKey /LANG=1033 "LegalCopyright" "Jam Desktop contributors"

Section
  InitPluginsDir
  ; Use Windows' short alias where available. The launch path must also be
  ; quoted because the executable name contains a space.
  GetFullPathName /SHORT $R1 "$PLUGINSDIR"
  StrCpy $INSTDIR "$R1\jam"
  SetOutPath "$INSTDIR"
  File /r "${JAM_APP}\*.*"
  ${GetParameters} $R0
  ClearErrors
  ExecWait '"$INSTDIR\JAMSTORM.exe" $R0' $0
  IfErrors launchFailed
  SetErrorLevel $0
  Goto cleanup
  launchFailed:
    SetErrorLevel 1
  cleanup:
    ; This is only the app subdirectory of NSIS's unique plugin temp directory.
    SetOutPath "$EXEDIR"
    RMDir /r "$INSTDIR"
SectionEnd
