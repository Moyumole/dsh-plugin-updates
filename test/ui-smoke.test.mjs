/**
 * Smoke tests for the browser UI.
 *
 * The bundle hands React in from the Host and the sources are concatenated into
 * one function scope, so these tests load `lib/src/ui.js` as an ordinary module
 * after installing a stub React, `h`, `fill`, and `DICTS` on `globalThis`, and
 * then call the components as plain functions. That keeps the assertions on the
 * rendered tree and on the controller calls a click would make, without needing
 * a DOM or a React renderer.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DICTS, NS, dict, fill } from '../lib/src/i18n.js'

/** Every key the plan requires in both dictionaries, plus the notices addition. */
const REQUIRED_KEYS = [
  'guide.title',
  'guide.description',
  'tab.label',
  'panel.lastCheck',
  'panel.never',
  'panel.refresh',
  'panel.refreshing',
  'panel.checkFailed',
  'panel.retry',
  'panel.noPlugins',
  'panel.allUpToDate',
  'panel.summary',
  'panel.updateAll',
  'panel.updatingAll',
  'panel.restartBanner',
  'row.current',
  'row.latest',
  'row.update',
  'row.updating',
  'row.updatedRestart',
  'row.updatedApplied',
  'row.failed',
  'row.rolledBack',
  'row.rollbackFailed',
  'row.incompatible',
  'row.checkFailed',
  'row.unsupported',
  'row.latestLabel',
  'status.latest',
  'status.update',
  'status.incompatible',
  'status.failed',
  'status.unsupported',
  'confirm.title',
  'confirm.body',
  'confirm.update',
  'confirm.cancel',
  'error.noManager',
  'error.noRemote',
  'notice.dismiss',
  'progress.removing',
  'progress.installing',
  'progress.applying',
  'progress.rollingBack',
  'progress.cancelling',
  'progress.batch',
  'toast.updated',
  'toast.applied',
  'toast.rolledBack',
  'toast.failed',
  'toast.rollbackFailed',
  'toast.batch',
  'toast.close',
]

/* ------------------------------------------------------------------ stubs */

/** Minimal React shape: hooks return plain values, rendering stays synchronous. */
const ReactStub = {
  Fragment: 'Fragment',
  createElement(type, props) {
    const children = Array.prototype.slice.call(arguments, 2)
    const merged = Object.assign({}, props === null || props === undefined ? {} : props)
    merged.children = children
    return { type: type, props: merged }
  },
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, function () {}]
  },
  useEffect() {},
  useLayoutEffect() {},
  useMemo(factory) {
    return factory()
  },
  useCallback(callback) {
    return callback
  },
  useRef(value) {
    return { current: value }
  },
  // The Host also passes a server snapshot; accept and use it when needed.
  useSyncExternalStore(_subscribe, getSnapshot, getServerSnapshot) {
    if (typeof getSnapshot === 'function') return getSnapshot()
    return typeof getServerSnapshot === 'function' ? getServerSnapshot() : undefined
  },
}

globalThis.React = ReactStub
globalThis.h = ReactStub.createElement
globalThis.fill = fill
globalThis.DICTS = DICTS

const ui = await import('../lib/src/ui.js')

/* --------------------------------------------------------------- helpers */

const ROW_UPDATE = {
  name: 'dsh-pet',
  title: 'Pet',
  description: 'A desktop pet',
  currentVersion: '0.3.7',
  latestVersion: '0.3.8',
  status: 'update',
  source: 'dsh-pet@^0.3.7',
}
const ROW_LATEST = {
  name: 'dsh-whale-widget',
  title: 'Whale Widget',
  currentVersion: '0.4.2',
  latestVersion: '0.4.2',
  status: 'latest',
}
const ROW_INCOMPAT = {
  name: 'dsh-future',
  title: 'Future Plugin',
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  status: 'incompatible',
  requirements: { '@deepseek-ai/dsh': '^0.3.0' },
}
const ROW_FAILED = {
  name: 'dsh-broken',
  title: 'Broken Plugin',
  currentVersion: '1.0.0',
  latestVersion: null,
  status: 'failed',
  reason: 'HTTP 404',
}
const ROW_UNSUPPORTED = {
  name: 'local-plugin',
  title: 'Local Plugin',
  currentVersion: '0.0.1',
  latestVersion: null,
  status: 'unsupported',
}

