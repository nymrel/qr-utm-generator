# Security policy

## Supported version

Security fixes target the current `main` branch. This source repository does not itself prove what is deployed at nymrel.com.

## Reporting a vulnerability

Email `contact@nymrel.com` with the affected path, reproduction steps, impact, and any suggested mitigation. Please do not open a public issue for an unpatched vulnerability or include real customer destinations, campaign data, checkout data, or credentials in a report.

## Security boundary

QR + UTM Studio constructs tagged links and QR images in the browser. It must not navigate to or transmit entered destination URLs, campaign fields, tagged URLs, or campaign-log entries. Entries are persisted to local storage only when a user saves them to the campaign log. The hosted page loads aggregate Vercel Web Analytics, but product values must never be attached to analytics or other network requests.

Checkout verification and paid artifact delivery are separate server-backed boundaries. Verification must fail closed when its verifier is unavailable.

There is no public bug-bounty promise. We will acknowledge actionable reports and coordinate remediation proportionate to the issue.
