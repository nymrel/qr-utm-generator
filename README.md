# QR + UTM Studio

Make a QR code with campaign tracking built into the link, so you know which flyer,
menu, or sign brought someone in.

**Use it:** https://nymrel.com/tools/qr-utm-generator

## What it does

A plain QR code tells you nothing about where the scan came from. This tool attaches
UTM parameters to the destination before it draws the code, so every printed placement
shows up as its own source in your analytics. Fill in the link and the campaign, and
download the code.

No account, no email gate, no trial clock.

## Run it locally

No build step and no dependencies. It is a static page.

```
git clone https://github.com/nymrel/qr-utm-generator.git
cd qr-utm-generator
python3 -m http.server 8000
```

Then open http://localhost:8000/tools/qr-utm-generator/

The page loads its stylesheet, script, and fonts from absolute paths (`/assets/...`),
so it needs a server rooted at the repo folder. Opening the HTML file straight from
disk will render unstyled.

## What is in here

| Path | What it is |
| --- | --- |
| `tools/qr-utm-generator/index.html` | The whole tool — markup, copy, and logic |
| `assets/vendor/qrcode.js` | The QR encoder |
| `assets/site.css`, `assets/site.js` | Shared styles and behavior across the Nymrel tools |
| `assets/pro/` | The paid-tier module, as shipped |
| `assets/checkout-config.js` | The checkout registry template |
| `assets/fonts/` | The three fonts the page uses |

`tools/qr-utm-generator/index.html` is byte-for-byte the file nymrel.com serves.

## A note on the paid tier

The page offers a paid tier. `assets/checkout-config.js` here is the committed template
with no payment links set, so in a local copy the upgrade button falls back to email.
The free tool produces a working, trackable code on its own.

## Privacy

Nothing you type leaves your browser. The code is drawn on your device and the tool
makes no server calls.

## Credits

`assets/vendor/qrcode.js` is the QR Code Generator for JavaScript by Kazuhiko Arase,
used under the MIT license. QR Code is a registered trademark of DENSO WAVE
INCORPORATED.

Instrument Serif, Instrument Sans, and IBM Plex Mono are used under the SIL Open
Font License.

## Who built it

[Nymrel](https://nymrel.com) — a software studio that builds and runs its own products.

## License

MIT. See [LICENSE](LICENSE).