/** A complete snapshot with the controller contract's defaults. */
function makeSnapshot(overrides) {
  return Object.assign(
    {
      phase: 'ready',
      lastCheckedAt: 1700000000000,
      runtimeVersion: '0.2.1-rc.3',
      error: null,
      rows: [],
      results: {},
      confirm: null,
      updatingAll: false,
      updateCount: 0,
      installPhase: null,
      busyName: null,
      batch: null,
      toast: null,
      notices: [],
    },
    overrides,
  )
}

/** Install a fake controller returning `snapshot`; returns the recorded calls. */
function installController(snapshot) {
  const calls = []
  const controller = {
    getSnapshot() {
      return snapshot
    },
    subscribe() {
      return function () {}
    },
    refresh() {
      calls.push(['refresh'])
    },
    requestUpdate(name) {
      calls.push(['requestUpdate', name])
    },
    cancelConfirm() {
      calls.push(['cancelConfirm'])
    },
    confirmUpdate() {
      calls.push(['confirmUpdate'])
    },
    updateAll() {
      calls.push(['updateAll'])
    },
    dismissResult(name) {
      calls.push(['dismissResult', name])
    },
    dismissError() {
      calls.push(['dismissError'])
    },
    dismissNotice(id) {
      calls.push(['dismissNotice', id])
    },
    dismissToast(id) {
      calls.push(['dismissToast', id])
    },
  }
  ui.setActiveController(controller)
  return calls
}

/** A fake `t` backed by one dictionary, echoing unknown keys as the Host would. */
function tFrom(table) {
  return function (key) {
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : key
  }
}

/** Walk the stub tree, invoking function components as plain functions. */
function descendants(node, out) {
  const result = out === undefined ? [] : out
  if (node === null || node === undefined || typeof node === 'boolean') return result
  if (typeof node === 'string' || typeof node === 'number') return result
  if (Array.isArray(node)) {
    for (const child of node) descendants(child, result)
    return result
  }
  if (typeof node !== 'object') return result
  if (typeof node.type === 'function') return descendants(node.type(node.props), result)
  result.push(node)
  descendants(node.props.children, result)
  return result
}

/** Rendered text, skipping `<style>` contents. */
function textOf(node, out) {
  const result = out === undefined ? [] : out
  if (node === null || node === undefined || typeof node === 'boolean') return result
  if (typeof node === 'string' || typeof node === 'number') {
    result.push(String(node))
    return result
  }
  if (Array.isArray(node)) {
    for (const child of node) textOf(child, result)
    return result
  }
  if (typeof node !== 'object') return result
  if (typeof node.type === 'function') return textOf(node.type(node.props), result)
  if (node.type === 'style') return result
  textOf(node.props.children, result)
  return result
}

function renderedText(tree) {
  return textOf(tree).join(' ')
}

function buttonsOf(tree) {
  return descendants(tree, []).filter((element) => element.type === 'button')
}

function labelOf(button) {
  return textOf(button.props.children).join('').trim()
}

function findButton(tree, predicate) {
  return buttonsOf(tree).find(predicate)
}

function hasClass(element, name) {
  return typeof element.props.className === 'string' && element.props.className.split(/\s+/).indexOf(name) !== -1
}

function includes(text, needle, hint) {
  assert.ok(
    text.indexOf(needle) !== -1,
    (hint === undefined ? '' : hint + ': ') + 'expected text ' + JSON.stringify(needle) + '\n--- rendered ---\n' + text,
  )
}

/** Mount the panel over one snapshot and return everything the assertions need. */
function mountPanel(overrides, propsOverrides) {
  const snapshot = makeSnapshot(overrides)
  const calls = installController(snapshot)
  const props = Object.assign({ t: tFrom(DICTS.en) }, propsOverrides)
  const tree = ui.UpdatePanel(props)
  const elements = descendants(tree, [])
  const css = elements
    .filter((element) => element.type === 'style')
    .map((element) => textOf(element.props.children).join(''))
    .join('\n')
  return { snapshot: snapshot, calls: calls, tree: tree, elements: elements, css: css, text: renderedText(tree) }
}

