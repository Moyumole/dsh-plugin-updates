# Contributing

Thanks for taking a look at `dsh-plugin-updates`! This is a small, dependency-free
DSH bundle, so contributing is usually straightforward.

## Development setup

```powershell
git clone https://github.com/Moyumole/dsh-plugin-updates.git
cd dsh-plugin-updates
node scripts/build-client.mjs         # regenerate lib/client.js from lib/src/*.js
node scripts/build-client.mjs --check # must be up to date before committing
node --test test/*.test.mjs           # full test suite (100 cases)
```

There is no `npm install`: the package has no runtime or dev dependencies, and
`lib/client.js` is a committed generated file. Edit `lib/src/*.js`, never
`lib/client.js`; regenerate the bundle and commit it together with the sources.

## Pull requests

- Keep changes focused: one behaviour per pull request.
- Add or update tests in `test/` — the project follows the existing
  `node:test` style and aims for observable behaviour, not implementation detail.
- The CI matrix runs Node 22 and 24. Do not lower `engines.node` below 22 without
  a concrete reason.
- Update `README.md` (both the English and Chinese sections) and `CHANGELOG.md`
  (both languages) when a behaviour changes.
- The browser bundle must match its sources: `node scripts/build-client.mjs
  --check` has to pass.

## Security issues

Please do **not** open a public issue for a vulnerability. Use the private
advisory flow described in [SECURITY.md](./SECURITY.md).

## Releases

Maintainers release by bumping `package.json` + `CHANGELOG.md` and pushing a `v*`
tag; the `release.yml` workflow publishes to npm through Trusted Publishing and
creates the GitHub Release. See the "Releasing (maintainers)" section of the
README for details.

---

# 贡献指南

感谢关注 `dsh-plugin-updates`。这是一个零依赖的小型 DSH bundle，参与贡献通常很直接。

## 开发环境

```powershell
git clone https://github.com/Moyumole/dsh-plugin-updates.git
cd dsh-plugin-updates
node scripts/build-client.mjs         # 由 lib/src/*.js 重新生成 lib/client.js
node scripts/build-client.mjs --check # 提交前要求生成物与源码一致
node --test test/*.test.mjs           # 全量测试（100 项）
```

无需 `npm install`：本包没有任何运行时/开发依赖，`lib/client.js` 是随仓库提交的生成物。请修改 `lib/src/*.js`（不要直接改 `lib/client.js`），重新生成 bundle 后与源码一起提交。

## Pull Request

- 保持改动聚焦：一个 PR 只做一件事。
- 在 `test/` 中补充或更新测试，沿用现有 `node:test` 风格，优先测试可观察行为而不是实现细节。
- CI 矩阵为 Node 22 / 24；没有特别理由不要把 `engines.node` 降到 22 以下。
- 行为变化时同步更新 `README.md`（英文与中文两部分）和 `CHANGELOG.md`（双语）。
- 浏览器 bundle 必须与源码一致：`node scripts/build-client.mjs --check` 必须通过。

## 安全问题

发现漏洞请**不要**开公开 issue，请按 [SECURITY.md](./SECURITY.md) 中的私密报告流程处理。

## 发布

维护者发布流程：修改 `package.json` 版本与 `CHANGELOG.md`，推送 `v*` tag；`release.yml` 会通过 Trusted Publishing 发布 npm 并创建 GitHub Release。详见 README 的「发布（维护者）」章节。
