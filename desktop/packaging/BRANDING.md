# Windows branding assets

The canonical full-colour logo is `../ui/src/assets/swiftslate-logo.png`. It is the original Android `playstore-icon.png`; source and checksum details live beside that file.

## Derivatives

- `SwiftSlate.ico` — executable, Win32 window/tray, setup, shortcut, uninstaller, and Add/Remove Programs icon. The 16 px and 24 px entries use the simplified `tray-mark.png` (bold cursor pillar + single crisp cyan star); 32, 48, 64, 128, and 256 px entries mask the canonical full-colour art into a matching Windows 11 squircle with a specular inner rim so 150%/200%-DPI trays and Light-mode taskbars share the same silhouette.
- `tray-mark.png` — reproducibly generated 108 px small-context derivative with fewer, heavier shapes so that the mark survives 16 px and 24 px Windows tray scaling cleanly.
- `wizard/SwiftSlate-Wizard-Light.png` and `wizard/SwiftSlate-Wizard-Dark.png` — 534 x 1022 PNG panels for Inno Setup 7.1.1 dynamic themes with subtle orbital rings, specular framing, and soft contact shadows.

The derivatives are committed so normal Windows builds do not require image tooling. Maintainers with ImageMagick 6 can regenerate them by running:

```bash
./desktop/packaging/generate_branding_assets.sh
```

Regeneration should be followed by visual inspection of the 16 px ICO entry and both wizard panels. ImageMagick encoder versions can change binary checksums even when rendered pixels are unchanged.