/* ----------------------------------------------------------------- i18n */

test('i18n: both dictionaries carry the identical, complete key set', () => {
  assert.equal(NS, 'pluginUpdates')
  assert.deepEqual(Object.keys(DICTS.zh).sort(), Object.keys(DICTS.en).sort())
  for (const key of REQUIRED_KEYS) {
    for (const locale of ['en', 'zh']) {
      const value = DICTS[locale][key]
      assert.equal(typeof value, 'string', locale + ' is missing ' + key)
      assert.notEqual(value, '', locale + ' has an empty ' + key)
    }
  }
  assert.ok(REQUIRED_KEYS.length >= 40)
})

test('i18n: dict picks Chinese for zh* and English otherwise', () => {
  assert.equal(dict('zh'), DICTS.zh)
  assert.equal(dict('zh-CN'), DICTS.zh)
  assert.equal(dict('ZH-Hans'), DICTS.zh)
  assert.equal(dict('en-US'), DICTS.en)
  assert.equal(dict('fr'), DICTS.en)
  assert.equal(dict(undefined), DICTS.en)
})

test('i18n: fill substitutes placeholders and keeps unknown ones', () => {
  assert.equal(
    fill('Update {name} from {from} to {to}', { name: 'dsh-pet', from: '0.3.7', to: '0.3.8' }),
    'Update dsh-pet from 0.3.7 to 0.3.8',
  )
  assert.equal(fill('{count} plugin(s) can be updated', { count: 3 }), '3 plugin(s) can be updated')
  assert.equal(fill('hello {unknown}', {}), 'hello {unknown}')
  assert.equal(fill('plain'), 'plain')
  assert.equal(fill(undefined, { count: 1 }), '')
  assert.equal(fill(null), '')
})

/* ---------------------------------------------------------------- panel */

test('panel: empty ready snapshot shows the empty state, never-checked time and title', () => {
  const mounted = mountPanel({ phase: 'ready', lastCheckedAt: null })
  includes(mounted.text, DICTS.en['panel.noPlugins'])
  includes(mounted.text, DICTS.en['panel.never'])
  includes(mounted.text, DICTS.en['panel.refresh'])
  includes(mounted.text, DICTS.en['guide.title'])
  const refresh = findButton(mounted.tree, (button) => button.props['aria-label'] === DICTS.en['panel.refresh'])
  assert.ok(refresh, 'refresh button should render')
  assert.notEqual(refresh.props.disabled, true)
})

test('panel: Chinese translator produces Chinese copy', () => {
  const snapshot = makeSnapshot({ phase: 'ready', rows: [] })
  installController(snapshot)
  const tree = ui.UpdatePanel({ t: tFrom(DICTS.zh) })
  const text = renderedText(tree)
  includes(text, DICTS.zh['panel.noPlugins'])
  includes(text, DICTS.zh['guide.title'])
})

test('panel: checking snapshot disables refresh and shows the checking copy', () => {
  const mounted = mountPanel({ phase: 'checking', lastCheckedAt: null })
  includes(mounted.text, DICTS.en['panel.refreshing'])
  const refresh = findButton(mounted.tree, (button) => button.props['aria-label'] === DICTS.en['panel.refresh'])
  assert.equal(refresh.props.disabled, true)
})

