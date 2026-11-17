# Store listings

Everything the stores show besides the app itself. Each release sends it to the App Store, Google Play and AppGallery (see [docs/releasing.md](../../../docs/releasing.md)), so change listings here rather than in the stores' consoles: a release overwrites console edits. `bun run release:check` checks every file against the stores' limits. The format is [ieasybooks/release](https://github.com/ieasybooks/release)'s, which other apps share; `store.json`'s `name` names the app in its messages.

## Texts

One folder per language (only `ar` for now); `store.json` maps each to the stores' locale codes.

| File                             | App Store        | Google Play       | AppGallery         | Limit  |
| -------------------------------- | ---------------- | ----------------- | ------------------ | ------ |
| `ar/name.txt`                    |                  | Title             | App name           | 30     |
| `ar/app-store-name.txt`          | Name             |                   |                    | 30     |
| `ar/subtitle.txt`                | Subtitle         |                   |                    | 30     |
| `ar/short-description.txt`       | Promotional text | Short description | Brief introduction | 80     |
| `ar/description.txt`             | Description      | Full description  | Introduction       | 4000   |
| `ar/keywords.txt`                | Keywords         |                   |                    | 100    |
| `release-notes/<version>/ar.txt` | What's New       | Release notes     | New features       | 500    |
| `review-notes/app-store.txt`     | App Review notes |                   |                    | 4000   |
| `review-notes/appgallery.txt`    |                  |                   | Remarks            | 10–300 |

Limits are in characters. App Store names are unique across the store, which is why the App Store name differs.

`store.json` also holds the App Store support, marketing and privacy links, and the AppGallery app ID.

## Images

Under `screenshots/<store>/<language>/`, shown in file name order:

| Folder                                  | Contents                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `app-store/ar/iphone`                   | 1 to 10 iPhone screenshots (1206x2622 or another size App Store Connect takes) |
| `app-store/ar/ipad`                     | Up to 10 iPad screenshots (2064x2752, either way round)                        |
| `google-play/ar/icon.png`               | The 512x512 store icon                                                         |
| `google-play/ar/feature-graphic.png`    | The 1024x500 feature graphic                                                   |
| `google-play/ar/phone`                  | 2 to 8 phone screenshots                                                       |
| `google-play/ar/seven-inch`, `ten-inch` | Up to 8 tablet screenshots each                                                |
| `appgallery/ar/icon.png`                | The 216x216 store icon                                                         |
| `appgallery/ar/phone`                   | 3 to 5 phone screenshots                                                       |

Google Play and AppGallery receive only images that changed. The App Store's screenshots are replaced on each release. The app icon itself comes from the app, not from here.
