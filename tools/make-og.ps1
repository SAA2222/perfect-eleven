# Generates og.png (1200x630) — static Open Graph image.
# Mirrors the api/og.js SVG design. Run: powershell -File tools\make-og.ps1
Add-Type -AssemblyName System.Drawing

$W = 1200; $H = 630
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

# Background gradient #0c1410 -> #06090a
$rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $rect,
  [System.Drawing.Color]::FromArgb(255, 0x0c, 0x14, 0x10),
  [System.Drawing.Color]::FromArgb(255, 0x06, 0x09, 0x0a),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillRectangle($bgBrush, $rect)

# Grid (rgba(0,200,83,0.07) every 48px)
$gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(18, 0, 200, 83), 1)
for ($x = 0; $x -le $W; $x += 48) { $g.DrawLine($gridPen, $x, 0, $x, $H) }
for ($y = 0; $y -le $H; $y += 48) { $g.DrawLine($gridPen, 0, $y, $W, $y) }

# Pitch circle + halfway line (rgba(0,200,83,0.18), width 3)
$pitchPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 0, 200, 83), 3)
$g.DrawEllipse($pitchPen, 900 - 180, 315 - 180, 360, 360)
$g.DrawLine($pitchPen, 900, 135, 900, 495)

# Colors / fonts
$green  = [System.Drawing.Color]::FromArgb(255, 0x00, 0xc8, 0x53)
$ink    = [System.Drawing.Color]::FromArgb(255, 0x0c, 0x14, 0x10)
$white  = [System.Drawing.Color]::White
$grey   = [System.Drawing.Color]::FromArgb(255, 0x7a, 0x85, 0x90)
$gold   = [System.Drawing.Color]::FromArgb(255, 0xff, 0xc4, 0x00)
$px = [System.Drawing.GraphicsUnit]::Pixel
$impact64 = New-Object System.Drawing.Font('Impact', 64, [System.Drawing.FontStyle]::Regular, $px)
$impact56 = New-Object System.Drawing.Font('Impact', 56, [System.Drawing.FontStyle]::Regular, $px)
$impact84 = New-Object System.Drawing.Font('Impact', 84, [System.Drawing.FontStyle]::Regular, $px)
$mono18   = New-Object System.Drawing.Font('Consolas', 18, [System.Drawing.FontStyle]::Bold, $px)
$mono22   = New-Object System.Drawing.Font('Consolas', 22, [System.Drawing.FontStyle]::Bold, $px)
$mono20   = New-Object System.Drawing.Font('Consolas', 20, [System.Drawing.FontStyle]::Bold, $px)

function BrushOf($c) { New-Object System.Drawing.SolidBrush($c) }

# "11" mark
$g.FillRectangle((BrushOf $green), 80, 80, 96, 96)
$fmtC = New-Object System.Drawing.StringFormat
$fmtC.Alignment = 'Center'; $fmtC.LineAlignment = 'Center'
$g.DrawString('11', $impact64, (BrushOf $ink), (New-Object System.Drawing.RectangleF(80, 80, 96, 96)), $fmtC)

# Brand
$g.DrawString('PERFECT ELEVEN', $impact56, (BrushOf $white), 196, 88)
$g.DrawString('/ 2026 WORLD CUP', $mono18, (BrushOf $grey), 202, 158)

# Headline + subline
$g.DrawString('BUILD YOUR PERFECT XI', $impact84, (BrushOf $white), 74, 290)
$dot = [string][char]0x00B7
$g.DrawString(('4 8  O F F I C I A L  S Q U A D S   ' + $dot + '   2 0 2 6  W O R L D  C U P'), $mono22, (BrushOf $green), 80, 406)

# Footer
$g.DrawString('PERFECT-ELEVEN.VERCEL.APP', $mono20, (BrushOf $grey), 80, 540)
$fmtR = New-Object System.Drawing.StringFormat
$fmtR.Alignment = 'Far'
$g.DrawString([char]0x25B6 + ' PLAY FREE', $mono20, (BrushOf $gold), (New-Object System.Drawing.RectangleF(700, 540, 420, 30)), $fmtR)

$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'og.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Wrote $out ($([math]::Round((Get-Item $out).Length/1kb)) KB)"
