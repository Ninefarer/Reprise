; Migrate a previous per-user NSIS install into this per-machine install.
;
; Tauri 2.12.4 records currentUser installs under HKCU and perMachine installs
; under HKLM. RestorePreviousInstallLocation only reads the active registry
; context, so a perMachine installer would otherwise add a second copy in
; Program Files and leave the per-user shortcuts pointed at the old executable.
; The updater also passes /UPDATE, which skips ordinary shortcut creation.
;
; Application data is intentionally untouched. Reprise stores tasks under the
; per-user Tauri data directory for the bundle identifier, not in the install
; directory.

Var PreviousUserInstallDir

!macro NSIS_HOOK_PREINSTALL
  StrCpy $PreviousUserInstallDir ""
  ReadRegStr $R9 HKCU "Software\${MANUFACTURER}\${PRODUCTNAME}" ""
  ${If} $R9 != ""
    ${StrCase} $R8 $R9 "L"
    ${StrCase} $R7 $INSTDIR "L"
    StrCpy $R6 "\${PRODUCTNAME}"
    ${StrCase} $R6 $R6 "L"
    StrLen $R5 $R6
    StrLen $R4 $R8
    ${If} $R8 != $R7
    ${AndIf} $R4 > $R5
      IntOp $R3 $R4 - $R5
      StrCpy $R4 $R8 $R5 $R3
      ${StrLoc} $R3 $R8 ":\" ">"
      ${StrLoc} $R2 $R8 ".." ">"
      ${If} $R4 == $R6
      ${AndIf} $R3 != ""
      ${AndIf} $R2 == ""
        !insertmacro CheckIfAppIsRunning "$R9\${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
        Delete "$R9\${MAINBINARYNAME}.exe"
        Delete "$R9\uninstall.exe"
        ; Stay inside this LogicLib block. A jump past its end breaks the installer.
        StrCpy $R1 ""
        ClearErrors
        IfFileExists "$R9\${MAINBINARYNAME}.exe" per_user_exe_remains per_user_exe_gone
        per_user_exe_gone:
          StrCpy $R1 "gone"
        per_user_exe_remains:
        ${If} $R1 == "gone"
          RMDir "$R9"
          DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
          DeleteRegValue HKCU "Software\${MANUFACTURER}\${PRODUCTNAME}" ""
          DeleteRegKey /ifempty HKCU "Software\${MANUFACTURER}\${PRODUCTNAME}"
          DeleteRegKey /ifempty HKCU "Software\${MANUFACTURER}"
          ReadRegStr $R8 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
          ${If} $R8 != ""
            ${StrCase} $R7 $R8 "L"
            ${StrCase} $R6 $R9 "L"
            ${StrLoc} $R5 $R7 "$R6\${MAINBINARYNAME}.exe" ">"
            ${If} $R5 != ""
              WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\""
            ${EndIf}
          ${EndIf}
          StrCpy $PreviousUserInstallDir $R9
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro RetargetUserShortcut SHORTCUT OLDDIR
  !insertmacro IsShortcutTarget "${SHORTCUT}" "${OLDDIR}\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    !insertmacro SetShortcutTarget "${SHORTCUT}" "$INSTDIR\${MAINBINARYNAME}.exe"
  ${EndIf}
!macroend

!macro RemoveUserShortcut SHORTCUT
  !insertmacro IsShortcutTarget "${SHORTCUT}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    Delete "${SHORTCUT}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $PreviousUserInstallDir != ""
    SetShellVarContext current
    !insertmacro RetargetUserShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$PreviousUserInstallDir"
    !insertmacro RetargetUserShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$PreviousUserInstallDir"
    SetShellVarContext all
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    SetShellVarContext current
    !insertmacro RemoveUserShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    !insertmacro RemoveUserShortcut "$DESKTOP\${PRODUCTNAME}.lnk"
    SetShellVarContext all
  ${EndIf}
!macroend
