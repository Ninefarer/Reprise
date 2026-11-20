# Clear desktop translucency regression: Nightly .2 to .3

## Finding

Reproduced in the **installed** `C:\Program Files\Reprise Nightly\reprise.exe`,
version `3.4.5-nightly.20261119.2`, using Glass / Clear / 90% / Pitch Black / Dark.
This was an overhaul regression, not expected Clear behavior or a compositor failure.

The live root reported `desktopGlass=clear` but `glassVariant=tinted`: tint >=78
silently substituted the material. The sidebar painted `rgba(16,16,16,.96)` and
the main canvas painted `rgba(16,16,16,.98)`. Reading panels added solid #101010
on top. Those fills concealed an otherwise working native backdrop.

## Native and WebView2 audit

- `DwmGetWindowAttribute` reported system backdrop type **3** (Desktop Acrylic)
  and immersive dark mode **1**, with successful HRESULTs, before and after the fix.
- No forced-colors, reduced-transparency or increased-contrast media fallback was
  active. The native IPC returned Clear without an error.
- Live computed backgrounds of `html`, `body`, `#root` and `.app` were fully
  transparent before and after. Their element opacity remained 1; text was not faded.
- Tauri 2.12.5 `WebviewWindow::set_background_color` forwards to both the window
  and webview. Reprise passes RGBA(0,0,0,0) successfully when native glass is active.
  On Windows the HWND color API ignores alpha; the WebView2 layer supports alpha
  0 or 255, not intermediate controller background alpha. CSS provides intermediate
  fills. The opaque regression was in those CSS fills, not a newly opaque controller.
- Pitch Black still supplies neutral #101010 surface RGB and fixes Dark appearance.
  Its theme identity is retained; it no longer forces an almost-opaque canvas.

## Comparison at the reported configuration

| Implementation | Main canvas CSS coverage | Sidebar CSS coverage | Desktop foundation |
| --- | ---: | ---: | --- |
| Pre-overhaul source at HEAD, Clear/90/dark | 52.2% | 88.5% including the pane beneath it | Clear did not request native diffusion |
| Installed Nightly .2 | 98% | 96% | Windows Desktop Acrylic |
| Installed corrected Nightly .3 | 74% | 74%, plus a small edge reflection | Same Windows Desktop Acrylic |

The legacy low-tint pane could drop to 20.3% coverage, explaining the original
excessive see-through problem. That behavior was not restored. At 90%, .3 permits
26% of the **already composed Acrylic backdrop** through its canvas fill, not
26% unmodified desktop pixels. Windows adds its own diffusion/tint and policy.

## Correction

`desktop_material` now always selects Clear or Regular. Tint adjusts that selected
recipe within bounds, without a threshold switch to Tinted. The preset label is
Strong tint. Stored material/tint values and the settings schema are unchanged.

Normalized tint is `u=clamp((tint/100-.35)/.55,0,1)`:

- Clear canvas/navigation alpha: `contrastFloor + .08*u`.
- Regular canvas/navigation alpha: `min(.90, contrastFloor + .10 + .06*u)`.
- Floor: .66 for neutral dark/light and light families, .76 for Classic dark,
  .78 for Peach dark. Colored dark families need more body for foreground contrast.
- Inactive canvas uses a bounded denser recipe, capped at .88, rather than a .98 mask.
- Task cards, forms and dense reading panels remain stable. Exposed empty-state
  and header helper text uses primary theme ink. Broad reflection is restrained;
  diffusion, lit edges, focus and interaction behavior remain in place.

The percentage control is **tint strength within a recipe**, not a literal window
opacity setting. No whole-element opacity, bitmap sampling, framework replacement,
custom shader, screen capture or undocumented DWM effect was introduced.

## Installed validation

Built and installed `3.4.5-nightly.20261119.3` over Nightly .2 (installer exit 0).
The installed executable's SHA-256 matches the executable extracted from that NSIS
installer. This was not a Vite-only or unpackaged-debug test.

Exercised both materials at 35, 60, 78 and 90%, for Classic light/dark, Peach
light/dark, Pitch Black dark and Ashen White light: **48 settled, active,
unobscured installed-runtime cases**. The script uses Reprise's `visual_preferences`
IPC and restores original settings in `finally`; it does not inject replacement CSS.
Every case retained transparent outer layers and successful native material state.
Clear stayed Clear and Regular stayed Regular, with monotonically bounded coverage.

Actual installed canvas/navigation alpha (%) in tint order 35 / 60 / 78 / 90:

| Theme / appearance | Clear | Regular |
| --- | --- | --- |
| Classic light | 66 / 69.6 / 72.3 / 74 | 76 / 78.7 / 80.7 / 82 |
| Classic dark | 76 / 79.6 / 82.3 / 84 | 86 / 88.7 / 90 / 90 |
| Peach light | 66 / 69.6 / 72.3 / 74 | 76 / 78.7 / 80.7 / 82 |
| Peach dark | 78 / 81.6 / 84.3 / 86 | 88 / 90 / 90 / 90 |
| Pitch Black dark | 66 / 69.6 / 72.3 / 74 | 76 / 78.7 / 80.7 / 82 |
| Ashen White light | 66 / 69.6 / 72.3 / 74 | 76 / 78.7 / 80.7 / 82 |

Separately inspected the reported installed Pitch Black/Clear/90 configuration
over white, near-black, checkerboard and the actual desktop. The canvas responds
visibly to the underlying desktop while cards/forms retain their reading backgrounds.
The 48-case matrix is a computed-style/native-success test, not 48 visual screenshots.

Browser regression checks also cover all 48 recipes, primary-ink contrast >=4.5:1
over conservative black/white backdrop endpoints including the broad reflection,
root material overrides, solid/forced-colors fallback, keyboard selection and focus.
Frontend: 223 tests passed. Rust: fmt/check passed; 63 tests passed, two existing
manual tests ignored. Release build and installer archive checks passed.

Original Glass/Clear/90/Pitch Black/Dark/Expressive values were restored. Task rows
are identical to the pre-install local database backup; SQLite integrity is `ok`.
No normal task content was exported. No Stable installation or public release changed.
Raw, local records are under `artifacts/glass/transparency-regression/`.

## Native limitations

Windows controls Desktop Acrylic's desktop sampling, blur, base tint and fallback
behavior. CSS backdrop filters sample in-app content only. Small high-frequency
background details can disappear into diffusion; dark content behind dark glass
will naturally provide less visible variation. Inactive windows and system
accessibility/energy/GPU policy may use a denser or solid native backdrop.

These are documented compositor-backed translucency and surface lighting effects,
not genuine optical refraction. No refraction or desktop luminance adaptation is
claimed. Dense reading panels are intentionally not desktop-transparent. Physical
multi-DPI/monitor coverage and GPU presentation certification remain separate checks.
