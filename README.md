# dsh-plugin-updates

[![test](https://github.com/Moyumole/dsh-plugin-updates/actions/workflows/test.yml/badge.svg)](https://github.com/Moyumole/dsh-plugin-updates/actions/workflows/test.yml)
[![npm](https://img.shields.io/npm/v/@moyumole/dsh-plugin-updates.svg)](https://www.npmjs.com/package/@moyumole/dsh-plugin-updates)

在 DSH（DeepSeek Harness）内检查当前 profile 中**第三方插件**的 npm 新版本，并在面板里一键更新。

> A lightweight DSH plugin that checks the third-party plugin bundles installed in your profile against npm and updates them in place — with a right-sidebar page, a Plugins-page tab, and a left-sidebar badge.
>
> Repository: <https://github.com/Moyumole/dsh-plugin-updates> · Security: [SECURITY.md](./SECURITY.md)

## 功能

- **三处入口，同一个面板**
  - 右侧栏「开始 / Guide」→「插件更新」卡片（有可用更新时卡片和 tab 标题显示红点）
  - 「设置 → 插件」页顶部的「插件更新」标签（全局，无需打开会话）
  - 左侧栏「插件」图标右上角红点（点击仍进入「插件」页）
- **检查**：页面加载时自动检查一次；**页面可见时每 30 分钟自动再检查一次**（切到后台暂停，回到前台若已过期立即补一次）；也支持手动「刷新」；npm registry 结果缓存 10 分钟；只检查 `official !== true`、`availability === 'profile'`、`installed === true` 的第三方 bundle，并排除本插件自身
- **更新**：单个「更新」或「全部更新」；通过 DSH 官方插件管理器执行 `removeBundle` → `installBundle(name@latest, { enabled })`
- **进度与提示**：更新时显示阶段文案（移除旧版 / 安装新版 / 应用 / 回滚）与进度条（单个为不确定进度，全部更新为 done/total）；结束时顶部居中弹出结果 toast（成功 / 失败 / 回滚 / 批量汇总，约 5-6 秒自动消失、可手动关闭）
- **失败处理**：安装失败时尽力回滚到旧版本；回滚也失败时保留可关闭的错误提示，并重新读取真实安装状态，保证 UI 与磁盘一致
- **不常驻**：无后台进程、无服务、无计划任务；30 分钟定时器只在页面可见时存在（隐藏即清除）；不自动重启 DSH

## 类别与兼容性

- **类别**：UI & Experience（面向插件管理）
- **验证目标**：DSH `0.2.1-rc.3`（Windows Desktop）
- **插件版本**：`0.2.x`（见 [CHANGELOG.md](./CHANGELOG.md)）
- **支持的 profile**：`desktop` / `web` 均可（示例命令用 `--profile web`，按你的 profile 名替换）

| DSH 版本 | 状态 |
|---|---|
| `0.2.1-rc.3` | ✅ 真机验证（Windows） |
| 其他 `0.2.x` | ⚠️ 预期可用，未逐一验证 |
| 其他版本 | ❌ 不保证 |

> ⚠️ 本插件使用了宿主的**非公开扩展点**（右侧栏 tab 注册、`plugins.tab` 槽、`sidebar.panellist` 覆盖、`remote.pluginManager`）。DSH 升级后这些接口可能变化，UI 做了降级处理但功能可能受影响；使用前请以实际运行验证为准。

## 安装

### 从 npm 安装（推荐）

```powershell
dsh plugin --profile web add "@moyumole/dsh-plugin-updates"
```

或在「设置 → 插件 → 添加插件」里输入包名 `@moyumole/dsh-plugin-updates`。

### 从 GitHub 安装（锁版本）

```powershell
dsh plugin --profile web add "github:Moyumole/dsh-plugin-updates#v0.2.1"
```

仓库根目录就是插件目录，`lib/client.js` 已随仓库提交，安装时**不需要构建**。

### 本地目录（开发调试）

```powershell
dsh plugin --profile web add "<本机路径>/dsh-plugin-updates"
```

安装会以 `link:` 依赖写入 profile 并加入 bundle 列表。

## 使用

1. 打开任意会话 → 右侧栏 →「开始」→「插件更新」；或
2. 「设置 → 插件」→ 顶部「插件更新」；或
3. 点击左侧栏「插件」图标（有更新时带红点）→ 顶部「插件更新」。

| 状态 | 展示 |
|---|---|
| 有更新 | 当前版本 → 最新版本，「更新」按钮可用 |
| 已最新 | 状态「已最新」，无按钮 |
| 不兼容 | 最新版 `engines.dsh` / `@deepseek-ai/dsh-*` peer 范围不接受当前 DSH 版本；默认禁用更新按钮 |
| 检查失败 | 只把该行标为失败，其他行不受影响；顶部网络失败可重试并保留上次结果 |
| 非 npm 来源 | `source` 不是 npm 依赖（git / 本地路径等）时标为「不支持一键更新」 |

更新流程：`removeBundle(name)` → `installBundle(name@latest, { enabled })`。
更新会真实改动 profile 的 `package.json` / `pnpm-lock.yaml` 与 `node_modules`，且移除再安装期间该插件短暂不可用；被更新插件的浏览器端代码通常在刷新或重启 DSH 后生效。**更新前请确认目标版本**（更新本质上是 npm 供应链操作）。

## 截图

待补充（维护者计划用**干净的测试 profile** 截取：面板列表、顶部 toast、右侧栏 Guide 卡片）。截图不得包含个人插件列表、会话标题或本机路径。

## 权限与外部服务

- **权限**：不申请任何 DSH 权限；Host 半边为空，仅浏览器半边注册 UI
- **外部服务**：仅读取 npm registry（`registry.npmjs.org`，失败回退 `registry.npmmirror.com`）的 `<name>/latest`；只发送已安装第三方插件的包名
- **本地操作**：更新经由 DSH 官方插件管理器执行；本插件不直接执行 shell、不写文件
- **遥测**：无
- 完整威胁模型与残余风险见 [SECURITY.md](./SECURITY.md)

## 验收状态（诚实声明）

在 Windows + DSH `0.2.1-rc.3` 上已完成真机验证：

- [x] 页面加载后自动检查并显示结果；页面可见时每 30 分钟自动复查（隐藏暂停、回前台补查）；手动刷新、10 分钟缓存
- [ ] 30 分钟自动复查的真机长时验证（调度策略由 `test/schedule.test.mjs` 单测覆盖）
- [x] 正确识别第三方插件新版本（`dsh-better-sidebar`、`dsh-pet`、`dsh-context`、`dsh-whale-widget`）
- [x] 真机更新：`dsh-pet 0.3.7→0.3.8`、`dsh-better-sidebar 0.28.1→0.28.2`、`dsh-whale-widget 0.4.1→0.4.2`，磁盘 `package.json` / `node_modules` / `pnpm-lock.yaml` 一致，其他插件未受影响
- [x] 真机「全部更新」批量：`dsh-context 0.77.0→0.78.1` + `dsh-whale-widget 0.4.1→0.4.2`，批量进度（1/2→2/2）与顶部汇总 toast 正常
- [x] 右侧栏 tab、插件页 tab、左侧栏红点、Guide 卡片点击、进度条、成功/失败/批量 toast
- [x] 无新增后台进程、计划任务或开机项（代码层面）
- [x] 卸载后 profile 与槽注册无残留（最新版复验：右侧栏 3 个槽 + 插件页 tab + 左侧栏图标覆盖全部回收，宿主图标恢复）
- [ ] 真机「安装失败 → 回滚」路径（当前由单元测试覆盖；故障注入对真实环境有破坏性，暂不做）
- [ ] Linux / macOS、其他 DSH 版本

自动化测试：`node --test test/*.test.mjs`（100 项，覆盖版本比较、兼容性、registry 回退/缓存/输入加固、行构建、controller 状态机与回滚、自动复查调度策略、UI 渲染与样式约束、bundle 一致性）；CI 还会校验生成物与源码一致。

## 已知限制

- 右侧栏是按会话存在的列：没有打开会话时请用「设置 → 插件 → 插件更新」。
- 左侧栏红点通过遮蔽宿主「插件」图标单元实现（`sidebar.panellist` 的 `plugins` 单元，`priority: -1`）；宿主大改该图标时外观需要同步，功能不受影响。
- 只支持 npm registry（官方源 + npmmirror 回退），不支持私有 registry。
- 不检查、不更新 DSH 本体；不管理官方随附 bundle（`@deepseek-ai/*`）。
- 不列出本插件自身（避免更新过程中面板消失）；如需更新本插件请用官方插件页。
- 不自动重启 DSH；刷新页面后检查结果会重新获取（缓存仅保存在内存）。自动复查只在页面可见时进行，后台标签页不消耗资源。
- 更新失败回滚依赖官方插件管理器对 `package.json` / lockfile 的恢复语义；回滚失败属于不可恢复场景，需要手动重装。

## 开发

```powershell
cd dsh-plugin-updates
node scripts/build-client.mjs        # 由 lib/src/*.js 生成 lib/client.js（浏览器单文件 bundle）
node scripts/build-client.mjs --check # 校验生成物是否最新
node --test test/*.test.mjs          # 单元/UI/bundle 一致性测试
node scripts/preview-rows.mjs 0.2.1-rc.3  # 用真实 profile + registry 打印面板会显示的行
```

为什么浏览器端是生成物：DSH 的客户端加载器每个包只加载一个 `./client` 入口文件，无法在运行时 `import` 同包的其他文件。`lib/src/*.js` 是可单测的普通 ESM，构建脚本只做「剥掉 import/export + 拼接」，不引入任何打包器或第三方依赖；生成后的 `lib/client.js` 直接提交，安装时无需构建。CI 与 `prepublishOnly` 会校验生成物与源码一致。

源码结构：

| 文件 | 职责 |
|---|---|
| `lib/index.js` | Host 半边：空 `apply()`，只作为 bundle 挂载点 |
| `lib/src/entry.js` | 槽注册与接线（右侧栏 tab / Guide 卡片 / 插件页 tab / 左侧栏红点 / toast） |
| `lib/src/controller.js` | 面板状态机、Remote 调用、回滚、进度与 toast |
| `lib/src/rows.js` | BundleInfo + registry manifest → 列表行 |
| `lib/src/registry.js` | npm registry 拉取、校验与 10 分钟缓存 |
| `lib/src/compatibility.js` | `engines.dsh` / peer 兼容性判定 |
| `lib/src/semver.js` | 版本与范围比较（includePrerelease） |
| `lib/src/i18n.js` | 中英文字典 |
| `lib/src/ui.js` | React 面板、Guide 卡片、tab 标题、图标、toast |
| `lib/client.js` | **生成物**：上面所有 src 拼成的单文件浏览器 bundle |

## 发布（维护者）

```powershell
# 1. 校验并打包
node scripts/build-client.mjs --check
node --test test/*.test.mjs
npm pack --dry-run          # 检查发布内容（当前 12 个文件 / ~39 KB）

# 2. 登录并发布（Windows PowerShell 若报 npm.ps1 执行策略错误，就改用 npm.cmd）
npm.cmd login
npm.cmd publish             # prepublishOnly 会自动跑测试 + 生成物校验

# 3. 打 tag / 发 Release（Release 不会自动再次发布 npm；发布后再建 Release）
git tag vX.Y.Z              # 用 package.json 里的版本
git push origin main --tags
```

> CI 发布是**手动**的：GitHub Actions → `publish` → Run workflow（需要仓库 Secret `NPM_TOKEN`）。它使用 `npm publish --provenance`，并且当该版本已存在时会提示并安全跳过，因此创建 Release 不会触发重复发布。

> **npm 账号开启 2FA 时**：`npm publish` 会返回 `E403 ... Two-factor authentication ... required to publish`。两种解决方式：
> 1. 每次发布提供一次性验证码：`npm.cmd publish --otp=123456`；
> 2. 创建带 **Bypass 2FA** 的 Granular Access Token（npmjs.com → Access Tokens → Generate New Token → Granular Access Token，包范围选 `@moyumole`，权限 Read and write，勾选 bypass two-factor authentication），然后：
>    ```powershell
>    $env:NODE_AUTH_TOKEN = "npm_xxx"   # 只在当前终端有效
>    ```
>    并在项目根目录新建 `.npmrc`（已被 `.gitignore` 忽略，切勿提交）：
>    ```
>    //registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}
>    ```
>    GitHub Actions 发布则把同一个 token 配成仓库 Secret `NPM_TOKEN`。

发布后提交到社区插件市场（dsh-plugin.org）：仓库是公开的、根目录含 `package.json`、README 含安装命令，并给仓库加 **`dsh-plugin`** topic；再到 <https://dsh-plugin.org/submit> 按模板提 issue（类别填 UI & Experience）。收录后即可在 DSH 内置 Plugin Hub 里被搜索/一键安装。

## 安全与隐私

本插件是一个普通的 DSH bundle（宿主的正常插件信任模型，不做额外沙箱），但尽量收窄能力。完整说明见 [SECURITY.md](./SECURITY.md)。

## 卸载

在官方插件页移除 `@moyumole/dsh-plugin-updates`（或 `dsh plugin --profile web remove @moyumole/dsh-plugin-updates`）。右侧栏 tab 类型、插件页 tab、左侧栏图标覆盖、toast 槽注册与控制器都随插件卸载释放，无残留进程或后台任务。

## 第三方代码与许可

- 本项目代码以 MIT 许可发布，见 [LICENSE](./LICENSE)。
- 左侧栏「插件」图标复刻了 DSH 的 pinwheel 图形路径，来源为 `@deepseek-ai/dsh-client-ui-primitives`（MIT，Copyright (c) 2026 DeepSeek）；toast 的位置/尺寸参考了 DSH 前端自身的 toast 样式。详见 [NOTICE](./NOTICE)。
- 未包含 `dsh-better-sidebar`、`dsh-pet` 等第三方插件的代码；它们仅作为集成验证对象。

## License

MIT
