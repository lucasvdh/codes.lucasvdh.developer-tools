---
description: What App Insights for Developers exposes to your flows
---

# Features

Each app you add through the pairing wizard becomes a virtual device with the capabilities and triggers listed below.

## Per-app capabilities

| Capability | Description |
|-|-|
| `installs` | Total installs across cloud and local. |
| `installs_cloud` | Installs on Homey Cloud. |
| `installs_local` | Installs on Homey Pro. |
| `live_version` | The current live (public) version, e.g. `1.2.3`. |
| `test_version` | The current test version, if any. |
| `live_build_installs` | Number of installs on the live build. |
| `live_build_crashes` | Crash count for the live build. |
| `live_build_state` | State string for the live build, e.g. `published`. |
| `test_build_installs` | Number of installs on the current test build. |
| `test_build_crashes` | Crash count for the current test build. |
| `test_build_state` | State string for the test build, e.g. `test`, `reviewed_rejected`. |

## Per-app flow triggers

These triggers require a Homey App device as their argument.

- Number of app installs changed
- Number of cloud app installs changed
- Number of local app installs changed
- The number of app crashes of the live build has changed
- The state of the live build has changed
- A new live version has been released
- The number of app crashes of the test build has changed
- The state of the test build has changed
- A new test version has been released
- A review of the test version has failed

Each provides relevant tokens: the new value, the delta versus the previous value, version strings, and so on.

## Global flow triggers

These are not bound to a specific app and fire across all tracked apps.

- Number of installs for an app changed (token: app name)
- Number of cloud installs for an app changed
- Number of local installs for an app changed
- A new live version for an app has been released
- A new test version for an app has been released
- A review of a test version of an app has failed
- Total number of installs across all apps changed
- Total number of cloud installs across all apps changed
- Total number of local installs across all apps changed

## Global flow tokens

Always available in the flow token picker:

- **Total Installs** - sum of installs across every tracked app.
- **Total Cloud Installs** - sum of cloud-only installs.
- **Total Local Installs** - sum of local-only installs.
