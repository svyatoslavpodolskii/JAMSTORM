# JAMSTORM interface

The visual contract is a restrained Apple-style music application. Apple Design and Design Engineering skills inform the implementation; the user’s explicit Liquid Glass direction takes precedence over the installed skill’s unrelated Duolingo preferences.

- One primary action: Invite immediately prepares a room, QR and copyable link.
- Player navigation, independent Words/Queue toggles, one Invite button, Settings. Playback mode, materials and add-ons live in Settings.
- Words left, native queue right, native Music player between them. Panels appear after a song is selected. Search and bottom playback controls remain accessible.
- Glass has a legible base. Acrylic/Mica are Windows materials; inner panels use softened local backdrops to prevent duplicate site text showing through.
- Warm neutral ink and accents, controlled album-color ambient, one icon stroke family, system typography. Texture stays subtle and static.
- Lyrics move only to follow the song; user scrolling temporarily suspends following. A line can seek the song. Loading, missing, instrumental, plain-text, retry and synchronized states are distinct.
- Animation uses opacity and transforms, short entrances and reduced-motion support. Audio light reads a separate capture stream and never reroutes output.
- Guest actions use touch targets, search and queue tabs, a current-song card and optional row menus. Feedback confirms successful additions.

## Review evidence

Local images in `artifacts/ui-review`: empty/full queue, invitation before/after creation, settings, 860px variants, active lyrics and queue panel. `artifacts/stage-2-full-player.png` is a live composed Windows app capture. `artifacts/guest-mobile.png` and `guest-search.png` cover the mobile guest path. Review fixtures use original short text, not distributed song lyrics.

The first review found invitation controls below the fold, redundant toolbar controls, unreadable text through translucent panels and lyric scrolling moving the page instead of its container. These were corrected and reshot. Native playback, guest HTTP edits, synchronized lyrics, audio level and background play were checked against a live Music track. Physical Android and TV pairing remain unverified.
