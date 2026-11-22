# Third-party notices

JAMSTORM original code and artwork: Copyright (c) 2026 JAMSTORM contributors. MIT License. See LICENSE.

Dependencies below are redistributed unmodified. Their licenses apply to their respective code. Full license texts are in assets/licenses. The Electron distribution additionally contains LICENSE.electron.txt and LICENSES.chromium.html.

- @ghostery/adblocker@2.20.3 — MPL-2.0 — git+ssh://git@github.com/ghostery/adblocker.git
- qrcode@1.5.4 — MIT — git://github.com/soldair/node-qrcode.git
- @ghostery/adblocker-content@2.20.3 — MPL-2.0 — git+ssh://git@github.com/ghostery/adblocker.git
- @ghostery/adblocker-extended-selectors@2.20.3 — MPL-2.0 — git+ssh://git@github.com/ghostery/adblocker.git
- @ghostery/url-parser@1.3.1 — MPL-2.0 — https://github.com/ghostery/url-parser
- @remusao/guess-url-type@2.1.0 — MPL-2.0 — git+https://github.com/remusao/mono.git
- @remusao/small@2.1.0 — MPL-2.0 — git+https://github.com/remusao/mono.git
- @remusao/smaz@2.2.0 — MPL-2.0 — git+https://github.com/remusao/mono.git
- tldts-experimental@7.5.5 — MIT — git+ssh://git@github.com/remusao/tldts.git
- dijkstrajs@1.0.3 — MIT — git://github.com/tcort/dijkstrajs
- pngjs@5.0.0 — MIT — git://github.com/lukeapage/pngjs.git
- yargs@15.4.1 — MIT — https://github.com/yargs/yargs.git
- @remusao/smaz-compress@2.2.0 — MPL-2.0 — git+https://github.com/remusao/mono.git
- @remusao/smaz-decompress@2.2.0 — MPL-2.0 — git+https://github.com/remusao/mono.git
- tldts-core@7.5.5 — MIT — git+ssh://git@github.com/remusao/tldts.git
- cliui@6.0.0 — ISC — http://github.com/yargs/cliui.git
- decamelize@1.2.0 — MIT — sindresorhus/decamelize
- find-up@4.1.0 — MIT — sindresorhus/find-up
- get-caller-file@2.0.5 — ISC — git+https://github.com/stefanpenner/get-caller-file.git
- require-directory@2.1.1 — MIT — git://github.com/troygoode/node-require-directory.git
- require-main-filename@2.0.0 — ISC — git+ssh://git@github.com/yargs/require-main-filename.git
- set-blocking@2.0.0 — ISC — git+https://github.com/yargs/set-blocking.git
- string-width@4.2.3 — MIT — sindresorhus/string-width
- which-module@2.0.1 — ISC — git+https://github.com/nexdrew/which-module.git
- y18n@4.0.3 — ISC — git@github.com:yargs/y18n.git
- yargs-parser@18.1.3 — ISC — https://github.com/yargs/yargs-parser.git
- @remusao/trie@2.1.0 — MPL-2.0 — git+https://github.com/remusao/mono.git
- strip-ansi@6.0.1 — MIT — chalk/strip-ansi
- wrap-ansi@6.2.0 — MIT — chalk/wrap-ansi
- locate-path@5.0.0 — MIT — sindresorhus/locate-path
- path-exists@4.0.0 — MIT — sindresorhus/path-exists
- emoji-regex@8.0.0 — MIT — https://github.com/mathiasbynens/emoji-regex.git
- is-fullwidth-code-point@3.0.0 — MIT — sindresorhus/is-fullwidth-code-point
- camelcase@5.3.1 — MIT — sindresorhus/camelcase
- ansi-regex@5.0.1 — MIT — chalk/ansi-regex
- ansi-styles@4.3.0 — MIT — chalk/ansi-styles
- p-locate@4.1.0 — MIT — sindresorhus/p-locate
- color-convert@2.0.1 — MIT — Qix-/color-convert
- p-limit@2.3.0 — MIT — sindresorhus/p-limit
- color-name@1.1.4 — MIT — git@github.com:colorjs/color-name.git
- p-try@2.2.0 — MIT — sindresorhus/p-try

## Source availability

Ghostery adblocker packages are unmodified MPL-2.0 dependencies. Source and build instructions: https://github.com/ghostery/adblocker . Exact npm package versions and integrity hashes are pinned in package-lock.json. npm source package: https://registry.npmjs.org/@ghostery/adblocker/-/adblocker-2.20.3.tgz . No MPL source files have been modified.

cloudflared 2026.11.1, Copyright Cloudflare, Inc. and contributors, Apache-2.0. Bundled unmodified Windows amd64 binary. License: vendor/cloudflared-LICENSE.txt . Source: https://github.com/cloudflare/cloudflared/tree/2026.11.1 . SHA-256: 341deda3db5ec498a0482254d6c38c0b7cf01a30c37bb5dd95d2216d08955e35.

## Services and compatibility references

SponsorBlock API data is licensed CC BY-NC-SA 4.0: https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License . Segments are supplied by SponsorBlock contributors, https://sponsor.ajay.app . No database is bundled; use is optional. No commercial license is granted by JAMSTORM for SponsorBlock data.

Jam-Layer by JamQueueSharing: https://github.com/JamQueueSharing/Jam-Layer . The desktop protocol implementation is independently written; Android sources are not redistributed. Optional interoperability tests compile the original separately obtained sources locally.

VacuumTube by shy1132 provided the compatibility reference for the Cobalt TV user agent and background playback approach: https://github.com/shy1132/VacuumTube . Its MIT notice is included in assets/licenses/VacuumTube-MIT.txt. JAMSTORM includes adapted Cobalt compatibility hooks under that MIT license; the complete VacuumTube app is not bundled.

YouTube and YouTube Music are trademarks of Google LLC. Their site code, logos, music, APKs and video files are not included in this repository. JAMSTORM is unofficial and is not endorsed by Google, Cloudflare, SponsorBlock, ReVanced, or Jam-Layer.

Ambient light for YouTube by Wessel Kroos: https://github.com/WesselKroos/youtube-ambilight . The adapted ProjectorShadow module in src/ambient-shadow.js is redistributed under the MIT License, Copyright (c) 2017 Wessel Kroos. Full license: assets/licenses/YouTube-Ambilight-MIT.txt. Source revision: 2207e621d8dee43b6b91ea822111849ba00e72e3. The complete browser extension is not bundled.
