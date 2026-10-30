# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each release lists the changes in English first, then in Chinese.  
每个版本的变更先列英文、再列中文。

## [0.2.4] - 2026-10-30

### Added

- Host capability detection: a missing plugin-manager namespace or a removed
  Remote method (`installBundle`, `removeBundle`, `listBundles`) now surfaces as a
  localized, dismissible "plugin manager is not available" banner, and an update
  attempt on such a host becomes a normal failed row instead of an obscure
  exception.

### Changed

- CI workflows pin `actions/checkout` and `actions/setup-node` to immutable commit
  SHAs (v7); Dependabot keeps the pins current.
- `engines.node` now matches the tested LTS lines (`>=22`).
- README verification wording: the visible-page auto re-check was verified on the
  real UI with the interval temporarily scaled to 15 seconds; the production
  30-minute interval was not waited out (the policy is unit-tested).

### 新增

- 宿主能力探测：插件管理器命名空间缺失，或 Remote 方法（`installBundle`、`removeBundle`、`listBundles`）被删除时，面板显示本地化、可关闭的「插件管理器不可用」横幅；此情形下的更新会记录为普通失败行，而不是抛出难以理解的异常。

### 变更

- CI workflow 将 `actions/checkout` 与 `actions/setup-node` 固定到不可变 commit SHA（v7），由 Dependabot 负责更新。
- `engines.node` 调整为与测试矩阵一致的 `>=22`。
- README 验收措辞修正：可见页自动复查已在真机用 15 秒缩放间隔验证；正式 30 分钟间隔未做长时等待（调度策略由单测覆盖）。

## [0.2.3] - 2026-10-30

### Changed

- Bilingual documentation: the README now documents every section in English and
  Chinese, and the CHANGELOG entries are bilingual (no runtime changes, docs-only
  release so the npm page carries the bilingual docs).

### 变更

- 文档中英双语：README 的每个章节同时提供英文与中文，CHANGELOG 条目也改为中英双语（无运行时改动，纯文档版本，便于 npm 页面展示双语文档）。

## [0.2.2] - 2026-10-30

### Added

- Visible-page auto re-check: while the page is visible the panel re-checks every
  30 minutes. Hidden pages pause the timer; returning to the page catches up
  immediately when the result is due, and a reconnect retries a failed check. The
  scheduling policy lives in `lib/src/schedule.js` and is unit-tested (7 cases).

### Changed

- README and SECURITY describe the periodic check, its visibility behaviour and
  the timer lifetime.
- Release automation: pushing a `v*` tag now verifies the tree, creates the GitHub
  Release from the matching CHANGELOG section, and publishes to npm through npm
  Trusted Publishing (OIDC) with provenance — no long-lived npm secret.

### 新增

- 可见页自动复查：页面可见时每 30 分钟自动复查一次；隐藏时暂停计时器，回到页面且已过期时立即补查，断网恢复时重试失败的检查。调度策略在 `lib/src/schedule.js` 中，由单测覆盖（7 个用例）。

### 变更

- README 与 SECURITY 补充自动复查、可见性行为与定时器生命周期说明。
- 发布自动化：推送 `v*` tag 会校验代码、用 CHANGELOG 对应版本创建 GitHub Release，并通过 npm Trusted Publishing（OIDC）带 provenance 发布到 npm——仓库不保存长期 npm secret。

## [0.2.1] - 2026-10-29

First public release (`@moyumole/dsh-plugin-updates`).

### Added

- Right-sidebar Guide card and page tab for plugin updates, with an update badge
  on the Guide capsule and the tab title.
- A global "Plugin updates" tab on the Plugins page, available without an open
  Session.
- A red update badge on the existing left-sidebar "Plugins" icon (the pinwheel
  icon and its click behaviour are preserved).
- Automatic update check on page load, manual refresh, and a 10-minute registry
  cache with npmjs → npmmirror fallback.
- One-click update and update-all through the official plugin manager
  (`removeBundle` → `installBundle(name@latest)`), with inline confirmation and a
  best-effort rollback to the previous version when an install fails.
- Progress line and progress bar during updates; success/failure/rollback/batch
  toasts in the host's top-center position (auto-dismiss, dismissible).
- DSH-identical compatibility rules (`engines.dsh`, then `@deepseek-ai/dsh*`
  peers, prereleases included) with incompatible versions blocked by default.
- Chinese and English UI copy.

### Security

- No runtime dependencies and no install hooks; publishing is gated by
  `prepublishOnly` (bundle-freshness check + full test suite).
- Registry package names are validated against the npm grammar and
  percent-encoded before entering a URL; oversized manifests (`Content-Length`
  above 2 MB) are rejected before parsing.
- No `eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML`, shell or
  filesystem access in the shipped bundle; the only network endpoints are the two
  npm registries. See `SECURITY.md`.

### Verified

Windows + DSH 0.2.1-rc.3: single updates (`dsh-pet`, `dsh-better-sidebar`,
`dsh-whale-widget`), batch update (`dsh-context` + `dsh-whale-widget`), restart
prompt, and an uninstall that removes every slot registration.

### 新增

- 右侧栏「开始 / Guide」卡片与页面 tab，有可用更新时在 Guide 卡片和 tab 标题显示红点。
- 全局「插件更新」标签页（设置 → 插件），无需打开会话。
- 左侧栏「插件」图标红点（保留宿主 pinwheel 图标与点击行为）。
- 页面加载自动检查、手动刷新、10 分钟 registry 缓存（npmjs → npmmirror 回退）。
- 通过官方插件管理器一键更新/全部更新（`removeBundle` → `installBundle(name@latest)`，内联确认，失败时尽力回滚）。
- 更新阶段文案与进度条；成功/失败/回滚/批量 toast（宿主顶部居中、自动消失、可关闭）。
- 与 DSH 一致的兼容性规则（`engines.dsh`、`@deepseek-ai/dsh*` peers、含 prerelease）；不兼容版本默认禁止更新。
- 中文与英文界面文案。

### 安全

- 无运行时依赖、无安装钩子；发布由 `prepublishOnly`（生成物一致性 + 全量测试）把关。
- registry 包名按 npm 语法校验并 URL 编码；`Content-Length` 超过 2 MB 的 manifest 在解析前拒绝。
- 发布 bundle 中无 `eval`、`new Function`、`innerHTML`、`dangerouslySetInnerHTML`、shell 或文件系统访问；网络端点仅两个 npm registry。详见 `SECURITY.md`。

### 验证

Windows + DSH 0.2.1-rc.3：单个更新（`dsh-pet`、`dsh-better-sidebar`、`dsh-whale-widget`）、批量更新（`dsh-context` + `dsh-whale-widget`）、重启提示，以及卸载后无任何槽注册残留。
