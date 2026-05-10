---
description: How to obtain the Personal Access Token that App Insights for Developers needs
---

# Getting your Personal Access Token

App Insights for Developers reads your app statistics from Athom's apps API. To do so it needs your **Personal Access Token** (PAT) — the same token Athom provides for use with the Homey CLI in CI/CD environments.

Each Athom account has exactly one Personal Access Token. You can view it on your account page at any time, and regenerate it if you ever need to invalidate the previous value.

## Step-by-step

### 1. Open your account page

Go to [tools.developer.homey.app/me](https://tools.developer.homey.app/me) and sign in with the Athom account that owns the apps you want to track.

### 2. Copy the token

Scroll to the **Personal Access Token** section. The token is visible there — click the copy button next to it. The token starts with `pat-`.

### 3. Paste it into the app

On your Homey, open **App Insights for Developers → Configure App**. Paste the token into the **Personal Access Token** field, press **Test** to verify, then **Save**.

The Test button does a live call to Athom's API and reports how many apps the token sees. If it works, the rest of the app starts polling on the next cycle and your devices fill with data.

## Regenerating your token

If you want to invalidate the current token (for example if you suspect it leaked, or want to rotate it), press **Regenerate** in the Personal Access Token section on `tools.developer.homey.app/me`. Athom will show a new token in its place; the previous value stops working immediately.

After regenerating, anything else that was using the old token — Homey CLI in CI/CD, this app, or any other tool — needs to be updated with the new value.

## Why a Personal Access Token?

PATs are the official way Athom lets developers authenticate against their apps API. The token is scoped to the apps API only and identifies as a "Homey CLI" client to Athom, exactly like the official command-line tools.

## Troubleshooting

**The Test button reports "Request failed with status 401".**
The token is no longer accepted. The most likely cause is that it was regenerated on `tools.developer.homey.app/me` (manually, or by another tool that you reset). Copy the current token from there and paste it again.

**The Test button works but devices stay empty.**
The first values arrive on the next polling cycle (default 15 minutes). Lower the polling frequency in settings if you want faster feedback while testing.

**The Test button reports a network error.**
Your Homey could not reach `api.athom.com`. Check that the Homey has internet access and try again.
