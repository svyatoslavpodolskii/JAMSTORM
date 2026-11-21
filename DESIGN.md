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
