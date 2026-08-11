# Generates PWA icon PNGs for the app (no Node.js required).
Add-Type -AssemblyName System.Drawing

function New-AppIcon {
    param(
        [string]$Path,
        [int]$Size,
        [int]$PaddingPercent = 0
    )

    $bg = [System.Drawing.ColorTranslator]::FromHtml("#2E2A25")

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    if ($PaddingPercent -eq 0) {
        $g.Clear([System.Drawing.Color]::Transparent)
        $radius = [int]($Size * 0.22)
        $d = $radius * 2
        $gp = New-Object System.Drawing.Drawing2D.GraphicsPath
        $gp.AddArc(0, 0, $d, $d, 180, 90)
        $gp.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $gp.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $gp.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $gp.CloseFigure()
        $brush = New-Object System.Drawing.SolidBrush($bg)
        $g.FillPath($brush, $gp)
        $brush.Dispose()
    } else {
        $g.Clear($bg)
    }

    $boxSize = $Size * 0.30
    $gap = $Size * 0.04
    $totalW = $boxSize * 3 + $gap * 2
    $startX = ($Size - $totalW) / 2
    $y = $Size * 0.66
    $colors = @("#E993B6", "#EFE33B", "#8FB8DC")
    for ($i = 0; $i -lt 3; $i++) {
        $c = [System.Drawing.ColorTranslator]::FromHtml($colors[$i])
        $b = New-Object System.Drawing.SolidBrush($c)
        $x = $startX + $i * ($boxSize + $gap)
        $g.FillRectangle($b, [float]$x, [float]$y, [float]$boxSize, [float]$boxSize)
        $b.Dispose()
    }

    $fontSize = $Size * [double]0.40
    $font = New-Object System.Drawing.Font("Malgun Gothic", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $text = [string][char]0xC628
    $sz = $g.MeasureString($text, $font)
    $tx = ($Size - $sz.Width) / 2
    $ty = $Size * 0.12
    $g.DrawString($text, $font, $textBrush, $tx, $ty)

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $font.Dispose()
    $textBrush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

$iconRoot = "C:\Users\home\Desktop\on-hangul"
New-AppIcon -Path "$iconRoot\public\icons\icon-192.png" -Size 192
New-AppIcon -Path "$iconRoot\public\icons\icon-512.png" -Size 512
New-AppIcon -Path "$iconRoot\public\icons\icon-maskable-512.png" -Size 512 -PaddingPercent 10
New-AppIcon -Path "$iconRoot\public\apple-touch-icon.png" -Size 180
New-AppIcon -Path "$iconRoot\public\favicon.png" -Size 48

Write-Host "Icons generated."
