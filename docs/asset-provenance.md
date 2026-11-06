# Asset provenance

## Identity and design

The user supplied `mofied-brand-kit.zip`, then approved a product-aligned design pass. The icon files in `packages/design/assets/icons` preserve that mark. `docs/design` contains the approved web, native, ending and long-title boards plus the explicit decisions. Rejected earlier logo explorations are not part of this repository.

The final corrections are retained: icon-only desktop Info, Faqieh's exact Thmanyah/Noto Naskh UI fonts, and no library-attribution line under media titles.

## Fonts

The six WOFF2 files are the exact assets already used by Faqieh: Thmanyah Serif Display Medium, Noto Naskh Arabic UI, Kitab Regular and Gilroy Regular/Medium/Bold. Only approved visual assets were copied; no Rails application source was copied.

Native TTFs are decompressions of those files, not substitute fonts. Noto's variable weight axis is instantiated at 400 and 600 for reliable native font loading. `scripts/convert-fonts.py` records that conversion. Family names in Expo's font map are application aliases.

The Noto OFL notice from the supplied kit is included. Inclusion here does not grant new redistribution rights for Thmanyah, Gilroy or other licensed assets; confirm coverage for the independent app before a public release or making this repository public. Keep existing copyright/name metadata in generated fonts.

## Media fixtures

`packages/fixtures/src/public-media.json` was collected from the publicly accessible `https://faqieh.com/ar/shorts` response on 2026-11-05. It contains five public media records, their display metadata, public poster/portrait URLs and R2 HLS URLs. No database dump, credentials, private fixture, source media upload or Rails source is included.

The normal scenario starts with public media ID 44445, “أوقات زكاة الفطر خمسةٌ”, then an illustrative Quran reminder, then media ID 48193. Other records exercise a long title and reserve media. External availability is not controlled by this repository. Tests do not rely on those remote streams remaining available.

The sample Quran text and reflection wording are from the approved screen reference. Quran text attribution is Tanzil. The API must supply the actual launch content unchanged.

## Test asset

`tests/assets/media.mp4` is a generated 12-second test pattern, used only by Playwright route interception. It is not a downloaded speaker video. To regenerate an equivalent fixture with ffmpeg:

```sh
ffmpeg -f lavfi -i testsrc2=size=180x320:rate=24 -f lavfi -i sine=frequency=440:sample_rate=44100 -t 12 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart tests/assets/media.mp4
```

`tests/assets/hls` segments the same generated pattern into a small VOD playlist for real hls.js decoding and manifest/segment failure tests. No public speaker media is bundled in the test assets. Regenerate it with:

```sh
ffmpeg -i tests/assets/media.mp4 -c:v libx264 -pix_fmt yuv420p -g 120 -keyint_min 120 -sc_threshold 0 -c:a aac -f hls -hls_time 5 -hls_playlist_type vod -hls_segment_filename tests/assets/hls/segment-%02d.ts tests/assets/hls/index.m3u8
```

Third-party source dependencies retain their package licenses. The narrowly scoped Expo patch modifies Expo's MIT-licensed playback module and is maintained separately under `patches/`.

## Contact icons

The five social brand paths in `packages/design/src/contact.ts` are from the public Simple Icons SVGs (`telegram`, `youtube`, `x`, `facebook`, `github`), retrieved on 2026-11-05 from `https://github.com/simple-icons/simple-icons/tree/develop/icons`. Their CC0 license is retained in `packages/design/assets/icons/simple-icons-LICENSE.md`. Email uses the existing Lucide icon. Public destinations and accessible labels match Faqieh’s footer; no Rails implementation was copied.
