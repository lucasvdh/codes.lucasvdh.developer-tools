---
description: How to obtain the refresh token that App Insights for Developers needs
---

# Getting your refresh token

App Insights for Developers uses the same authentication as the official Athom Developer Tools website. To let the app read your app statistics, you supply it with the refresh token from your own logged-in session on that website.

The token is tied to your Athom developer account, is stored only in the app's settings on your Homey, and is only sent to Athom's own API endpoints (`api.athom.com` and `apps-api.athom.com`).

## Step-by-step

You will need a desktop browser (Chrome, Edge, Firefox or Safari) for this. Mobile browsers do not expose the developer tools needed to copy the token.

### 1. Log in to the Athom Developer Tools

Go to [tools.developer.homey.app](https://tools.developer.homey.app) and log in with the same Athom account that owns the apps you want to track.

### 2. Open your browser's developer tools

Press <kbd>F12</kbd> (Windows / Linux) or <kbd>⌥</kbd><kbd>⌘</kbd><kbd>I</kbd> (macOS). A panel opens at the side or bottom of your window.

### 3. Find the refresh token in Local Storage

- **Chrome / Edge / Brave**: open the **Application** tab → in the left sidebar expand **Local Storage** → click **`https://tools.developer.homey.app`**.
- **Firefox**: open the **Storage** tab → expand **Local Storage** → click **`https://tools.developer.homey.app`**.
- **Safari**: enable the Develop menu in **Settings → Advanced**, then open **Develop → Show Web Inspector → Storage → Local Storage**.

In the table that appears, look for the row whose key is `refreshToken`. Click the value cell and copy the value (it is a long string of letters and digits).

### 4. Paste it into the app

On your Homey, open **App Insights for Developers → Configure App**. Paste the value into the **OAuth Refresh Token** field and press **Save**.

The app will validate the token on the next polling cycle. From that point on it can fetch your app statistics, and you can start adding apps as devices.

## How long does the token stay valid?

In practice, once configured the token keeps working for a long time and you should rarely need to repeat the steps above. If the app stops receiving updates, the most reliable fix is simply to fetch a fresh token from `tools.developer.homey.app` and paste it again.

There is no user-facing way to explicitly revoke the token from the Athom Developer Tools website. Signing out there clears the value from your browser, but does not invalidate the copy stored on your Homey.

## Why is there no "Log in with Athom" button?

Homey apps can only use OAuth login when the OAuth provider has whitelisted the Homey callback URL. Athom does not currently offer a public OAuth client for the apps API, so manually copying the refresh token is the only available option.

If Athom releases a public OAuth client in the future, a one-click login will be added in a later version of this app.

## Troubleshooting

**I do not see `refreshToken` under Local Storage.**
Make sure you are signed in to tools.developer.homey.app - log in first and refresh the page.

**Capabilities stay at zero / "none" after pairing.**
The app polls every 15 minutes (configurable). The first values arrive after one polling cycle. If they remain empty after 30 minutes, the token is likely invalid - repeat the steps above.

**My token starts working but suddenly stops.**
Refresh tokens can become invalid for various reasons (for example after an Athom account change). Log back in to `tools.developer.homey.app` to get a fresh value and repeat the steps above.