test('panel: row list renders versions, statuses, requirements and per-row actions', () => {
  const mounted = mountPanel({
    rows: [ROW_UPDATE, ROW_LATEST, ROW_INCOMPAT, ROW_FAILED, ROW_UNSUPPORTED],
    updateCount: 1,
  })
  includes(mounted.text, fill(DICTS.en['panel.summary'], { count: 1 }))
  includes(mounted.text, '0.3.7')
  includes(mounted.text, '0.3.8')
  includes(mounted.text, DICTS.en['row.latestLabel'])
  includes(mounted.text, DICTS.en['row.incompatible'])
  includes(mounted.text, '@deepseek-ai/dsh ^0.3.0')
  includes(mounted.text, 'HTTP 404')
  includes(mounted.text, DICTS.en['row.unsupported'])
  for (const key of ['status.update', 'status.latest', 'status.incompatible', 'status.failed', 'status.unsupported']) {
    includes(mounted.text, DICTS.en[key])
  }

  const updateButton = buttonsOf(mounted.tree).find(
    (button) => labelOf(button) === DICTS.en['row.update'] && button.props.disabled !== true,
  )
  assert.ok(updateButton, 'the updatable row should own an enabled update button')
  updateButton.props.onClick()
  assert.deepEqual(mounted.calls, [['requestUpdate', 'dsh-pet']])

  const incompatibleButton = buttonsOf(mounted.tree).find(
    (button) =>
      button.props.disabled === true &&
      typeof button.props.title === 'string' &&
      button.props.title.indexOf('@deepseek-ai/dsh') !== -1,
  )
  assert.ok(incompatibleButton, 'the incompatible row should own a disabled update button with the unmet requirement')

  const updateAll = buttonsOf(mounted.tree).find((button) => labelOf(button) === DICTS.en['panel.updateAll'])
  assert.ok(updateAll, 'update-all should render when updates exist')
  updateAll.props.onClick()
  assert.deepEqual(mounted.calls[mounted.calls.length - 1], ['updateAll'])
})

test('panel: inline confirmation shows name, versions, and wired update/cancel buttons', () => {
  const confirm = { name: 'dsh-pet', title: 'Pet', currentVersion: '0.3.7', latestVersion: '0.3.8' }
  const mounted = mountPanel({ rows: [ROW_UPDATE], updateCount: 1, confirm: confirm })
  includes(mounted.text, DICTS.en['confirm.title'])
  includes(mounted.text, fill(DICTS.en['confirm.body'], { name: 'Pet', from: '0.3.7', to: '0.3.8' }))

  const confirmBar = descendants(mounted.tree, []).find((element) => hasClass(element, 'dshu-confirm'))
  assert.ok(confirmBar, 'confirmation bar should render inline')

  const update = buttonsOf(confirmBar).find((button) => labelOf(button) === DICTS.en['confirm.update'])
  assert.ok(update, 'confirmation should offer an update button')
  update.props.onClick()
  assert.deepEqual(mounted.calls, [['confirmUpdate']])

  const cancel = buttonsOf(confirmBar).find((button) => labelOf(button) === DICTS.en['confirm.cancel'])
  assert.ok(cancel, 'confirmation should offer a cancel button')
  cancel.props.onClick()
  assert.deepEqual(mounted.calls, [['confirmUpdate'], ['cancelConfirm']])
})

test('panel: error snapshot shows the failure, retry and dismiss wiring', () => {
  const mounted = mountPanel({ phase: 'failed', error: 'listBundles failed: boom' })
  includes(mounted.text, DICTS.en['panel.checkFailed'])
  includes(mounted.text, 'boom')

  const retry = buttonsOf(mounted.tree).find((button) => labelOf(button) === DICTS.en['panel.retry'])
  assert.ok(retry, 'error banner should offer a retry button')
  retry.props.onClick()
  assert.deepEqual(mounted.calls, [['refresh']])

  const dismiss = buttonsOf(mounted.tree).find((button) => button.props['data-dshu-dismiss'] === 'error')
  assert.ok(dismiss)
  dismiss.props.onClick()
  assert.deepEqual(mounted.calls, [['refresh'], ['dismissError']])
})

