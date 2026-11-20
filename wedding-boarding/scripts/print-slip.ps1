# Prints one boarding slip on a Windows receipt printer (the POS58 at the door).
#
# Called by src/lib/printer.ts. The slip layout is decided there and passed in
# as base64-encoded UTF-8 JSON, so no guest text is ever spliced into a
# command line. Drawing goes through the Windows driver with System.Drawing
# rather than raw ESC/POS, so Thai names render with a Windows font instead of
# depending on the printer's built-in code pages.
#
# Payload: { "lines": [ { "type": "text", "text": "...", "size": 9, "bold": false, "align": "center" }
#                     | { "type": "row", "label": "...", "value": "..." }
#                     | { "type": "image", "path": "C:\\...\\photos\\{token}-print.png" }
#                     | { "type": "rule" } | { "type": "space" } ] }

param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$PayloadBase64
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64))
$script:slip = $json | ConvertFrom-Json

$doc = New-Object System.Drawing.Printing.PrintDocument
$doc.PrinterSettings.PrinterName = $PrinterName
if (-not $doc.PrinterSettings.IsValid) { throw "Printer '$PrinterName' is not installed" }
$doc.DocumentName = 'Boarding slip'
# Suppress the "Printing page 1..." dialog a GUI-less server would otherwise try to show.
$doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

$installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
$script:family = if ($installed -contains 'Leelawadee UI') { 'Leelawadee UI' } else { 'Tahoma' }

$doc.add_PrintPage({
  param($sender, $e)
  $g = $e.Graphics
  # Crisp 1-bit text — a thermal head can't print grey anti-aliasing.
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
  $w = [single]$e.PageSettings.PrintableArea.Width
  $y = [single]0
  $black = [System.Drawing.Brushes]::Black

  foreach ($line in $script:slip.lines) {
    switch ($line.type) {
      'space' { $y += 6 }
      'image' {
        # A 384 px, already-dithered PNG — drawn at the full printable width
        # (48 mm = 384 dots on the POS58), nearest-neighbour so the dither
        # dots land 1:1 on the head instead of being smeared into grey.
        if (Test-Path -LiteralPath $line.path) {
          $img = [System.Drawing.Image]::FromFile($line.path)
          $h = [single]($img.Height * $w / $img.Width)
          $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
          $g.DrawImage($img, (New-Object System.Drawing.RectangleF 0, $y, $w, $h))
          $y += $h
          $img.Dispose()
        }
      }
      'rule' {
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::Black), 1
        $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
        $y += 4
        $g.DrawLine($pen, 0, $y, $w, $y)
        $y += 5
        $pen.Dispose()
      }
      'row' {
        $font = New-Object System.Drawing.Font $script:family, 9
        $bold = New-Object System.Drawing.Font $script:family, 9, ([System.Drawing.FontStyle]::Bold)
        $left = New-Object System.Drawing.StringFormat
        $right = New-Object System.Drawing.StringFormat
        $right.Alignment = [System.Drawing.StringAlignment]::Far
        $labelW = [single]($w * 0.4)
        $h = [Math]::Max(
          $g.MeasureString($line.label, $font, [int]$labelW).Height,
          $g.MeasureString($line.value, $bold, [int]($w - $labelW)).Height)
        $g.DrawString($line.label, $font, $black, (New-Object System.Drawing.RectangleF 0, $y, $labelW, $h), $left)
        $g.DrawString($line.value, $bold, $black, (New-Object System.Drawing.RectangleF $labelW, $y, ($w - $labelW), $h), $right)
        $y += $h + 1
        $font.Dispose(); $bold.Dispose()
      }
      default {
        $style = if ($line.bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $size = if ($line.size) { [single]$line.size } else { [single]9 }
        $font = New-Object System.Drawing.Font $script:family, $size, $style
        $fmt = New-Object System.Drawing.StringFormat
        $fmt.Alignment = switch ($line.align) {
          'left' { [System.Drawing.StringAlignment]::Near }
          'right' { [System.Drawing.StringAlignment]::Far }
          default { [System.Drawing.StringAlignment]::Center }
        }
        $h = $g.MeasureString($line.text, $font, [int]$w).Height
        $g.DrawString($line.text, $font, $black, (New-Object System.Drawing.RectangleF 0, $y, $w, $h), $fmt)
        $y += $h + 1
        $font.Dispose()
      }
    }
  }
  $e.HasMorePages = $false
})

$doc.Print()
$doc.Dispose()
