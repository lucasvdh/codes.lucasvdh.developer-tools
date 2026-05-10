---
description: Release notes for App Insights for Developers
---

# Changelog

## 1.1.0

- Renamed the app from "Developer Tools" to "App Insights for Developers".
- New app store images and a new driver image.
- Fixed cloud and local total-installs triggers that reported the wrong install count token.
- Fixed the title of the "local app installs changed" trigger (it said "cloud").
- Fixed retry behaviour when the Athom API call fails.
- Polling now runs immediately on app start and updates when the polling frequency setting is changed (no app restart needed).
- Refresh token is re-validated immediately after saving in settings.
- The delegated JWT used for API requests now respects its expiry instead of being cached forever.
- HTTP 4xx and 5xx responses now reject cleanly with a descriptive error.
- In-app pairing and settings screens now show step-by-step instructions for getting a refresh token.
- Removed two unused changelog-related flow triggers that never fired.

## 1.0.1

- Fix invalid value for the `version` flow token when an app had no live or test version yet.

## 1.0.0

- First public release.