test('panel: busyName, results, restart banner and notices are rendered and wired', () => {
  const mounted = mountPanel({
    rows: [ROW_UPDATE, ROW_FAILED],
    updateCount: 1,
    busyName: 'dsh-pet',
    results: {
      'dsh-pet': { kind: 'updated', restartRequired: true },
      'dsh-broken': { kind: 'rolled-back', message: 'install failed: EACCES' },
    },
    notices: [{ id: 'n1', name: 'dsh-gone', level: 'error', kind: 'rollback-failed', message: 'rollback failed: ENOSPC' }],
  })
  includes(mounted.text, DICTS.en['row.updatedRestart'])
  includes(mounted.text, DICTS.en['row.rolledBack'])
  includes(mounted.text, 'install failed: EACCES')
  includes(mounted.text, DICTS.en['panel.restartBanner'])
  includes(mounted.text, 'dsh-gone')
  includes(mounted.text, DICTS.en['row.rollbackFailed'])
  includes(mounted.text, 'rollback failed: ENOSPC')

  const updating = buttonsOf(mounted.tree).find((button) => labelOf(button) === DICTS.en['row.updating'])
  assert.ok(updating, 'the busy row should label its button as updating')
  assert.equal(updating.props.disabled, true)

  const refresh = findButton(mounted.tree, (button) => button.props['aria-label'] === DICTS.en['panel.refresh'])
  assert.equal(refresh.props.disabled, true)
  const updateAll = buttonsOf(mounted.tree).find((button) => labelOf(button) === DICTS.en['panel.updateAll'])
  assert.ok(updateAll)
  assert.equal(updateAll.props.disabled, true)

  const resultDismiss = findButton(mounted.tree, (button) => button.props['data-dshu-dismiss'] === 'result')
  assert.ok(resultDismiss, 'a row result should be dismissible')
  assert.equal(resultDismiss.props['aria-label'], DICTS.en['notice.dismiss'])
  resultDismiss.props.onClick()
  assert.deepEqual(mounted.calls[mounted.calls.length - 1], ['dismissResult', 'dsh-pet'])

  const noticeDismiss = findButton(mounted.tree, (button) => button.props['data-dshu-dismiss'] === 'notice')
  assert.ok(noticeDismiss, 'a notice should be dismissible')
  assert.equal(noticeDismiss.props['aria-label'], DICTS.en['notice.dismiss'])
  noticeDismiss.props.onClick()
  assert.deepEqual(mounted.calls[mounted.calls.length - 1], ['dismissNotice', 'n1'])
})

test('panel: hot-update results say the update is already applied', () => {
  const applied = mountPanel({ rows: [ROW_UPDATE], results: { 'dsh-pet': { kind: 'applied' } } })
  includes(applied.text, DICTS.en['row.updatedApplied'])
  const updated = mountPanel({ rows: [ROW_UPDATE], results: { 'dsh-pet': { kind: 'updated' } } })
  includes(updated.text, DICTS.en['row.updatedApplied'])
})

test('panel: failed and rollback-failed results use their copy plus the raw host message', () => {
  const failed = mountPanel({
    rows: [ROW_UPDATE],
    results: { 'dsh-pet': { kind: 'failed', message: 'build script failed' } },
  })
  includes(failed.text, DICTS.en['row.failed'])
  includes(failed.text, 'build script failed')

  const rollbackFailed = mountPanel({
    rows: [ROW_UPDATE],
    results: { 'dsh-pet': { kind: 'rollback-failed', message: 'disk full' } },
  })
  includes(rollbackFailed.text, DICTS.en['row.rollbackFailed'])
  includes(rollbackFailed.text, 'disk full')
})

test('panel: all-up-to-date snapshot shows the positive empty state', () => {
  const mounted = mountPanel({ rows: [ROW_LATEST], updateCount: 0 })
  includes(mounted.text, DICTS.en['panel.allUpToDate'])
  assert.equal(
    buttonsOf(mounted.tree).some((button) => labelOf(button) === DICTS.en['panel.updateAll']),
    false,
    'update-all should be absent when there is nothing to update',
  )
})

test('panel: page variant is wider and the tab wrapper defaults to it', () => {
  installController(makeSnapshot({ rows: [ROW_LATEST] }))
  const page = ui.UpdatePanel({ t: tFrom(DICTS.en), variant: 'page' })
  const section = descendants(page, []).find((element) => element.type === 'section')
  assert.ok(hasClass(section, 'dshu-panel--page'))

  const tab = ui.PluginUpdatesTab({ t: tFrom(DICTS.en) })
  assert.equal(tab.type, ui.UpdatePanel)
  assert.equal(tab.props.variant, 'page')
})

