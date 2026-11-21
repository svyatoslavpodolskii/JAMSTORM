Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
Name "JAMSTORM"
OutFile "${JAM_OUT}"
Icon "${JAM_ICON}"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\JAMSTORM"
SetCompressor /SOLID zlib
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\JAMSTORM.exe"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "Russian"
Var IsUpdate
Function .onInit
  StrCpy $IsUpdate "0"
  ${GetParameters} $R0
  ${GetOptions} $R0 "/UPDATE" $R1
  IfErrors done
  StrCpy $IsUpdate "1"
  ${GetOptions} $R0 "/PID=" $R2
  IfErrors done
  System::Call 'kernel32::OpenProcess(i 0x00100000, i 0, i R2) p .r3'
  StrCmp $3 0 processExited
  System::Call 'kernel32::WaitForSingleObject(p r3, i 30000) i .r4'
  System::Call 'kernel32::CloseHandle(p r3)'
  StrCmp $4 0 processExited
  Abort
  processExited:
  Sleep 350
  done:
FunctionEnd
Section
  SetOutPath "$INSTDIR"
  SetOverwrite on
  File /r "${JAM_APP}\*.*"
  FileOpen $0 "$INSTDIR\self-contained" w
  FileClose $0
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  StrCmp $IsUpdate "1" 0 done
  Exec '"$INSTDIR\JAMSTORM.exe"'
  done:
SectionEnd
Section "Uninstall"
  ; Preserve the user's profile; remove only files shipped by the installer.
  Delete "$INSTDIR\JAMSTORM.exe"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pak"
  Delete "$INSTDIR\*.bin"
  Delete "$INSTDIR\*.dat"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\LICENSE*"
  Delete "$INSTDIR\self-contained"
  Delete "$INSTDIR\version"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
