# Contributing

This repository is the reviewable source for QR + UTM Studio. Tagged-link construction and QR generation must stay deterministic, browser-local, and truthful about their evidence boundary.

## Development

1. Use Node 24.20.0 and npm 11.19.1. The quality gate also runs on Node 22.12.0.
2. Run `npm ci --ignore-scripts`.
3. Install the test browser once with `npx playwright install chromium`.
4. Run `npm run check` before opening a pull request.

The product itself remains dependency-free static HTML, CSS, JavaScript, fonts, and a vendored QR encoder. npm dependencies exist only for repeatable verification.

## Change boundaries

- Do not navigate to or transmit destination URLs, campaign fields, tagged URLs, or campaign-log entries.
- Do not change UTM sanitization, URL construction, QR encoding, checkout, or paid-tier behavior without focused tests and plain-language documentation.
- Do not embed live payment links, secrets, fabricated outcomes, or guaranteed analytics claims.
- Keep campaign-log persistence explicit, local, and user-controlled.
- Treat hosted CI, deployment, adoption, customer use, purchases, and revenue as separate evidence gates.
