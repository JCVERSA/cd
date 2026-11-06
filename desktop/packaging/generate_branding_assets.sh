#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
desktop_dir="$(cd "$script_dir/.." && pwd)"
logo="$desktop_dir/ui/src/assets/swiftslate-logo.png"
tray_mark="$script_dir/tray-mark.png"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if command -v magick >/dev/null 2>&1; then
  image=(magick)
elif command -v convert >/dev/null 2>&1; then
  image=(convert)
else
  echo "ImageMagick is required (magick or convert)." >&2
  exit 1
fi

[[ -f "$logo" ]] || { echo "Missing branding source: $logo" >&2; exit 1; }

# 1. Generate simplified 108x108 tray-mark.png for small (16px / 24px) Windows tray sizes:
#    High-contrast rounded squircle, bold cyan-cobalt-magenta cursor pillar, and one crisp
#    4-point cyan star (no tiny secondary star that muddies at 16x16).
"${image[@]}" -size 432x432 xc:none \
  -fill '#080810' -stroke 'rgba(186,172,255,0.42)' -strokewidth 11 \
  -draw 'roundrectangle 14,14 417,417 94,94' \
  "$work/tray-bg.png"

"${image[@]}" -size 432x432 gradient:'#bdfeff-#df3fff' \
  \( -size 432x432 gradient:'#56d5ff-#465eff' \) -compose overlay -composite \
  "$work/tray-grad.png"

"${image[@]}" -size 432x432 xc:none \
  -fill white -draw 'roundrectangle 120,76 206,356 43,43' \
  "$work/tray-pillar-mask.png"

"${image[@]}" "$work/tray-grad.png" "$work/tray-pillar-mask.png" \
  -alpha off -compose CopyOpacity -composite "$work/tray-pillar.png"

"${image[@]}" -size 432x432 xc:none \
  -fill '#7ef3ff' \
  -draw 'polygon 298,92 318,162 388,182 318,202 298,272 278,202 208,182 278,162' \
  -fill '#e8ffff' \
  -draw 'circle 298,182 298,196' \
  "$work/tray-star.png"

"${image[@]}" "$work/tray-bg.png" \
  "$work/tray-pillar.png" -compose over -composite \
  "$work/tray-star.png" -compose over -composite \
  -filter Lanczos -resize 108x108 -depth 8 -strip "$tray_mark"

# 2. Build 7-frame SwiftSlate.ico (16, 24 from tray-mark; 32..256 from canonical logo
#    masked to a matching Windows 11 squircle with a crisp inner specular rim so 150%/200%
#    DPI tray icons, Light-mode taskbars, Start menu, and shortcuts never show sharp black squares).
"${image[@]}" "$tray_mark" -filter Lanczos -resize 16x16 "$work/icon-16.png"
"${image[@]}" "$tray_mark" -filter Lanczos -resize 24x24 "$work/icon-24.png"

"${image[@]}" "$logo" -filter Lanczos -resize 512x512 "$work/logo-512.png"
"${image[@]}" -size 512x512 xc:none -fill white \
  -draw 'roundrectangle 8,8 503,503 112,112' "$work/logo-512-mask.png"
"${image[@]}" "$work/logo-512.png" "$work/logo-512-mask.png" \
  -alpha off -compose CopyOpacity -composite \
  \( -size 512x512 xc:none -fill none -stroke 'rgba(196,182,255,0.34)' -strokewidth 12 \
     -draw 'roundrectangle 14,14 497,497 108,108' \) -compose over -composite \
  "$work/logo-512-squircle.png"

for size in 32 48 64 128 256; do
  "${image[@]}" "$work/logo-512-squircle.png" -filter Lanczos -resize "${size}x${size}" "$work/icon-${size}.png"
done

"${image[@]}" \
  "$work/icon-16.png" "$work/icon-24.png" "$work/icon-32.png" \
  "$work/icon-48.png" "$work/icon-64.png" "$work/icon-128.png" \
  "$work/icon-256.png" "$script_dir/SwiftSlate.ico"

# 3. Build Inno Setup 7.1.1 dynamic wizard panels (534 x 1022) with balanced 292x292 badge,
#    orbital rings, specular border, and soft contact shadow for both Dark and Light themes.
"${image[@]}" "$logo" -filter Lanczos -resize 292x292 "$work/wizard-logo.png"
"${image[@]}" -size 292x292 xc:none -fill white \
  -draw 'roundrectangle 0,0 291,291 64,64' "$work/wizard-logo-mask.png"
"${image[@]}" "$work/wizard-logo.png" "$work/wizard-logo-mask.png" \
  -alpha off -compose CopyOpacity -composite "$work/wizard-logo-rounded.png"

"${image[@]}" "$work/wizard-logo-rounded.png" \
  \( -size 292x292 xc:none -fill none -stroke 'rgba(214,200,255,0.28)' -strokewidth 2 \
     -draw 'roundrectangle 1,1 290,290 63,63' \) -compose over -composite \
  "$work/wizard-badge-dark.png"

"${image[@]}" "$work/wizard-logo-rounded.png" \
  \( -size 292x292 xc:none -fill none -stroke 'rgba(120,98,210,0.42)' -strokewidth 3 \
     -draw 'roundrectangle 1,1 290,290 63,63' \) -compose over -composite \
  "$work/wizard-badge-light.png"

mkdir -p "$script_dir/wizard"

"${image[@]}" -size 534x1022 gradient:'#151022-#06060b' \
  \( -size 534x1022 xc:none -fill '#7436ff4a' -draw 'circle 78,180 300,180' -blur 0x72 \) -compose screen -composite \
  \( -size 534x1022 xc:none -fill '#16c9ff38' -draw 'circle 462,810 240,810' -blur 0x85 \) -compose screen -composite \
  \( -size 534x1022 xc:none -fill none -stroke 'rgba(217,199,255,0.08)' -strokewidth 1.5 \
     -draw 'circle 267,499 267,300' -draw 'circle 267,499 267,252' \) -compose over -composite \
  \( -size 534x534 xc:none -fill 'rgba(0,0,0,0.62)' -draw 'roundrectangle 121,131 413,423 68,68' -blur 0x24 \) \
    -gravity center -geometry +0-4 -compose over -composite \
  "$work/wizard-badge-dark.png" -gravity center -geometry +0-12 -compose over -composite \
  -depth 8 -strip "$script_dir/wizard/SwiftSlate-Wizard-Dark.png"

"${image[@]}" -size 534x1022 gradient:'#fcfaff-#eae2ff' \
  \( -size 534x1022 xc:none -fill '#7b52ff28' -draw 'circle 65,175 290,175' -blur 0x72 \) -compose multiply -composite \
  \( -size 534x1022 xc:none -fill '#19bfe724' -draw 'circle 475,835 250,835' -blur 0x85 \) -compose multiply -composite \
  \( -size 534x1022 xc:none -fill none -stroke 'rgba(106,82,204,0.12)' -strokewidth 1.5 \
     -draw 'circle 267,499 267,300' -draw 'circle 267,499 267,252' \) -compose over -composite \
  \( -size 534x534 xc:none -fill 'rgba(42,26,96,0.26)' -draw 'roundrectangle 121,135 413,427 68,68' -blur 0x26 \) \
    -gravity center -geometry +0-2 -compose over -composite \
  "$work/wizard-badge-light.png" -gravity center -geometry +0-12 -compose over -composite \
  -depth 8 -strip "$script_dir/wizard/SwiftSlate-Wizard-Light.png"

echo "Regenerated Windows branding assets in $script_dir"