test('panel: missing props.t falls back to the English dictionary without throwing', () => {
  installController(makeSnapshot({ rows: [ROW_LATEST] }))
  let tree
  assert.doesNotThrow(() => {
    tree = ui.UpdatePanel({})
  })
  includes(renderedText(tree), DICTS.en['guide.title'])
  includes(renderedText(tree), DICTS.en['panel.refresh'])
})

test('panel: every snapshot shape renders without throwing', () => {
  const shapes = [
    {},
    { phase: 'idle' },
    { phase: 'checking' },
    { phase: 'failed', error: 'network error', lastCheckedAt: null },
    { phase: 'failed', error: 'stale', rows: [ROW_UPDATE], updateCount: 1 },
    { phase: 'ready', rows: [ROW_LATEST, ROW_INCOMPAT, ROW_FAILED, ROW_UNSUPPORTED, ROW_UPDATE], updateCount: 1 },
    {
      phase: 'ready',
      rows: [ROW_UPDATE],
      updateCount: 1,
      confirm: { name: 'dsh-pet', currentVersion: '0.3.7', latestVersion: '0.3.8' },
    },
    { phase: 'ready', rows: [ROW_UPDATE], updateCount: 1, updatingAll: true },
    { phase: 'ready', rows: [ROW_UPDATE], updateCount: 1, busyName: 'dsh-pet', installPhase: 'installing' },
    {
      phase: 'ready',
      rows: [ROW_UPDATE],
      updateCount: 1,
      notices: [{ id: 'a', name: 'x', level: 'warn', message: 'm' }],
      results: { 'dsh-pet': { kind: 'rollback-failed', message: 'e' } },
    },
    { phase: 'ready', rows: [ROW_UPDATE], results: { 'dsh-pet': { kind: 'applied' } } },
  ]
  for (const overrides of shapes) {
    installController(makeSnapshot(overrides))
    for (const variant of ['panel', 'page']) {
      assert.doesNotThrow(() => {
        renderedText(ui.UpdatePanel({ t: tFrom(DICTS.en), variant: variant }))
      })
    }
  }
})

