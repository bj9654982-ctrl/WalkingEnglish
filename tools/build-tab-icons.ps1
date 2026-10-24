$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '../miniprogram/assets/tabs'
[System.IO.Directory]::CreateDirectory($iconRoot) | Out-Null
foreach ($iconName in @('words','reading','practice','discover','profile')) {
  foreach ($selected in @($false,$true)) {
    $bitmap = New-Object System.Drawing.Bitmap(64,64)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $colorHex = if ($selected) { '#365b48' } else { '#849080' }
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($colorHex),3.6)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    switch ($iconName) {
      'words' { $graphics.DrawRectangle($pen,16,12,33,40); $graphics.DrawLine($pen,23,12,23,52); $graphics.DrawLine($pen,29,24,42,24); $graphics.DrawLine($pen,29,33,40,33) }
      'reading' { $graphics.DrawLines($pen,[System.Drawing.Point[]]@((New-Object System.Drawing.Point(10,16)),(New-Object System.Drawing.Point(21,14)),(New-Object System.Drawing.Point(32,20)),(New-Object System.Drawing.Point(43,14)),(New-Object System.Drawing.Point(54,16)),(New-Object System.Drawing.Point(54,48)),(New-Object System.Drawing.Point(43,46)),(New-Object System.Drawing.Point(32,52)),(New-Object System.Drawing.Point(21,46)),(New-Object System.Drawing.Point(10,48)),(New-Object System.Drawing.Point(10,16)))); $graphics.DrawLine($pen,32,20,32,52) }
      'practice' { $graphics.DrawRectangle($pen,15,13,34,40); $graphics.DrawLine($pen,24,12,40,12); $graphics.DrawLines($pen,[System.Drawing.Point[]]@((New-Object System.Drawing.Point(23,34)),(New-Object System.Drawing.Point(30,41)),(New-Object System.Drawing.Point(42,27)))) }
      'discover' { $graphics.DrawLines($pen,[System.Drawing.Point[]]@((New-Object System.Drawing.Point(7,50)),(New-Object System.Drawing.Point(26,17)),(New-Object System.Drawing.Point(38,38)),(New-Object System.Drawing.Point(46,25)),(New-Object System.Drawing.Point(58,50)),(New-Object System.Drawing.Point(7,50)))); $graphics.DrawEllipse($pen,43,9,8,8) }
      'profile' { $graphics.DrawEllipse($pen,23,10,18,18); $graphics.DrawArc($pen,13,34,38,34,180,180); $graphics.DrawLine($pen,13,51,51,51) }
    }
    $suffix = if ($selected) { '-on' } else { '' }
    $bitmap.Save((Join-Path $iconRoot ($iconName + $suffix + '.png')),[System.Drawing.Imaging.ImageFormat]::Png)
    $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
  }
}
Write-Output 'Generated 10 tab icons.'
