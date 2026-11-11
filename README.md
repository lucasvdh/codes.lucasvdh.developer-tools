# App Insights for Developers

A Homey app that turns each of your published Homey apps into a virtual device, exposing live statistics (installs, version numbers, build state, crashes) as capabilities and flow tokens. Apps of the Developer Organizations you belong to are included as well.

For developers with several apps there is also an App overview device per account, with the total installs, the installs of every app and Flow triggers for any app whose installs go up or down. You choose which of your Developer Organizations it includes.

The App overview also powers six dashboard widgets: App Installs, Install Trend, Recent Changes, Organization Overview, App Spotlight and Milestones.

This is an independent community app. It is not affiliated with or endorsed by Athom.

## Documentation

- [User guide & token setup](https://homey-developer-tools.gitbook.io/en/)
- [App Store page](https://homey.app/a/codes.lucasvdh.developer-tools)

## Development

```bash
npm install
npm run build           # tsc
npx homey app run       # run the app on your Homey
npx homey app validate  # validate the manifest
```

Contributions are welcome - feel free to open an issue or pull request.
