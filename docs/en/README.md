---
description: Documentation for the App Insights for Developers Homey app
---

# App Insights for Developers

App Insights for Developers is a Homey app that lets you track the apps you publish on the Homey App Store directly from your Homey. Each app becomes a virtual device with live statistics - installs, versions, build state and crashes - which you can use as triggers, conditions and tokens in flows.

Typical things you can build:

- A notification on your phone the moment a new live version of your app is released.
- A push alert when a test review fails.
- A daily summary of total installs across all your apps.
- A counter that updates when crashes go up.

This is an independent community app. It is not affiliated with or endorsed by Athom.

## Links

- [Install on the Homey App Store](https://homey.app/a/codes.lucasvdh.developer-tools)
- [Source code on GitHub](https://github.com/lucasvdh/codes.lucasvdh.developer-tools)
- [Report an issue](https://github.com/lucasvdh/codes.lucasvdh.developer-tools/issues)

## Getting started

1. [Install the app](configuration/installation.md) on your Homey.
2. [Get a Personal Access Token](configuration/authorisation.md) from your Athom developer account and enter it in the app's settings.
3. Add your published apps as devices through the pairing flow.
4. Build flows using the new triggers and tokens - see [Features](overview/features.md) for the full list.
