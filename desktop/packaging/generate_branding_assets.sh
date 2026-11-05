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

for required in "$logo" "$tray_mark"; do
  [[ -f "$required" ]] || { echo "Missing branding source: $required" >&2; exit 1; }
done

"${image[@]}" "$tray_mark" -filter Lanczos -resize 16x16 "$work/icon-16.png"
"${image[@]}" "$tray_mark" -filter Lanczos -resize 24x24 "$work/icon-24.png"
for size in 32 48 64 128 256; do
  "${image[@]}" "$logo" -filter Lanczos -resize "${size}x${size}" "$work/icon-${size}.png"
done
"${image[@]}" \
  "$work/icon-16.png" "$work/icon-24.png" "$work/icon-32.png" \
  "$work/icon-48.png" "$work/icon-64.png" "$work/icon-128.png" \
  "$work/icon-256.png" "$script_dir/SwiftSlate.ico"

"${image[@]}" "$logo" -resize 410x410 "$work/wizard-logo.png"
"${image[@]}" -size 410x410 xc:none -fill white \
  -draw 'roundrectangle 0,0 409,409 54,54' "$work/wizard-logo-mask.png"
"${image[@]}" "$work/wizard-logo.png" "$work/wizard-logo-mask.png" \
  -alpha off -compose CopyOpacity -composite "$work/wizard-logo-rounded.png"

mkdir -p "$script_dir/wizard"
"${image[@]}" -size 534x1022 gradient:'#171024-#050509' \
  \( -size 534x1022 xc:none -fill '#7436ff55' -draw 'circle 70,170 310,170' -blur 0x70 \) -compose screen -composite \
  \( -size 534x1022 xc:none -fill '#16c9ff42' -draw 'circle 470,800 230,800' -blur 0x85 \) -compose screen -composite \
  "$work/wizard-logo-rounded.png" -gravity center -geometry +0-12 -compose over -composite \
  -depth 8 -strip "$script_dir/wizard/SwiftSlate-Wizard-Dark.png"

"${image[@]}" -size 534x1022 gradient:'#fbf9ff-#e8ddff' \
  \( -size 534x1022 xc:none -fill '#7b52ff35' -draw 'circle 55,165 300,165' -blur 0x70 \) -compose multiply -composite \
  \( -size 534x1022 xc:none -fill '#19bfe733' -draw 'circle 480,840 240,840' -blur 0x85 \) -compose multiply -composite \
  "$work/wizard-logo-rounded.png" -gravity center -geometry +0-12 -compose over -composite \
  -depth 8 -strip "$script_dir/wizard/SwiftSlate-Wizard-Light.png"

echo "Regenerated Windows branding assets in $script_dir"
