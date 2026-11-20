# Glass and motion maintenance guide

This is the current implementation reference. Earlier glass and motion reports
describe the decisions and measurements made at each stage; see [Pass 3 QA](PASS-3-QA.md)
for the latest verification and outstanding manual checks.

## Rendering ownership

Reprise remains React + Tauri 2 + WebView2. `src-tauri/src/visuals.rs` uses the
documented Windows 11 `DWMWA_SYSTEMBACKDROP_TYPE` API, selecting transient-window
Desktop Acrylic. Both shipping glass variants use that native foundation.
WebView2 and the HTML/body/app backgrounds must remain transparent while native
glass is active. Each visible region supplies exactly one canvas tint.

Desktop diffusion belongs to DWM. CSS `backdrop-filter` samples content inside
the WebView, not pixels behind the native window. CSS gradients, edges and
shadows approximate surface lighting; they are not optical refraction. There
is no desktop capture, shader refraction, Mica substitution or undocumented
DWM accent API. Native policy or an unsupported backdrop returns a solid
fallback. Windows can change Acrylic's appearance independently when inactive.

## Materials and tint

`theme.ts` owns theme/media policy and native synchronization;
`desktop-glass.css` owns the native-window canvas; `glass-material.css` owns
bounded in-app surfaces. These layers have different purposes, not competing
global opacity settings. Never put another tinted `.app` behind the canvas.

Shipping preferences expose **Clear and Regular**. The internal material lab
also has a **Tinted** recipe, but Tinted has no shipping setting or persisted
native selection. Do not describe that prototype as a released third variant.

Tint progress is `clamp((tint / 100 - .35) / .55, 0, 1)`:

| Canvas                                        | Clear alpha, tint 35–90% | Regular alpha, tint 35–90% |
| --------------------------------------------- | ------------------------ | -------------------------- |
| Pitch Black, Ashen White, light Classic/Peach | .66–.74                  | .76–.82                    |
| Dark Classic                                  | .76–.84                  | .86–.90                    |
| Dark Peach                                    | .78–.86                  | .88–.90                    |

Regular uses `min(.90, contrastFloor + .10 + progress * .06)`.
Clear uses `contrastFloor + progress * .08`. Tint changes body without changing
identity. Fixed Pitch Black and Ashen White retain their own effective dark/light
appearance. At Clear 90%, Pitch Black's canvas is `rgba(16,16,16,.74)`, not an
opaque black mask. Inactive canvas coverage is bounded at .88; DWM can still
reduce native translucency while inactive.

In-app recipes use coverage/diffusion Clear .74/12px, Regular .82/18px,
lab-only Tinted .94/22px. Readable menus/popovers deliberately use .94 coverage;
notifications use one bounded 24px blur and .96 fill. Task cards, dense settings
sections and capture inputs remain stable reading surfaces. A control inside
an elevated container uses a thin fill without a second blur.

Native responses carry a frontend revision guard: a delayed request must not
restore glass after accessibility or appearance policy has disabled it. Hidden
Quick Capture receives `visual-refresh`, a settings-only snapshot that bypasses
the worker visibility gate. Ordinary hidden-window worker refreshes stay
suspended. New windows bootstrap their current settings before first show.

## Motion ownership and profiles

`motion.ts` is the single physical controller. It samples analytical damped
springs, preserves position/velocity on reversal, stops scheduling when settled,
and caps a leg at 600ms. Do not add a second animation on its properties.

| Purpose                 | CSS Subtle / Expressive | Spring angular frequency | Expressive damping ratio |
| ----------------------- | ----------------------- | ------------------------ | ------------------------ |
| Snappy: hover/press     | 120 / 140ms             | 70 rad/s                 | 1                        |
| Fluid: menus/selection  | 220 / 240ms             | 38 rad/s                 | .9                       |
| Gentle: larger overlays | 280 / 300ms             | 34 rad/s                 | 1                        |
| Decisive: task changes  | 220 / 240ms             | 48 rad/s                 | 1                        |

Subtle springs use frequency ×1.12 and critical damping. CSS durations are
fallback/profile tokens, not guaranteed spring durations. Notices use 320ms;
return emphasis uses 700/850ms. `--motion-menu` remains a compatibility alias
used by the settings underline. `data-spring-surface` suppresses CSS entrance
animations so a component has one owner per property.

`glassMotion.ts` interpolates measured rounded-rectangle geometry for an empty
surface shell. Content stays unscaled and is revealed by clipping. Origin and
destination are measured from the actual trigger/popup, including edge-clamped
placement. Shape, radius, rim light and shadow derive from one progress value.
This is real geometry interpolation of a DOM shell, with simulated material
lighting. It does not reproduce Apple's native optical renderer.

During an active reversal the controller and velocity are retained. At rest,
the transient shell/controller are removed. The next leg measures fresh bounds
and material. A content resize or policy change settles the active transition
and removes the snapshot instead of stretching stale pixels. Do not cache a
computed shadow or tint across theme changes.

`ConnectedGlassControls` uses a bounded SVG silhouette for related same-row
controls (nearby bounds only). Their hit targets and text remain separate.
This is a geometric connecting silhouette, not filtered metaballs or desktop
refraction. It is removed on release, policy changes, scrolling or resizing.
Press flex/rim response is restrained and does not stretch labels/icons.

Navigation reuses one selection fill. Task list FLIP measurements occur only
when tasks, view/search scope or completion feedback change, not every unrelated
React render. Exiting row copies are inert and stripped of IDs; resizing settles
them. Layout FLIP does not promise spring velocity continuity between unrelated
list layouts. Keep task persistence immediate and independent of visual settling.

Quick Capture focuses immediately; its bounded clipped reveal does not defer
input. Reopening interrupts exit. Native hide occurs after the visual exit,
with generation checks preventing an old completion from hiding a reopened
window. Its shadow comes from the current material, not a mount-time snapshot.

## Accessibility and component patterns

Reduced motion, animation Off and forced colors bypass spatial springs.
Changing motion/material/theme/native-active policy settles existing controllers
and releases observers. Reduced transparency, increased contrast and Windows
advanced-effects policy select solid materials. Forced colors use system
Canvas/CanvasText; selected navigation uses Highlight/HighlightText with its
descendants sharing that palette, avoiding Chromium text-backplate occlusion.

Use semantic buttons/menu roles, preserve `aria-expanded`, keyboard arrows,
Escape and focus return. Keep focus outlines visible. Closing visual copies are
inert/hidden to assistive technology and cannot intercept input. New components
should reuse anchored popup/presence helpers rather than timers or CSS exit
queues. Disabled controls must not register press effects.

Prefer opacity/transforms for content. Geometry, clip and shadow interpolation
can incur rendering work; do not call it entirely compositor-only. Measure only
at transition/layout boundaries, avoid nested blur passes, clean up observers,
listeners, transient shells and animation controllers. No idle shimmer, full
window rendering loop or per-frame bitmap processing is required by this system.

## Platform and verification limits

WebView media emulation verifies policy handling but does not replace changing
Windows settings. Emulated device-pixel ratio does not certify real mixed-DPI
monitor transitions. Renderer rAF intervals are scheduling observations, not
GPU or DWM frame times. PDH GPU utilization/allocation is likewise not a GPU
frame-time trace. Multi-hour soak, sleep/resume, physical display changes,
assistive-technology narration and older/unsupported graphics configurations
remain manual certification cases; see the QA report before making claims.
