param([string]$Ffmpeg)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
if (-not $Ffmpeg) { $Ffmpeg = (& python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())").Trim() }
if (-not (Test-Path -LiteralPath $Ffmpeg)) { throw 'MP3 encoder not found' }
$taskEntries = Get-Content -LiteralPath (Join-Path $taskRoot 'references/speech-build/corpus.json') -Encoding utf8 -Raw | ConvertFrom-Json
$taskVoice = New-Object -ComObject SAPI.SpVoice
$taskVoice.Voice = $taskVoice.GetVoices('Language=409').Item(0)
$taskVoice.Rate = -1
$taskWave = Join-Path $taskRoot 'references/speech-build/working.wav'
$taskCount = 0
foreach ($entry in $taskEntries) {
  $target = Join-Path $taskRoot ('miniprogram/' + $entry.path)
  if (-not (Test-Path -LiteralPath $target)) {
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Format.Type = 22
    try {
      $stream.Open($taskWave, 3, $false)
      $taskVoice.AudioOutputStream = $stream
      [void]$taskVoice.Speak($entry.text)
    } finally { $stream.Close() }
    & $Ffmpeg -hide_banner -loglevel error -y -i $taskWave -ar 22050 -ac 1 -codec:a libmp3lame -b:a 40k -map_metadata -1 $target
    if ($LASTEXITCODE -ne 0) { throw ('Audio encoding failed: ' + $entry.id) }
  }
  $taskCount++
  if ($taskCount % 100 -eq 0) { Write-Output ('Generated ' + $taskCount + '/' + $taskEntries.Count) }
}
Write-Output ('Complete: ' + $taskVoice.Voice.GetDescription() + ', ' + $taskCount + ' clips')
