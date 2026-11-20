param([Parameter(Mandatory=$true)][string]$Label, [int]$Seconds=10, [int]$RootProcessId=0)
$ErrorActionPreference='Stop'
if ($Label -notmatch '^[a-z0-9-]+$' -or $Seconds -lt 2 -or $Seconds -gt 300) { throw 'Invalid sample arguments' }
if ($RootProcessId) {
  $root = @(Get-Process -Id $RootProcessId | Where-Object { $_.Path -eq 'C:\Program Files\Reprise Nightly\reprise.exe' })
  if ($root.Count -ne 1) { throw 'Explicit PID must be the installed Reprise Nightly executable' }
} else {
  $root = @(Get-Process reprise | Where-Object { $_.MainWindowTitle -eq 'Reprise Glass QA' })
  if ($root.Count -ne 1) { throw 'Expected exactly one isolated Reprise Glass QA process' }
}
function Get-OwnedIds {
  $processes = @(Get-CimInstance Win32_Process)
  $ownedIds=@([int]$root[0].Id)
  do {
    $children = @($processes | Where-Object { $ownedIds -contains [int]$_.ParentProcessId -and $ownedIds -notcontains [int]$_.ProcessId } | ForEach-Object { [int]$_.ProcessId })
    $ownedIds += $children
  } while ($children.Count -gt 0)
  return $ownedIds
}
$ids=@(Get-OwnedIds)
$seenIds=@($ids)
$cores=[Environment]::ProcessorCount
$rows=@()
$previous=Get-Date
$previousCpu=@{}
Get-Process -Id $ids -ErrorAction SilentlyContinue | ForEach-Object { $previousCpu[[int]$_.Id]=[double]$_.CPU }
$sample=0
Get-Counter -Counter @('\GPU Engine(*)\Utilization Percentage','\GPU Process Memory(*)\Dedicated Usage','\GPU Process Memory(*)\Shared Usage') -MaxSamples $Seconds -SampleInterval 1 -ErrorAction SilentlyContinue -ErrorVariable counterErrors | ForEach-Object {
  $gpuSample=$_
  $current=Get-Date
  $ids=@(Get-OwnedIds)
  $seenIds=@($seenIds+$ids | Sort-Object -Unique)
  $owned=@(Get-Process -Id $ids -ErrorAction SilentlyContinue)
  $nextCpu=@{}; $cpuDelta=0.0; $newProcesses=0
  foreach ($process in $owned) {
    $processKey=[int]$process.Id; $processCpu=[double]$process.CPU
    $nextCpu[$processKey]=$processCpu
    if ($previousCpu.ContainsKey($processKey)) { $cpuDelta += [Math]::Max(0.0,$processCpu-$previousCpu[$processKey]) } else { $newProcesses++ }
  }
  $exitedProcesses=@($previousCpu.Keys | Where-Object { -not $nextCpu.ContainsKey($_) }).Count
  # Cooked PDH values preserve fractional utilization; integer WMI values rounded
  # this workload to zero and cannot establish that GPU work is absent.
  $invalidCounters=@($gpuSample.CounterSamples | Where-Object { $_.Status -ne 0 }).Count
  $ownedCounters=@($gpuSample.CounterSamples | Where-Object { $_.Status -eq 0 -and $_.InstanceName -match '^pid_(\d+)_' -and $ids -contains [int]$Matches[1] })
  $engines=@($ownedCounters | Where-Object { $_.Path -like '*gpu engine*' })
  $dedicatedCounters=@($ownedCounters | Where-Object { $_.Path -like '*\dedicated usage' }); $dedicated=$null; if($dedicatedCounters.Count) { $dedicated=($dedicatedCounters | Measure-Object CookedValue -Sum).Sum/1MB }
  $sharedCounters=@($ownedCounters | Where-Object { $_.Path -like '*\shared usage' }); $shared=$null; if($sharedCounters.Count) { $shared=($sharedCounters | Measure-Object CookedValue -Sum).Sum/1MB }
  $gpu=($engines | Measure-Object CookedValue -Maximum).Maximum
  $dwmIds=@(Get-Process dwm | ForEach-Object { $_.Id })
  $dwm=@($gpuSample.CounterSamples | Where-Object { $_.Status -eq 0 -and $_.Path -like '*gpu engine*' -and $_.InstanceName -match '^pid_(\d+)_' -and $dwmIds -contains [int]$Matches[1] })
  $rows += [pscustomobject]@{sample=$sample; at=$current.ToUniversalTime().ToString('o'); elapsedMs=($current-$previous).TotalMilliseconds; cpuMachinePercent=100*$cpuDelta/($current-$previous).TotalSeconds/$cores; cpuNewProcesses=$newProcesses; cpuExitedProcesses=$exitedProcesses; invalidGpuCounters=$invalidCounters; processCount=$owned.Count; gpuDedicatedMiB=$dedicated; gpuSharedMiB=$shared; privateMiB=($owned | Measure-Object PrivateMemorySize64 -Sum).Sum/1MB; busiestGpuEnginePercent=$gpu; gpuCounters=$engines.Count; sharedDwmBusiestEnginePercent=($dwm | Measure-Object CookedValue -Maximum).Maximum}
  $previous=$current; $previousCpu=$nextCpu
  $sample++
}
if (-not $rows.Count) { throw 'No PDH samples returned; no performance measurement is available' }
$report=[pscustomobject]@{label=$Label; appVersion=(Get-Item -LiteralPath $root[0].Path).VersionInfo.ProductVersion; osVersion=[Environment]::OSVersion.VersionString; counterErrorCount=@($counterErrors).Count; rootPid=$root[0].Id; processIds=$seenIds; logicalProcessors=$cores; samples=$rows; notes=@('CPU uses per-PID deltas at both endpoints; descendants refreshed every sample; private bytes summed over owned processes','Invalid PDH samples are excluded and missing values remain null; GPU is busiest owned engine from cooked PDH counters; not total GPU or GPU frame time; memory sums owned process-adapter counters','DWM is shared with other applications and cannot be attributed to Reprise','Seconds specifies sample count; actual elapsed intervals include counter query overhead; short peaks may be missed')}
New-Item -ItemType Directory -Force artifacts/glass/runtime | Out-Null
$report | ConvertTo-Json -Depth 6 | Set-Content "artifacts/glass/runtime/$Label-process.json"
$report | ConvertTo-Json -Depth 6
