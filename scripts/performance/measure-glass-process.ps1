param([Parameter(Mandatory=$true)][string]$Label, [int]$Seconds=10, [int]$RootProcessId=0)
$ErrorActionPreference='Stop'
if ($Label -notmatch '^[a-z0-9-]+$' -or $Seconds -lt 2 -or $Seconds -gt 30) { throw 'Invalid sample arguments' }
if ($RootProcessId) {
  $root = @(Get-Process -Id $RootProcessId | Where-Object { $_.Path -eq 'C:\Program Files\Reprise Nightly\reprise.exe' })
  if ($root.Count -ne 1) { throw 'Explicit PID must be the installed Reprise Nightly executable' }
} else {
  $root = @(Get-Process reprise | Where-Object { $_.MainWindowTitle -eq 'Reprise Glass QA' })
  if ($root.Count -ne 1) { throw 'Expected exactly one isolated Reprise Glass QA process' }
}
$processes = @(Get-CimInstance Win32_Process)
$ids = @([int]$root[0].Id)
do {
  $children = @($processes | Where-Object { $ids -contains [int]$_.ParentProcessId -and $ids -notcontains [int]$_.ProcessId } | ForEach-Object { [int]$_.ProcessId })
  $ids += $children
} while ($children.Count -gt 0)
$cores=[Environment]::ProcessorCount
$rows=@()
$previous=Get-Date
$previousCpu=(@(Get-Process -Id $ids -ErrorAction SilentlyContinue) | Measure-Object CPU -Sum).Sum
$sample=0
Get-Counter -Counter '\GPU Engine(*)\Utilization Percentage' -MaxSamples $Seconds -SampleInterval 1 | ForEach-Object {
  $gpuSample=$_
  $current=Get-Date
  $owned=@(Get-Process -Id $ids -ErrorAction SilentlyContinue)
  $cpu=($owned | Measure-Object CPU -Sum).Sum
  # Cooked PDH values preserve fractional utilization; integer WMI values rounded
  # this workload to zero and cannot establish that GPU work is absent.
  $engines=@($gpuSample.CounterSamples | Where-Object { $_.InstanceName -match '^pid_(\d+)_' -and $ids -contains [int]$Matches[1] })
  $gpu=($engines | Measure-Object CookedValue -Maximum).Maximum
  $dwmIds=@(Get-Process dwm | ForEach-Object { $_.Id })
  $dwm=@($gpuSample.CounterSamples | Where-Object { $_.InstanceName -match '^pid_(\d+)_' -and $dwmIds -contains [int]$Matches[1] })
  $rows += [pscustomobject]@{sample=$sample; at=$current.ToUniversalTime().ToString('o'); elapsedMs=($current-$previous).TotalMilliseconds; cpuMachinePercent=100*($cpu-$previousCpu)/($current-$previous).TotalSeconds/$cores; privateMiB=($owned | Measure-Object PrivateMemorySize64 -Sum).Sum/1MB; busiestGpuEnginePercent=$gpu; gpuCounters=$engines.Count; sharedDwmBusiestEnginePercent=($dwm | Measure-Object CookedValue -Maximum).Maximum}
  $previous=$current; $previousCpu=$cpu
  $sample++
}
$report=[pscustomobject]@{label=$Label; rootPid=$root[0].Id; processIds=$ids; logicalProcessors=$cores; samples=$rows; notes=@('CPU normalized to whole-machine capacity; private bytes summed over process tree','GPU is busiest owned engine from cooked PDH counters; not total GPU','DWM is shared with other applications and cannot be attributed to Reprise','Seconds specifies sample count; actual elapsed intervals include counter query overhead; short peaks may be missed')}
New-Item -ItemType Directory -Force artifacts/glass/runtime | Out-Null
$report | ConvertTo-Json -Depth 6 | Set-Content "artifacts/glass/runtime/$Label-process.json"
$report | ConvertTo-Json -Depth 6