test('styles: token-only colors and the required Guide card metrics', () => {
  const mounted = mountPanel({ rows: [ROW_UPDATE], updateCount: 1 })
  assert.ok(mounted.css.indexOf('dshu-') !== -1)
  assert.ok(mounted.css.indexOf('--dsw-alias-bg-layer-2') !== -1)
  assert.doesNotMatch(mounted.css, /#[0-9a-fA-F]{3,8}\b/, 'no hard-coded hex colors')
  assert.doesNotMatch(mounted.css, /\brgba?\(/i, 'no hard-coded rgb colors')
  assert.doesNotMatch(mounted.css, /\bhsla?\(/i, 'no hard-coded hsl colors')
  assert.ok(mounted.css.indexOf('width:380px') !== -1, 'Guide card width comes from the shared CSS')
  assert.ok(mounted.css.indexOf('min-height:56px') !== -1, 'Guide card minimum height')
  assert.ok(mounted.css.indexOf('font-size:14px') !== -1, 'title size')
  assert.ok(mounted.css.indexOf('font-size:11px') !== -1, 'secondary text size')
})

/* ----------------------------------------------------------- Guide card */

test('GuideCard: reproduces the Host card and opens the tab on click', () => {
  const opened = []
  const useTabInfo = function () {
    return {
      tab: {
        actions: {
          openTab(kind, options) {
            opened.push([kind, options])
          },
        },
      },
    }
  }
  installController(makeSnapshot({ updateCount: 2 }))
  const tree = ui.GuideCard({
    entryId: 'plugin-updates',
    kind: 'plugin-updates',
    title: 'Plugin Updates',
    description: 'Check installed plugins for updates.',
    useTabInfo: useTabInfo,
    t: tFrom(DICTS.en),
  })
  const text = renderedText(tree)
  includes(text, 'Plugin Updates')
  includes(text, 'Check installed plugins for updates.')

  const elements = descendants(tree, [])
  assert.ok(elements.some((element) => hasClass(element, 'dshu-dot')), 'red dot appears when updates exist')
  const card = elements.find((element) => element.type === 'button')
  assert.ok(card, 'Guide card is a button')
  assert.equal(card.props.type, 'button')
  card.props.onClick()
  assert.deepEqual(opened, [['plugin-updates', { replaceTab: true }]])
})

test('GuideCard: falls back to translated title/description and hides the dot at zero updates', () => {
  installController(makeSnapshot({ updateCount: 0 }))
  const tree = ui.GuideCard({ kind: 'plugin-updates', useTabInfo: () => ({ tab: { actions: { openTab() {} } } }), t: tFrom(DICTS.zh) })
  const text = renderedText(tree)
  includes(text, DICTS.zh['guide.title'])
  includes(text, DICTS.zh['guide.description'])
  assert.equal(
    descendants(tree, []).some((element) => hasClass(element, 'dshu-dot')),
    false,
  )
})

test('GuideCard: a broken host guidance hook stays a no-op', () => {
  installController(makeSnapshot({ updateCount: 1 }))
  const tree = ui.GuideCard({
    kind: 'plugin-updates',
    useTabInfo: function () {
      throw new Error('no sidebar')
    },
    t: tFrom(DICTS.en),
  })
  const card = descendants(tree, []).find((element) => element.type === 'button')
  assert.doesNotThrow(() => card.props.onClick())
})

/* ------------------------------------------------------------- tab chip */

test('TabChip: shows the translated title and the red update dot', () => {
  installController(makeSnapshot({ updateCount: 1 }))
  const tree = ui.TabChip({ useTabInfo: () => ({}), t: tFrom(DICTS.en) })
  includes(renderedText(tree), DICTS.en['guide.title'])
  assert.ok(descendants(tree, []).some((element) => hasClass(element, 'dshu-dot') || hasClass(element, 'dshu-chip-dot')))

  installController(makeSnapshot({ updateCount: 0 }))
  const quiet = ui.TabChip({ useTabInfo: () => ({}), t: tFrom(DICTS.zh) })
  includes(renderedText(quiet), DICTS.zh['guide.title'])
  assert.equal(
    descendants(quiet, []).some((element) => hasClass(element, 'dshu-chip-dot')),
    false,
  )
})

/* ----------------------------------------------------------------- glyph */

test('UpdateGlyph: original circular-arrow SVG painted with currentColor', () => {
  const glyph = ui.UpdateGlyph({ size: 26, className: 'custom' })
  assert.equal(glyph.type, 'svg')
  assert.equal(glyph.props.stroke, 'currentColor')
  assert.equal(glyph.props.fill, 'none')
  assert.equal(glyph.props.width, 26)
  assert.equal(glyph.props.height, 26)
  assert.equal(glyph.props.viewBox, '0 0 24 24')
  assert.equal(glyph.props['aria-hidden'], 'true')
  assert.ok(glyph.props.className.indexOf('dshu-glyph') !== -1)
  assert.ok(glyph.props.className.indexOf('custom') !== -1)
  const paths = glyph.props.children.map((child) => child.props.d).join(' ')
  assert.match(paths, /M20\.5 12a8\.5 8\.5 0 1 1-2\.49-6\.01/)
  assert.match(paths, /M20\.5 4\.5v4h-4/)

  const fallback = ui.UpdateGlyph({})
  assert.equal(fallback.props.width, 16)
})

test('left sidebar icon: host pinwheel plus a dot only while updates are pending', () => {
  installController(makeSnapshot({ updateCount: 0 }))
  const idle = ui.LeftSidebarPluginsIcon({ size: 18, active: true })
  assert.equal(hasClass(idle, 'dshu-rail'), true)
  const idleElements = descendants(idle, [])
  assert.equal(idleElements.filter((element) => hasClass(element, 'dshu-rail-dot')).length, 0)
  assert.equal(idleElements.filter((element) => element.type === 'svg').length, 1)

  installController(makeSnapshot({ updateCount: 2 }))
  const pending = ui.LeftSidebarPluginsIcon({ size: 18, active: false })
  const dot = descendants(pending, []).find((element) => hasClass(element, 'dshu-rail-dot'))
  assert.ok(dot, 'a pending update draws the dot')
  assert.equal(dot.props['data-update-count'], undefined)
  assert.equal(hasClass(pending, 'dshu-rail'), true)
  assert.equal(pending.props['data-update-count'], '2')
})

/* --------------------------------------------------------- progress & toast */

test('progress: a running update shows the phase line and an indeterminate bar', () => {
  installController(makeSnapshot({ busyName: 'dsh-pet', installPhase: 'installing' }))
  const tree = ui.UpdatePanel({ t: tFrom(DICTS.zh) })
  const elements = descendants(tree, [])
  const block = elements.find((element) => hasClass(element, 'dshu-progress-block'))
  assert.ok(block, 'progress block appears while updating')
  includes(renderedText(block), DICTS.zh['progress.installing'])
  const bar = elements.find((element) => hasClass(element, 'dshu-progress-bar'))
  assert.ok(bar, 'an indeterminate bar is drawn')
  assert.equal(hasClass(bar, 'dshu-progress-bar--determinate'), false)
  assert.equal(bar.props.style, undefined)
})

test('progress: a batch run renders a determinate bar from done/total', () => {
  installController(makeSnapshot({ updatingAll: true, busyName: 'dsh-pet', batch: { total: 4, done: 1 } }))
  const tree = ui.UpdatePanel({ t: tFrom(DICTS.zh) })
  const elements = descendants(tree, [])
  includes(renderedText(tree), DICTS.zh['progress.batch'].replace('{done}', '1').replace('{total}', '4'))
  const bar = elements.find((element) => hasClass(element, 'dshu-progress-bar'))
  assert.ok(bar, 'a determinate bar is drawn')
  assert.ok(hasClass(bar, 'dshu-progress-bar--determinate'))
  assert.equal(bar.props.style.width, '25%')
})

test('toast: a finished update renders its copy and dismisses by hand', () => {
  const calls = installController(makeSnapshot({
    toast: { id: 'toast-1', kind: 'updated', tone: 'success', name: 'dsh-pet', restartRequired: true },
  }))
  const tree = ui.UpdateToast({ t: tFrom(DICTS.zh) })
  assert.ok(tree, 'the toast renders')
  includes(renderedText(tree), DICTS.zh['toast.updated'].replace('{name}', 'dsh-pet'))
  const close = descendants(tree, []).find((element) => hasClass(element, 'dshu-toast-close'))
  assert.ok(close, 'a close control is offered')
  close.props.onClick()
  assert.deepEqual(calls.filter((call) => call[0] === 'dismissToast'), [['dismissToast', 'toast-1']])
})

test('toast: a batch summary renders counts and the failure tone', () => {
  installController(makeSnapshot({
    toast: { id: 'toast-2', kind: 'batch', tone: 'error', updated: 1, failed: 2 },
  }))
  const tree = ui.UpdateToast({ t: tFrom(DICTS.en) })
  includes(renderedText(tree), DICTS.en['toast.batch'].replace('{updated}', '1').replace('{failed}', '2'))
  const toast = descendants(tree, []).find((element) => hasClass(element, 'dshu-toast'))
  assert.ok(toast)
  assert.ok(hasClass(toast, 'dshu-toast--error'))

  installController(makeSnapshot({ toast: null }))
  assert.equal(ui.UpdateToast({ t: tFrom(DICTS.en) }), null)
})

test('GuideCard: reads the tab hook during render and falls back to the injected opener', () => {
  installController(makeSnapshot({ updateCount: 0 }))
  let hookCalls = 0
  let injected = 0
  const tree = ui.GuideCard({
    kind: 'plugin-updates',
    useTabInfo: function () {
      hookCalls += 1
      throw new Error('no guide tab')
    },
    openTab: function () {
      injected += 1
    },
    t: tFrom(DICTS.en),
  })
  assert.equal(hookCalls, 1, 'the hook runs during render, not on click')
  const card = descendants(tree, []).find((element) => element.type === 'button')
  assert.ok(card)
  card.props.onClick()
  assert.equal(injected, 1, 'the injected opener is the fallback')
  assert.equal(hookCalls, 1, 'clicking does not call the hook again')
})
