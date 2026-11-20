# Prints one boarding slip on a Windows receipt printer (the POS58 at the door).
#
# Called by src/lib/printer.ts. The slip layout is decided there and passed in
# as base64-encoded UTF-8 JSON, so no guest text is ever spliced into a
# command line. Drawing goes through the Windows driver with System.Drawing
# rather than raw ESC/POS, so Thai names render with a Windows font instead of
# depending on the printer's built-in code pages.
#
# Payload: { "lines": [ { "type": "text", "text": "...", "size": 9, "bold": false, "italic": false,
#                       "font": "serif", "align": "center" }        (font: omit for the Thai-capable sans)
#                     | { "type": "columns", "gap": 6, "items": [ { "label": "TABLE", "value": "5" }, ... ] }
#                     | { "type": "image", "path": "C:\\...\\photos\\{token}-print.png" }
#                     | { "type": "rule", "width": 0.15 }               (hairline, centred, share of the width)
#                     | { "type": "space" }
#                     | { "type": "feed", "height": 80 } ] }   (blank paper, 1/100 inch)

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
# The couple's lettering. English only: Georgia has no Thai, so guest text
# never asks for it.
$script:serif = if ($installed -contains 'Georgia') { 'Georgia' } else { $script:family }

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
      'feed' { $y += [single]$line.height }
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
        $share = if ($line.width) { [single]$line.width } else { [single]1 }
        $len = [single]($w * $share)
        $x0 = [single](($w - $len) / 2)
        $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::Black), 1
        $y += 4
        $g.DrawLine($pen, $x0, $y, ($x0 + $len), $y)
        $y += 5
        $pen.Dispose()
      }
      'columns' {
        # Equal columns, each a small label over a large bold value, centred.
        $items = @($line.items)
        $colW = [single]($w / $items.Count)
        $labelFont = New-Object System.Drawing.Font $script:family, 7
        $valueFont = New-Object System.Drawing.Font $script:family, 16, ([System.Drawing.FontStyle]::Bold)
        $fmt = New-Object System.Drawing.StringFormat
        $fmt.Alignment = [System.Drawing.StringAlignment]::Center
        $labelH = [single]0
        $valueH = [single]0
        foreach ($item in $items) {
          $labelH = [Math]::Max($labelH, $g.MeasureString([string]$item.label, $labelFont, [int]$colW).Height)
          $valueH = [Math]::Max($valueH, $g.MeasureString([string]$item.value, $valueFont, [int]$colW).Height)
        }
        $gap = if ($line.gap) { [single]$line.gap } else { [single]0 }
        $x = [single]0
        foreach ($item in $items) {
          $g.DrawString([string]$item.label, $labelFont, $black, (New-Object System.Drawing.RectangleF $x, $y, $colW, $labelH), $fmt)
          $g.DrawString([string]$item.value, $valueFont, $black, (New-Object System.Drawing.RectangleF $x, ($y + $labelH + $gap), $colW, $valueH), $fmt)
          $x += $colW
        }
        $y += $labelH + $gap + $valueH + 1
        $labelFont.Dispose(); $valueFont.Dispose()
      }
      default {
        $style = [System.Drawing.FontStyle]::Regular
        if ($line.bold) { $style = $style -bor [System.Drawing.FontStyle]::Bold }
        if ($line.italic) { $style = $style -bor [System.Drawing.FontStyle]::Italic }
        $size = if ($line.size) { [single]$line.size } else { [single]9 }
        $face = if ($line.font -eq 'serif') { $script:serif } else { $script:family }
        $font = New-Object System.Drawing.Font $face, $size, $style
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
