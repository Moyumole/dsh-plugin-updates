# Security policy

## Supported versions

| DSH (host) | This plugin | Status |
|---|---|---|
| 0.2.1-rc.3 | 0.2.x | Verified on Windows (desktop) |
| other 0.2.x | 0.2.x | Expected to work, not verified |
| other DSH versions | any | Unsupported (host extension points may change) |

## What this plugin can access

`@moyumole/dsh-plugin-updates` is an ordinary DSH bundle. Like any bundle it runs inside the
DSH host process and inside the DSH Web page, so review it with that trust model in
mind. Specifically:

- **Host half** (`lib/index.js`): empty `apply()`. No services, files, processes,
  timers or network access.
- **Browser half** (`lib/client.js`): registers UI through the host's slots
  (right-sidebar tab + Guide card, a `plugins.tab` entry, a shadow of the
  left-sidebar "Plugins" icon cell, and a `shell.overlay` toast), and calls only
  these official plugin-manager Remote methods:
  - `listBundles()` — read installed bundles
  - `removeBundle(name)` / `installBundle(spec, options)` — requested only after
    the user confirms an update in the panel

  It does **not** call filesystem, subprocess, credentials, settings, session, or
  agent APIs.
- **Network**: only HTTPS `GET` requests to
  `https://registry.npmjs.org/<name>/latest`, falling back to
  `https://registry.npmmirror.com/<name>/latest`. The only data sent is the npm
  package name of an installed third-party bundle (the same information DSH's own
  plugin page requests). No cookies, tokens, session content, prompts, or usage
  data are sent anywhere.
- **No telemetry, no analytics, no remote code loading.** The plugin fetches only
  JSON manifests and never executes fetched content.

## Defensive properties in the code

- Published to npm as `@moyumole/dsh-plugin-updates` with `publishConfig.access: public`; a
  `prepublishOnly` gate runs the tests and the bundle-freshness check before any publish.
- No runtime dependencies and no install hooks (`install`/`postinstall`/`prepare`
  are absent, so installing the package runs no scripts).
- The browser bundle is generated from `lib/src/*.js` and committed; CI fails when
  the two drift, so the reviewed sources are the bytes that run.
- Package names are validated against the npm name grammar before being placed in
  a registry URL, and names are percent-encoded (scoped names keep `@` and encode
  the slash), so a malformed name cannot alter the request path.
- Registry responses must be 2xx JSON objects with a string `version`; oversized
  manifests (`Content-Length` above 2 MB) are rejected before parsing to bound
  memory use.
- Versions are compared with a strict SemVer implementation; a non-SemVer
  `latest` is treated as "up to date" and cannot be installed.
- Updates require an explicit confirmation; bundles whose newest version does not
  satisfy the host's `engines.dsh` / `@deepseek-ai/dsh-*` peer rules are marked
  incompatible and cannot be updated from the panel.
- The install spec passed to the official manager is a single argv element
  (`name@version`) — no shell is involved.
- The UI renders only React text/attributes; there is no `innerHTML`,
  `dangerouslySetInnerHTML`, `eval`, or `new Function` in the browser bundle.
- The only long-lived timer is the toast auto-dismiss timeout; it is created and
  cleared inside a React effect. There is no polling and no background process.
- Uninstalling the plugin removes every slot registration and lets the host's own
  Plugins icon resume.

## Residual risks

- **Any DSH bundle is powerful.** This plugin is not sandboxed beyond DSH's normal
  plugin trust model; install it from a source you trust and pin the commit you
  reviewed.
- **Host extension points are not a stable public API.** The right-sidebar tab
  registry, `plugins.tab`, `sidebar.panellist` shadowing and
  `remote.pluginManager` may change between DSH releases. A host change can break
  the UI (it is written to degrade rather than crash the page), and a future host
  version may expose different behaviour.
- **Updating a plugin is a supply-chain action.** The panel only reports npm's
  `latest` and asks the official plugin manager to install it; it cannot verify
  the integrity or intent of the package it updates to. Review the target version
  before confirming, especially for major-version jumps.
- **Registry traffic reveals installed plugin names** to the registry you query
  (npmjs.org or npmmirror.com). No other information is exposed.

## Reporting a vulnerability

Please open a private security advisory on the repository
(https://github.com/Moyumole/dsh-plugin-updates/security/advisories/new) or a
regular issue if the report contains no sensitive details. Include the plugin
version, DSH version, reproduction steps, and impact. There is no paid bug bounty;
reports are handled on a best-effort basis.
