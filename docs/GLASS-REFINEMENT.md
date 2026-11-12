# Glass material refinement — 3.1.1

Native transparency/Acrylic composition and window handling are unchanged. The refinement is limited to `src/desktop-glass.css` and the intensity controls in `src/AppearanceSettings.tsx`. No dependencies or new persistence fields.

## Material tokens

Let `t = saved desktop_tint / 100`. Existing custom tint preferences remain valid.

| Token | Dark | Light |
|---|---|---|
| Canvas alpha | `.58t` | `.48t` |
| Navigation alpha | `.58 + .20t` | `.40 + .26t` |
| Card alpha | `.80 + .12t` | `.88 + .08t` |
| Dense surface/input alpha | `.95` | `.97` |
| White edge alpha | `.24 - .10t` | `.70` |
| Reflection alpha | `.08 - .05t` | `.18 - .10t` |
| Card shadow | `0 5px 16px #00000024` | `0 4px 14px #161a2512` |

Canvas and navigation use subtle diagonal ambient gradients. Cards have a top-edge inset highlight and small soft shadow, while retaining their semantic lifecycle edge. Settings and capture surfaces use the denser material for text contrast. Inputs retain dense fills; active/focus/accent treatments remain intact. No container opacity, animated reflections, cursor tracking or additional backdrop filters are introduced.

Intensity presets write the existing tint setting: Subtle **82%**, Balanced **60%**, Crystal **38%**. They influence all material layers and reflected-edge strength through the formulas above. Other tint values display Custom tint. Native Acrylic blur strength remains Windows-controlled.

The root and body remain transparent only when the native Glass command enables Clear or Acrylic. The native backdrop continues to show through the canvas and translucent cards. High contrast, increased contrast and reduced transparency receive solid fallback fills without shadows.

111 frontend tests and 34 Rust tests pass. Production frontend, Windows debug and optimized NSIS installer builds pass. Rust check passes. Version stays 3.1.1.

## Desktop observations and limits

Actual Windows screenshots showed Balanced Clear revealing a playing browser video sharply behind the main canvas and sidebar, with translucent task cards, preserved colored status edges, fine illuminated borders and elevated dense capture surfaces. Ashen White Acrylic showed the native blurred backdrop through the canvas and separate pale navigation pane, with readable dark labels and raised cards. The dark sidebar tint was strengthened after inspecting busy browser/video text underneath it.

Native Acrylic itself supplies part of the diffuse/frosted appearance; Windows 11 does not expose reliable blur-radius or native tint-strength control through the supported Tauri API. The presets tune app materials, not the DWM blur. No external refraction is claimed.

The complete bright-page/dark-page/wallpaper-only/background-motion matrix was not exhaustively tested. These remain manual acceptance checks. Original opaque/Pitch Black preferences and custom 90% tint were restored after QA; no task data was changed.
