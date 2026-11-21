# JAMSTORM interface

The visual contract is a restrained Apple-style music application. Apple Design and Design Engineering skills inform the implementation; the user’s explicit Liquid Glass direction takes precedence over the installed skill’s unrelated Duolingo preferences.

- One primary action: Invite immediately prepares a room, QR and copyable link.
- Player navigation, independent Words/Queue toggles, one Invite button, Settings. Playback mode, materials and add-ons live in Settings.
- Words left, imported native queue right, high-resolution cover and metadata in the center. All three are local DOM components; catalog/TV are exclusive native web surfaces. A shared surface-layout function prevents overlaps.
- Glass has a legible base. Acrylic/Mica are Windows materials; the local panels share a real CSS backdrop, fixed corner geometry and a restrained opaque base. No captured page backdrop or raw site content sits under them.
- Warm neutral ink and accents, controlled album-color ambient, one icon stroke family, system typography. Texture stays subtle and static.
- Lyrics move only to follow the song; user scrolling temporarily suspends following. A line can seek the song. Loading, missing, instrumental, plain-text, retry and synchronized states are distinct.
- Animation uses opacity and transforms, short entrances and reduced-motion support. Audio light reads a separate capture stream and never reroutes output.
- Guest actions use touch targets, search and queue tabs, a current-song card and optional row menus. Feedback confirms successful additions.

## Review evidence

Local images in `artifacts/ui-review`: empty/full queue, invitation before/after creation, settings, 860px variants, active lyrics and queue panel. `artifacts/stage-3-full-player.png` is a live screenshot of the unified scene, including all four panel combinations. `artifacts/guest-mobile.png` and `guest-search.png` cover the mobile guest path. Review fixtures use original short text, not distributed song lyrics.

The first review found invitation controls below the fold, redundant toolbar controls, unreadable text through translucent panels and lyric scrolling moving the page instead of its container. These were corrected and reshot. Native playback, guest HTTP edits, synchronized lyrics, audio level and background play were checked against a live Music track. Physical Android and TV pairing remain unverified. TV surface exclusivity is tested against real native-view visibility.

## 0.5 correction

The previous approach changed private YouTube layout and layered independent WebContentsViews. User screenshots exposed clipping, stretched low-resolution artwork, unreadable catalog backgrounds and TV overlap. That approach was removed. The replacement is a single CSS grid, bounded high-resolution artwork, a persistent local playback dock, explicit catalog navigation and native web pages with untouched geometry. CloudMus informed the composition; no Qt code or resources were ported. Live verification also found and fixed a first-play race: the adapter now waits for the media stream before confirming PLAY.

## 0.5.1 short-window and focus correction

The cover is constrained by the actual center container height, including search, metadata and the first-use CTA. Search lives in an independent grid row. Review checks 40 combinations at 1163×774, 1163×700, 860×620, 1320×620 and 960×650 with empty/full playback and side/center/hidden surfaces; hit testing verifies search remains clickable and the CTA is fully visible. Centered lyrics are checked against the actual bounded scroll viewport, not an overflowing padded child.

Words and Queue cycle hidden → side → center; only one can own the center. Hidden panels are inert. Center lyrics replace artwork, track the current line and animate emphasis/scroll. The preserved artwork remains in the dock. Startup, panel transitions and lyric transitions have actual running-animation checks, with reduced-motion alternatives. Windows glass no longer sits below a 94% opaque body; Acrylic is the fresh-install default and saved material preferences remain valid.

The original coral icon is restored inside a transparent rounded SVG boundary, which is also rasterized for the ICO. TV gets its own toolbar and inset native surface; catalog navigation from TV actually restores Music UA/player mode and loads music.youtube.com. Live TV→Music navigation, native guest queue edits, synchronized lyrics, HQ art and background audio passed. This styles the TV shell without claiming to replace Leanback or verify physical Cast pairing.

## 0.6 · playback and room policies

The user refined startup to warm orange/amber fire with a small violet accent, ending in the original spiral as a transparent cutout in a white tile. Upper navigation keeps a low-opacity glass surface, including fullscreen. Words/queue move to icon buttons at the dock's right edge; artist/credit instructions leave the lyric viewport. Hidden panes preview at screen edges. A decorative record mode uses one WAAPI rotation with gradual rate changes; record swap and ambient crossfade preserve continuity. Reduced-motion is respected. Always measure the record clipping frame, not the axis-aligned bounding rectangle of a rotated image.

Host policies are outside the UI: explicit checks, outstanding additions per participant and add-only permissions cover browser and Android paths. Public screenshots use our original Afterglow cover and original short lyric fixture. Keep development details in docs/HANDOFF.md and DEVELOPMENT.md, not on the product README.

## 0.6.1 follow-up

No glyph icons in fullscreen navigation; consistent SVG settings/sliders and a real path morph inside the larger transport button. The cover's circular mask never owns its controls: the sibling cover-shell keeps paper-label controls fully clickable. Startup uses the actual logo silhouette, warm gradient and restrained overshoot; the interface enters only after the logo resolves. Intro backdrop is transparent. Pause keeps the album-color base and eases only the audio pulse over 1.5 seconds. Catalog needs removal of native gradient/guide underlays as well as root backgrounds. TV has no second toolbar and catalog navigation preserves the selected player mode. Back/forward/home use native history, never implicit mode changes.
