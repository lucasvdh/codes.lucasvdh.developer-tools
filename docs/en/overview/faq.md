---
description: Frequently asked questions about App Insights for Developers
---

# FAQ

## Is this app officially supported by Athom?

No. App Insights for Developers is an independent community app. It uses the same public Athom API that the official Developer Tools website uses, but it is not built or endorsed by Athom.

## Which apps can I track?

Any app you have published on the Homey App Store under the Athom developer account whose refresh token you supplied. Both test and live versions are visible.

## How do I get the refresh token?

See [Getting your refresh token](../configuration/authorisation.md) for the step-by-step.

## My data is not updating - what should I check?

1. Make sure the **OAuth Refresh Token** field in the app's settings is filled in.
2. Confirm the token is still valid by re-running the steps in [Getting your refresh token](../configuration/authorisation.md). If the app no longer receives updates, fetching a fresh token from `tools.developer.homey.app` is the most reliable fix.
3. Remember that polling runs every 15 minutes by default. Adjust **Polling Frequency** in the app's settings if you want faster updates (the lower bound is 1 minute, but be considerate of the Athom API).

## Will there ever be a "Login with Athom" button instead of pasting a token?

Only if Athom publishes a public OAuth client for the apps API and whitelists the Homey callback URL. Until then, manually copying the refresh token is the only supported route.

## How is my refresh token stored?

The token is saved in the Homey app's settings store, which lives on your Homey Pro. It never leaves your Homey except as part of authenticated requests to `api.athom.com`.

## Where do I report issues or request features?

On [GitHub](https://github.com/lucasvdh/codes.lucasvdh.developer-tools/issues).

## I want to contribute. Where do I start?

The source is on [GitHub](https://github.com/lucasvdh/codes.lucasvdh.developer-tools). Fork it, run `npm install` and `npx homey app run`, and open a pull request when you have something to share.
