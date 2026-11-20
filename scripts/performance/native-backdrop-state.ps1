param([Parameter(Mandatory=$true)][int]$RootProcessId)
$ErrorActionPreference='Stop'
$app=Get-Process -Id $RootProcessId
if($app.Path -ne 'C:\Program Files\Reprise Nightly\reprise.exe') { throw 'Expected installed Nightly PID' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class RepriseBackdropRead {
 [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hwnd, int attribute, out int value, int size);
}
'@
$value=0
$status=[RepriseBackdropRead]::DwmGetWindowAttribute($app.MainWindowHandle,38,[ref]$value,4)
[pscustomobject]@{hresult=$status; systemBackdropType=$value} | ConvertTo-Json -Compress
