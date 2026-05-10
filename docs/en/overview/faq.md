---
description: Frequently asked questions about App Insights for Developers
---

# FAQ

## Is this app officially supported by Athom?

No. App Insights for Developers is an independent community app. It uses the official Athom apps API with a Personal Access Token issued by Athom on your account, but the app itself is not built or endorsed by Athom.

## Which apps can I track?

Any app you have published on the Homey App Store under the Athom developer account whose Personal Access Token you supplied. Both test and live versions are visible.

## How do I get the token?

See [Getting your Personal Access Token](../configuration/authorisation.md) for the step-by-step.

## My data is not updating - what should I check?

1. Open the app's settings and press the **Test** button. It tells you immediately whether the token is still valid.
2. If the test reports an error, create a new token on [tools.developer.homey.app/me](https://tools.developer.homey.app/me) and paste it into the app.
3. Polling runs every 15 minutes by default. Adjust **Polling Frequency** in the app's settings if you want faster updates (the lower bound is 1 minute, but be considerate of the Athom API).

## How is my Personal Access Token stored?

The token is saved in the Homey app's settings store, which lives on your Homey Pro. It never leaves your Homey except as part of authenticated requests to `api.athom.com` and `apps-api.athom.com`.

## Can I revoke the token if I want to stop using the app?

Yes. Open [tools.developer.homey.app/me](https://tools.developer.homey.app/me) and press **Regenerate** in the Personal Access Token section. The previous token stops working immediately. Note that this also breaks any other tool that was using the same PAT (such as the Homey CLI in CI/CD), since each Athom account has only one Personal Access Token.

## Where do I report issues or request features?

On [GitHub](https://github.com/lucasvdh/codes.lucasvdh.developer-tools/issues).

## I want to contribute. Where do I start?

The source is on [GitHub](https://github.com/lucasvdh/codes.lucasvdh.developer-tools). Fork it, run `npm install` and `npx homey app run`, and open a pull request when you have something to share.
