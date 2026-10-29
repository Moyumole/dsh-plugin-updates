/**
 * Browser UI for dsh-plugin-updates.
 *
 * Rendered in three seats: the right-sidebar pane (compact), the Plugins-page
 * tab (wide), and the right-sidebar Guide capsule/title chip. All component
 * copy comes from `props.t` (the Host resolves the `pluginUpdates` namespace);
 * the active snapshot comes from the controller injected by `entry.js`.
 *
 * The bundle concatenates this file after `i18n.js` and `rows.js` into one
 * function scope, so `React`, `h`, `DICTS`, and `fill` are free variables here.
 * `setActiveController` is the only cross-file seam this module needs.
 */

/** Styles rendered by every seat. Tokens only: no hard-coded colors. */
const UI_CSS = `
.dshu-panel{display:flex;flex-direction:column;gap:12px;min-width:0;width:100%;padding:12px;box-sizing:border-box;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-primary)}
.dshu-panel *{box-sizing:border-box}
.dshu-panel--page{gap:14px;padding:16px 20px 24px}
.dshu-rail{position:relative;display:inline-flex;align-items:center;justify-content:center;color:inherit}
.dshu-rail svg{display:block;flex:none;color:inherit}
.dshu-rail-dot{position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-error-primary);box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill)}
.dshu-progress-block{display:flex;flex-direction:column;gap:6px}
.dshu-progress-label{font-size:11px;line-height:1.4;color:var(--dsw-alias-label-secondary)}
.dshu-progress{position:relative;height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}
.dshu-progress-bar{position:absolute;top:0;bottom:0;left:0;width:35%;border-radius:999px;background:var(--dsw-alias-brand-primary);animation:dshu-progress-indeterminate 1.2s ease-in-out infinite}
.dshu-progress-bar--determinate{animation:none;transition:width .2s ease}
@keyframes dshu-progress-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}
.dshu-toast{position:fixed;top:40px;left:50%;z-index:1101;pointer-events:none;display:flex;align-items:center;gap:10px;width:max-content;max-width:min(640px,calc(100vw - 48px));padding:12px 16px;border-radius:var(--dsw-radius-lg,12px);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-toast-bg,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-toast-label,var(--dsw-alias-label-primary));box-shadow:var(--dsw-shadow-lv3,none);transform:translate(-50%);font-size:14px;line-height:22px;animation:dshu-toast-in .16s ease-out}
.dshu-toast--success{border-color:var(--dsw-alias-state-success-primary)}
.dshu-toast--warn{border-color:var(--dsw-alias-state-warn-primary)}
.dshu-toast--error{border-color:var(--dsw-alias-state-error-primary)}
.dshu-toast-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.dshu-toast-close{pointer-events:auto;flex:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;padding:0 2px;border-radius:var(--dsw-radius-sm,4px)}
.dshu-toast-close:hover{color:var(--dsw-alias-label-primary)}
@keyframes dshu-toast-in{0%{opacity:0;transform:translate(-50%,-6px)}100%{opacity:1;transform:translate(-50%)}}
@media(prefers-reduced-motion:reduce){.dshu-toast{animation:none}}
.dshu-head{display:flex;align-items:flex-start;gap:8px}
.dshu-head-text{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}
.dshu-title{margin:0;font-size:14px;font-weight:600;line-height:1.3;color:var(--dsw-alias-label-primary)}
.dshu-subtitle{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dshu-banner{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:1.5}
.dshu-banner--error{border-color:var(--dsw-alias-state-error-primary)}
.dshu-banner--warn{border-color:var(--dsw-alias-state-warn-primary)}
.dshu-banner--info{border-color:var(--dsw-alias-border-l2)}
.dshu-banner-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.dshu-banner-name{color:var(--dsw-alias-label-primary);font-weight:600}
.dshu-empty{padding:18px 12px;border:1px dashed var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;text-align:center}
.dshu-list{display:flex;flex-direction:column;gap:8px;min-width:0;margin:0;padding:0;list-style:none}
.dshu-item{display:flex;flex-direction:column;gap:6px;min-width:0}
.dshu-row{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg,10px);background:var(--dsw-alias-bg-base);transition:background-color .12s ease}
.dshu-row:hover{background:var(--dsw-alias-bg-layer-2)}
.dshu-row-main{display:flex;flex-direction:column;gap:4px;flex:1 1 auto;min-width:0}
.dshu-row-head{display:flex;align-items:center;gap:6px;min-width:0}
.dshu-row-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dshu-row-meta{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;min-width:0;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}
.dshu-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:var(--dsw-alias-label-secondary)}
.dshu-ver{white-space:nowrap}
.dshu-row-note{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dshu-row-note--warn{color:var(--dsw-alias-state-warn-primary)}
.dshu-row-note--error{color:var(--dsw-alias-state-error-primary)}
.dshu-row-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.dshu-badge{flex:0 0 auto;padding:2px 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-layer-2);font-size:10px;line-height:1.4;white-space:nowrap}
.dshu-badge--latest{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.dshu-badge--update{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dshu-badge--incompatible{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}
.dshu-badge--failed{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.dshu-badge--unsupported{color:var(--dsw-alias-state-idle-primary);border-color:var(--dsw-alias-state-idle-primary)}
.dshu-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md,8px);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;line-height:1.4;white-space:nowrap;cursor:pointer}
.dshu-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.dshu-btn:disabled{opacity:.5;cursor:default}
.dshu-btn--accent{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.dshu-btn--filled{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}
.dshu-btn--filled:hover:not(:disabled){background:var(--dsw-alias-brand-primary);opacity:.9}
.dshu-iconbtn{display:inline-flex;align-items:center;justify-content:center;padding:2px 5px;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:1.4;cursor:pointer}
.dshu-iconbtn:hover{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.dshu-confirm{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--dsw-alias-brand-primary);border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-bg-layer-1)}
.dshu-confirm-text{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}
.dshu-confirm-title{font-size:12px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.dshu-confirm-body{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dshu-confirm-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.dshu-result{display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-radius:var(--dsw-radius-sm,6px);background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:1.5}
.dshu-result-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary)}
.dshu-result--success{border-left:2px solid var(--dsw-alias-state-success-primary)}
.dshu-result--warn{border-left:2px solid var(--dsw-alias-state-warn-primary)}
.dshu-result--error{border-left:2px solid var(--dsw-alias-state-error-primary)}
.dshu-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1)}
.dshu-summary{min-width:0;font-size:11px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.dshu-guide{display:flex;align-items:center;gap:12px;width:380px;max-width:100%;min-height:56px;padding:14px 20px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-xl,12px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;transition:background-color .12s ease}
.dshu-guide:hover{background:var(--dsw-alias-bg-layer-2)}
.dshu-guide-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:26px;height:26px;color:var(--dsw-alias-label-secondary)}
.dshu-guide-body{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}
.dshu-guide-title{font-size:14px;font-weight:500;line-height:1.3;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshu-guide-desc{font-size:11px;line-height:1.4;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshu-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-error-primary);box-shadow:0 0 0 1px var(--dsw-alias-bg-layer-1)}
.dshu-chip{display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:12px;color:var(--dsw-alias-label-primary)}
.dshu-chip-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshu-chip-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-error-primary)}
.dshu-glyph{display:block;flex:0 0 auto}
`

/** Rendered before the entry injects a controller and by stub environments. */
const UI_EMPTY_SNAPSHOT = {
  phase: 'idle',
  lastCheckedAt: null,
  runtimeVersion: null,
  error: null,
  rows: [],
  results: {},
  confirm: null,
  updatingAll: false,
  updateCount: 0,
  installPhase: null,
  busyName: null,
  notices: [],
}

/** The controller the entry wired to this page; read through `uiUseSnapshot`. */
let uiActiveController = null

/**
 * Point the UI at the live controller (called once from `entry.apply`).
 * @param {object | null} controller - `createController(...)` result.
 */
export function setActiveController(controller) {
  uiActiveController = controller === undefined ? null : controller
}

/** The current snapshot, falling back to a stable empty one before injection. */
function uiSnapshot() {
  const controller = uiActiveController
  if (controller === null || typeof controller.getSnapshot !== 'function') return UI_EMPTY_SNAPSHOT
  try {
    const snapshot = controller.getSnapshot()
    return snapshot === undefined || snapshot === null ? UI_EMPTY_SNAPSHOT : snapshot
  } catch (error) {
    return UI_EMPTY_SNAPSHOT
  }
}

/** Subscribe to the controller, tolerating a missing or broken service. */
function uiSubscribe(listener) {
  const controller = uiActiveController
  if (controller === null || typeof controller.subscribe !== 'function') return function () {}
  try {
    const unsubscribe = controller.subscribe(listener)
    return typeof unsubscribe === 'function' ? unsubscribe : function () {}
  } catch (error) {
    return function () {}
  }
}

/** Read the shared snapshot; stable subscribe/getSnapshot identities for React. */
function uiUseSnapshot() {
  return React.useSyncExternalStore(uiSubscribe, uiSnapshot, uiSnapshot)
}

/** Invoke one controller method, keeping a controller bug from breaking the page. */
function uiRun(method) {
  const controller = uiActiveController
  if (controller === null || typeof controller[method] !== 'function') return
  const args = Array.prototype.slice.call(arguments, 1)
  try {
    controller[method].apply(controller, args)
  } catch (error) {
    /* the controller reports its own failures in the snapshot */
  }
}

/** English copy, used only when a seat is rendered without the Host `t`. */
const UI_FALLBACK_DICT =
  typeof DICTS === 'object' && DICTS !== null && DICTS.en !== undefined ? DICTS.en : {}

/** Last-resort translator so a missing `props.t` never crashes a seat. */
function uiTranslateKey(key) {
  return typeof UI_FALLBACK_DICT[key] === 'string' ? UI_FALLBACK_DICT[key] : key
}

/** `props.t` when the Host injected one, otherwise the English fallback. */
function uiT(props) {
  const provided = props === undefined || props === null ? undefined : props.t
  return typeof provided === 'function' ? provided : uiTranslateKey
}

/** Number of updatable rows, used when a stub snapshot omits `updateCount`. */
function uiCountUpdates(rows) {
  let count = 0
  for (const row of rows) {
    if (row !== null && row !== undefined && row.status === 'update') count += 1
  }
  return count
}

/** A short local time for the "last checked" line; empty when never checked. */
function uiFormatCheckedAt(value) {
  if (typeof value !== 'number' || !isFinite(value)) return ''
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return ''
  }
}

/** The progress line shown while one bundle is updated, or while a batch runs. */
function uiProgressText(t, snapshot) {
  const batch = snapshot.batch
  if (batch !== null && batch !== undefined && typeof batch.total === 'number' && batch.total > 0) {
    const done = typeof batch.done === 'number' ? batch.done : 0
    return fill(t('progress.batch'), { done: done, total: batch.total })
  }
  const phase = snapshot.installPhase
  if (phase === 'removing') return t('progress.removing')
  if (phase === 'installing') return t('progress.installing')
  if (phase === 'applying') return t('progress.applying')
  if (phase === 'rolling-back') return t('progress.rollingBack')
  if (phase === 'cancelling') return t('progress.cancelling')
  return t('row.updating')
}

/** The toast copy for one update outcome. */
function uiToastText(t, toast) {
  if (toast.kind === 'batch') {
    return fill(t('toast.batch'), {
      updated: typeof toast.updated === 'number' ? toast.updated : 0,
      failed: typeof toast.failed === 'number' ? toast.failed : 0,
    })
  }
  const name = typeof toast.name === 'string' ? toast.name : ''
  if (toast.kind === 'applied') return fill(t('toast.applied'), { name: name })
  if (toast.kind === 'updated') return fill(t('toast.updated'), { name: name })
  if (toast.kind === 'rolled-back') return fill(t('toast.rolledBack'), { name: name })
  if (toast.kind === 'rollback-failed') return fill(t('toast.rollbackFailed'), { name: name })
  return fill(t('toast.failed'), { name: name })
}

/** Badge copy and tone for one row status. */
function uiStatusMeta(status) {
  if (status === 'update') return { label: 'status.update', tone: 'update' }
  if (status === 'incompatible') return { label: 'status.incompatible', tone: 'incompatible' }
  if (status === 'failed') return { label: 'status.failed', tone: 'failed' }
  if (status === 'unsupported') return { label: 'status.unsupported', tone: 'unsupported' }
  return { label: 'status.latest', tone: 'latest' }
}

/** `{ "@deepseek-ai/dsh": "^0.2.1-rc.1" }` shaped requirements as one readable line. */
function uiRequirementText(requirements) {
  if (requirements === null || requirements === undefined || typeof requirements !== 'object') return ''
  const names = Object.keys(requirements)
  if (names.length === 0) return ''
  return names
    .map(function (name) {
      const range = requirements[name]
      return range === undefined || range === null ? name : name + ' ' + range
    })
    .join(', ')
}

/** The visible note under a row's title, when its status needs an explanation. */
function uiRowNote(t, row, requirementText) {
  if (row.status === 'incompatible') {
    return {
      tone: 'warn',
      text: requirementText === '' ? t('row.incompatible') : t('row.incompatible') + ' · ' + requirementText,
    }
  }
  if (row.status === 'failed') {
    const reason = typeof row.reason === 'string' && row.reason !== '' ? row.reason : ''
    return {
      tone: 'error',
      text: reason === '' ? t('row.checkFailed') : t('row.checkFailed') + ' · ' + reason,
    }
  }
  if (row.status === 'unsupported') return { tone: '', text: t('row.unsupported') }
  return null
}

/** Translate one trailing result into text + tone; `result.message` stays raw. */
function uiResultInfo(t, result) {
  if (result === null || result === undefined) return null
  const message = typeof result.message === 'string' && result.message !== '' ? result.message : ''
  const withMessage = function (base) {
    return message === '' ? base : base + ' — ' + message
  }
  if (result.kind === 'updated') {
    return result.restartRequired === true
      ? { tone: 'success', text: t('row.updatedRestart') }
      : { tone: 'success', text: t('row.updatedApplied') }
  }
  if (result.kind === 'applied') return { tone: 'success', text: t('row.updatedApplied') }
  if (result.kind === 'failed') return { tone: 'error', text: withMessage(t('row.failed')) }
  if (result.kind === 'rolled-back') return { tone: 'warn', text: withMessage(t('row.rolledBack')) }
  if (result.kind === 'rollback-failed') {
    return { tone: 'error', text: withMessage(t('row.rollbackFailed')) }
  }
  return null
}

/** Whether any result asks for a DSH restart. */
function uiNeedsRestart(results) {
  const names = Object.keys(results)
  for (const name of names) {
    const result = results[name]
    if (result !== null && result !== undefined && result.restartRequired === true) return true
  }
  return false
}

/** The original circular-arrow mark; painted with `currentColor` by the Host. */
export function UpdateGlyph(props) {
  const input = props === undefined || props === null ? {} : props
  const size = typeof input.size === 'number' && input.size > 0 ? input.size : 16
  const className =
    'dshu-glyph' + (typeof input.className === 'string' && input.className !== '' ? ' ' + input.className : '')
  return h(
    'svg',
    {
      className: className,
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h('path', { d: 'M20.5 12a8.5 8.5 0 1 1-2.49-6.01' }),
    h('path', { d: 'M20.5 4.5v4h-4' }),
  )
}

/**
 * The left sidebar's "Plugins" glyph.
 *
 * The host registers that icon in the `sidebar.panellist` list under the id
 * `plugins`; this component takes that same cell over so the update dot can ride
 * the icon. The pinwheel geometry mirrors the host artwork (17×17, 1px stroke,
 * `currentColor`) so the rail keeps its look, and the dot appears only while the
 * panel counts updates.
 * @param {object} props - the slot's owner share `{ size, active }` plus `t`.
 * @returns {object} the icon element.
 */
export function LeftSidebarPluginsIcon(props) {
  const input = props === undefined || props === null ? {} : props
  const size = typeof input.size === 'number' && input.size > 0 ? input.size : 16
  const snapshot = uiUseSnapshot()
  const count =
    typeof snapshot.updateCount === 'number'
      ? snapshot.updateCount
      : uiCountUpdates(Array.isArray(snapshot.rows) ? snapshot.rows : [])
  return h(
    'span',
    { className: 'dshu-rail', 'data-update-count': String(count) },
    h(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 17 17',
        fill: 'none',
        xmlns: 'http://www.w3.org/2000/svg',
        strokeWidth: 1,
        'aria-hidden': 'true',
        focusable: 'false',
      },
      h('path', { d: 'M4.09372 11.9895L3.11865 14.0387', stroke: 'currentColor' }),
      h('path', { d: 'M12.1392 11.9895L13.1143 14.0387', stroke: 'currentColor' }),
      h('path', { d: 'M8.11646 4.78442V8.03442L10.6165 9.53442', stroke: 'currentColor' }),
      h('path', {
        d:
          'M8.11646 13.4094C11.154 13.4094 13.6165 10.947 13.6165 7.90942C13.6165 4.87186 11.154 2.40942 8.11646 2.40942C5.07889 2.40942 2.61646 4.87186 2.61646 7.90942C2.61646 10.947 5.07889 13.4094 8.11646 13.4094Z',
        stroke: 'currentColor',
      }),
      h('path', { d: 'M1.75952 4.74323C2.30657 3.65639 3.12646 2.73047 4.12926 2.05542', stroke: 'currentColor' }),
      h('path', { d: 'M14.3345 4.74323C13.7874 3.65639 12.9675 2.73047 11.9647 2.05542', stroke: 'currentColor' }),
    ),
    count > 0 ? h('span', { className: 'dshu-rail-dot' }) : null,
  )
}

/** Inline confirmation strip: name, current → target, update/cancel. */
function ConfirmBar(props) {
  const t = props.t
  const confirm = props.confirm
  const snapshot = props.snapshot === undefined || props.snapshot === null ? UI_EMPTY_SNAPSHOT : props.snapshot
  const busy =
    (snapshot.busyName !== undefined && snapshot.busyName !== null) || snapshot.updatingAll === true
  const name = typeof confirm.title === 'string' && confirm.title !== '' ? confirm.title : confirm.name
  const from = confirm.currentVersion === null || confirm.currentVersion === undefined ? '?' : confirm.currentVersion
  const to = confirm.latestVersion === null || confirm.latestVersion === undefined ? '?' : confirm.latestVersion
  return h(
    'div',
    { className: 'dshu-confirm', role: 'group', 'aria-label': t('confirm.title') },
    h(
      'div',
      { className: 'dshu-confirm-text' },
      h('div', { className: 'dshu-confirm-title' }, t('confirm.title')),
      h('div', { className: 'dshu-confirm-body' }, fill(t('confirm.body'), { name: name, from: from, to: to })),
    ),
    h(
      'div',
      { className: 'dshu-confirm-actions' },
      h(
        'button',
        {
          type: 'button',
          className: 'dshu-btn dshu-btn--filled',
          disabled: busy,
          title: busy ? t('row.updating') : undefined,
          onClick: function () {
            uiRun('confirmUpdate')
          },
        },
        t('confirm.update'),
      ),
      h(
        'button',
        {
          type: 'button',
          className: 'dshu-btn',
          disabled: busy,
          onClick: function () {
            uiRun('cancelConfirm')
          },
        },
        t('confirm.cancel'),
      ),
    ),
  )
}

/** One dismissible banner for results that no longer have a row. */
function UpdateNotice(props) {
  const t = props.t
  const notice = props.notice
  let level = 'info'
  if (notice.level === 'error') level = 'error'
  else if (notice.level === 'warn') level = 'warn'
  // The notice's own outcome word is translated; the Host diagnostic stays raw.
  let summary = t('row.failed')
  if (notice.kind === 'rolled-back') summary = t('row.rolledBack')
  else if (notice.kind === 'rollback-failed') summary = t('row.rollbackFailed')
  return h(
    'div',
    { className: 'dshu-banner dshu-banner--' + level, role: 'status' },
    h(
      'div',
      { className: 'dshu-banner-text' },
      notice.name === undefined || notice.name === null || notice.name === ''
        ? null
        : h('strong', { className: 'dshu-banner-name' }, notice.name + ' '),
      h('span', null, summary),
      notice.message === undefined || notice.message === null || notice.message === ''
        ? null
        : h('span', { className: 'dshu-banner-detail' }, ': ' + notice.message),
    ),
    h(
      'button',
      {
        type: 'button',
        className: 'dshu-iconbtn',
        'data-dshu-dismiss': 'notice',
        'data-dshu-notice': notice.id,
        'aria-label': t('notice.dismiss'),
        title: t('notice.dismiss'),
        onClick: function () {
          uiRun('dismissNotice', notice.id)
        },
      },
      '✕',
    ),
  )
}

/** One plugin row plus its confirmation strip and trailing result. */
function UpdateRow(props) {
  const t = props.t
  const row = props.row
  const snapshot = props.snapshot === undefined || props.snapshot === null ? UI_EMPTY_SNAPSHOT : props.snapshot
  const name = row.name
  const results = snapshot.results === undefined || snapshot.results === null ? {} : snapshot.results
  const result = results[name] === undefined ? null : results[name]
  const meta = uiStatusMeta(row.status)
  const busy = snapshot.busyName === name
  const busyElsewhere =
    snapshot.busyName !== undefined && snapshot.busyName !== null && snapshot.busyName !== name
  const blocked = busyElsewhere || snapshot.updatingAll === true
  const requirementText = uiRequirementText(row.requirements)
  const confirming = snapshot.confirm !== null && snapshot.confirm !== undefined && snapshot.confirm.name === name
  const note = uiRowNote(t, row, requirementText)
  const info = uiResultInfo(t, result)

  let title = null
  if (busy) title = t('row.updating')
  else if (blocked) title = t('panel.updatingAll')
  else if (row.status === 'incompatible') {
    title = requirementText === '' ? t('row.incompatible') : t('row.incompatible') + ': ' + requirementText
  }

  const action =
    row.status !== 'update' && row.status !== 'incompatible'
      ? null
      : h(
          'div',
          { className: 'dshu-row-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dshu-btn dshu-btn--accent',
              disabled: busy || blocked || row.status !== 'update',
              title: title === null ? undefined : title,
              'aria-label': t('row.update') + ' ' + (row.title === undefined ? name : row.title),
              onClick: function () {
                uiRun('requestUpdate', name)
              },
            },
            busy ? t('row.updating') : t('row.update'),
          ),
        )

  const metaLine = []
  if (typeof row.currentVersion === 'string' && row.currentVersion !== '') {
    metaLine.push(h('span', { key: 'current', className: 'dshu-ver' }, t('row.current') + ' ' + row.currentVersion))
  }
  if (row.status === 'latest') {
    metaLine.push(h('span', { key: 'label', className: 'dshu-ver' }, t('row.latestLabel')))
  } else if (typeof row.latestVersion === 'string' && row.latestVersion !== '') {
    metaLine.push(h('span', { key: 'latest', className: 'dshu-ver' }, t('row.latest') + ' ' + row.latestVersion))
  }

  const displayTitle = typeof row.title === 'string' && row.title !== '' ? row.title : name
  return h(
    'li',
    { className: 'dshu-item' },
    h(
      'div',
      { className: 'dshu-row' },
      h(
        'div',
        { className: 'dshu-row-main' },
        h(
          'div',
          { className: 'dshu-row-head' },
          h('span', { className: 'dshu-row-title', title: displayTitle }, displayTitle),
          h('span', { className: 'dshu-badge dshu-badge--' + meta.tone }, t(meta.label)),
        ),
        h('div', { className: 'dshu-row-meta' }, h('code', { className: 'dshu-name' }, name), metaLine),
        note === null
          ? null
          : h(
              'div',
              { className: 'dshu-row-note' + (note.tone === '' ? '' : ' dshu-row-note--' + note.tone) },
              note.text,
            ),
      ),
      action,
    ),
    confirming ? h(ConfirmBar, { key: 'confirm', t: t, confirm: snapshot.confirm, snapshot: snapshot }) : null,
    info === null
      ? null
      : h(
          'div',
          { className: 'dshu-result dshu-result--' + info.tone },
          h('span', { className: 'dshu-result-text' }, info.text),
          h(
            'button',
            {
              type: 'button',
              className: 'dshu-iconbtn',
              'data-dshu-dismiss': 'result',
              'data-dshu-result': name,
              'aria-label': t('notice.dismiss'),
              title: t('notice.dismiss'),
              onClick: function () {
                uiRun('dismissResult', name)
              },
            },
            '✕',
          ),
        ),
  )
}

/**
 * The update panel shared by the right-sidebar pane and the Plugins-page tab.
 * @param {object} props - `{ t, variant }`, variant `panel` (default) or `page`.
 */
export function UpdatePanel(props) {
  const input = props === undefined || props === null ? {} : props
  const t = uiT(input)
  const snapshot = uiUseSnapshot()
  const variant = input.variant === 'page' ? 'page' : 'panel'
  const rows = Array.isArray(snapshot.rows) ? snapshot.rows : []
  const results = snapshot.results === undefined || snapshot.results === null ? {} : snapshot.results
  const notices = Array.isArray(snapshot.notices) ? snapshot.notices : []
  const confirm = snapshot.confirm === undefined || snapshot.confirm === null ? null : snapshot.confirm
  const checking = snapshot.phase === 'checking'
  const busy =
    (snapshot.busyName !== undefined && snapshot.busyName !== null) || snapshot.updatingAll === true
  const updateCount = typeof snapshot.updateCount === 'number' ? snapshot.updateCount : uiCountUpdates(rows)
  const checkedAt = uiFormatCheckedAt(snapshot.lastCheckedAt)
  const lastCheckText = checkedAt === '' ? t('panel.never') : checkedAt
  const restartRequired = uiNeedsRestart(results)
  const allUpToDate =
    rows.length > 0 &&
    rows.every(function (row) {
      return row !== null && row !== undefined && row.status === 'latest'
    })
  const confirmInline =
    confirm !== null &&
    rows.some(function (row) {
      return row !== null && row !== undefined && typeof row === 'object' && row.name === confirm.name
    })

  let summaryText = ''
  if (checking) summaryText = t('panel.refreshing')
  else if (snapshot.phase === 'ready' && updateCount > 0) {
    summaryText = fill(t('panel.summary'), { count: updateCount })
  } else if (snapshot.phase === 'ready' && allUpToDate) summaryText = t('panel.allUpToDate')

  let body
  if (rows.length === 0) {
    let emptyText = t('panel.noPlugins')
    if (checking || snapshot.phase === 'idle' || snapshot.phase === undefined) {
      emptyText = t('panel.refreshing')
    } else if (snapshot.phase === 'failed') {
      emptyText = t('panel.checkFailed')
    }
    body = h('div', { className: 'dshu-empty' }, emptyText)
  } else {
    // The footer carries the "all up to date" summary; keep the rows visible so
    // their installed versions stay inspectable.
    body = h(
      'div',
      { className: 'dshu-body' },
      h(
        'ul',
        { className: 'dshu-list' },
        rows.map(function (row) {
          return h(UpdateRow, { key: row.name, t: t, row: row, snapshot: snapshot })
        }),
      ),
    )
  }

  const errorBanner =
    snapshot.error === undefined || snapshot.error === null || snapshot.error === ''
      ? null
      : h(
          'div',
          { className: 'dshu-banner dshu-banner--error', role: 'alert' },
          h(
            'div',
            { className: 'dshu-banner-text' },
            h('strong', { className: 'dshu-banner-name' }, t('panel.checkFailed')),
            h('span', null, ': ' + String(snapshot.error)),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshu-btn',
              onClick: function () {
                uiRun('refresh')
              },
            },
            t('panel.retry'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dshu-iconbtn',
              'data-dshu-dismiss': 'error',
              'aria-label': t('notice.dismiss'),
              title: t('notice.dismiss'),
              onClick: function () {
                uiRun('dismissError')
              },
            },
            '✕',
          ),
        )

  const restartBanner = restartRequired
    ? h(
        'div',
        { className: 'dshu-banner dshu-banner--warn', role: 'status' },
        h('div', { className: 'dshu-banner-text' }, t('panel.restartBanner')),
      )
    : null

  const noticesBlock =
    notices.length === 0
      ? null
      : h(
          'div',
          { className: 'dshu-notices' },
          notices.map(function (notice) {
            return h(UpdateNotice, { key: notice.id, t: t, notice: notice })
          }),
        )

  const busyTitle = snapshot.updatingAll === true ? t('panel.updatingAll') : t('row.updating')
  const showFooter = summaryText !== '' || updateCount > 0
  const footer = showFooter
    ? h(
        'div',
        { className: 'dshu-foot' },
        h('span', { className: 'dshu-summary' }, summaryText),
        updateCount > 0
          ? h(
              'button',
              {
                type: 'button',
                className: 'dshu-btn dshu-btn--filled',
                disabled: busy,
                title: busy ? busyTitle : t('panel.updateAll'),
                onClick: function () {
                  uiRun('updateAll')
                },
              },
              snapshot.updatingAll === true ? t('panel.updatingAll') : t('panel.updateAll'),
            )
          : null,
      )
    : null

  const refreshButton = h(
    'button',
    {
      type: 'button',
      className: 'dshu-btn',
      disabled: checking || busy,
      title: checking ? t('panel.refreshing') : busy ? busyTitle : t('panel.refresh'),
      'aria-label': t('panel.refresh'),
      onClick: function () {
        uiRun('refresh')
      },
    },
    checking ? t('panel.refreshing') : t('panel.refresh'),
  )

  const batch = snapshot.batch
  const batchProgress =
    batch !== null && batch !== undefined && typeof batch.total === 'number' && batch.total > 0
  const progressPercent = batchProgress
    ? Math.min(100, Math.round((((typeof batch.done === 'number' ? batch.done : 0) / batch.total) * 100)))
    : 0
  const progressBlock = busy
    ? h(
        'div',
        { className: 'dshu-progress-block', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'dshu-progress-label' }, uiProgressText(t, snapshot)),
        h(
          'div',
          { className: 'dshu-progress' },
          h('div', {
            className: 'dshu-progress-bar' + (batchProgress ? ' dshu-progress-bar--determinate' : ''),
            style: batchProgress ? { width: progressPercent + '%' } : undefined,
          }),
        ),
      )
    : null

  return h(
    'section',
    {
      className: 'dshu-panel dshu-panel--' + variant,
      'data-phase': typeof snapshot.phase === 'string' ? snapshot.phase : 'idle',
      'data-install-phase': typeof snapshot.installPhase === 'string' ? snapshot.installPhase : '',
    },
    h('style', null, UI_CSS),
    h(
      'div',
      { className: 'dshu-head' },
      h(
        'div',
        { className: 'dshu-head-text' },
        h('h2', { className: 'dshu-title' }, t('guide.title')),
        h(
          'div',
          { className: 'dshu-subtitle' },
          h('span', { className: 'dshu-last-check' }, t('panel.lastCheck') + ': ' + lastCheckText),
          snapshot.runtimeVersion === undefined || snapshot.runtimeVersion === null
            ? null
            : h('span', { className: 'dshu-runtime' }, ' · ' + String(snapshot.runtimeVersion)),
        ),
      ),
      refreshButton,
    ),
    progressBlock,
    errorBanner,
    noticesBlock,
    restartBanner,
    confirm !== null && !confirmInline
      ? h(ConfirmBar, { key: 'confirm', t: t, confirm: confirm, snapshot: snapshot })
      : null,
    body,
    footer,
  )
}

/**
 * The Plugins-page tab body: a wider variant of the shared panel.
 * @param {object} props - `{ t, variant, install, openPackage }`; only the panel is rendered.
 */
export function PluginUpdatesTab(props) {
  const input = props === undefined || props === null ? {} : props
  return h(UpdatePanel, { t: input.t, variant: input.variant === undefined ? 'page' : input.variant })
}

/**
 * The right-sidebar Guide capsule, replacing the Host's standard card.
 * @param {object} props - `{ entryId, kind, title, description, useTabInfo, t }`.
 */
export function GuideCard(props) {
  const input = props === undefined || props === null ? {} : props
  const t = uiT(input)
  const snapshot = uiUseSnapshot()
  const updateCount = typeof snapshot.updateCount === 'number' ? snapshot.updateCount : 0
  const title =
    typeof input.title === 'string' && input.title !== '' ? input.title : t('guide.title')
  const description =
    typeof input.description === 'string' && input.description !== ''
      ? input.description
      : t('guide.description')

  // The slot hands this card the Guide tab's own `useTabInfo` hook. A React hook
  // must run during render, so read it once here; calling it from the click
  // handler would throw (hooks cannot run in event handlers) and the card would
  // silently do nothing.
  let tabActions
  if (typeof input.useTabInfo === 'function') {
    try {
      const info = input.useTabInfo()
      tabActions = info !== null && info !== undefined && info.tab !== undefined ? info.tab.actions : undefined
    } catch (error) {
      tabActions = undefined
    }
  }

  function openTab() {
    try {
      if (tabActions !== undefined && tabActions !== null && typeof tabActions.openTab === 'function') {
        tabActions.openTab(input.kind, { replaceTab: true })
        return
      }
    } catch (error) {
      /* fall back to the injected opener below */
    }
    if (typeof input.openTab === 'function') {
      try {
        input.openTab()
      } catch (error) {
        /* the seat is optional; never break the Guide */
      }
    }
  }

  return h(
    React.Fragment,
    null,
    h('style', { key: 'style' }, UI_CSS),
    h(
      'button',
      { key: 'card', type: 'button', className: 'dshu-guide', onClick: openTab, 'aria-label': title },
      h(
        'span',
        { className: 'dshu-guide-icon' },
        h(UpdateGlyph, { size: 26 }),
        updateCount > 0 ? h('span', { className: 'dshu-dot', 'aria-hidden': 'true' }) : null,
      ),
      h(
        'span',
        { className: 'dshu-guide-body' },
        h('span', { className: 'dshu-guide-title' }, title),
        h('span', { className: 'dshu-guide-desc' }, description),
      ),
    ),
  )
}

/**
 * The right-sidebar tab chip title with the red update dot.
 * @param {object} props - `{ useTabInfo, t }`; clicks are handled by the Host tab bar.
 */
export function TabChip(props) {
  const input = props === undefined || props === null ? {} : props
  const t = uiT(input)
  const snapshot = uiUseSnapshot()
  const updateCount = typeof snapshot.updateCount === 'number' ? snapshot.updateCount : 0
  return h(
    React.Fragment,
    null,
    h('style', { key: 'style' }, UI_CSS),
    h(
      'span',
      { key: 'chip', className: 'dshu-chip' },
      h('span', { className: 'dshu-chip-label' }, t('guide.title')),
      updateCount > 0 ? h('span', { className: 'dshu-chip-dot', 'aria-hidden': 'true' }) : null,
    ),
  )
}

/**
 * The update toast rendered in the frame's overlay seat.
 *
 * One line per finished update (or one summary line per batch), auto-dismissed
 * after a few seconds and dismissible by hand. It reads the snapshot's `toast`
 * field, so the controller decides what happened and this seat only reports it.
 * @param {object} props - `{ t }` from the registration's locale namespace.
 * @returns {object | null} the toast element, or null when there is nothing to say.
 */
export function UpdateToast(props) {
  const input = props === undefined || props === null ? {} : props
  const t = uiT(input)
  const snapshot = uiUseSnapshot()
  const toast = snapshot.toast === undefined ? null : snapshot.toast

  React.useEffect(
    function () {
      if (toast === null) return undefined
      const handle = setTimeout(function () {
        uiRun('dismissToast', toast.id)
      }, toast.kind === 'batch' ? 6000 : 5000)
      return function () {
        clearTimeout(handle)
      }
    },
    [toast === null ? null : toast.id],
  )

  if (toast === null) return null
  const tone = toast.tone === 'error' || toast.tone === 'warn' ? toast.tone : 'success'
  return h(
    React.Fragment,
    null,
    h('style', { key: 'style' }, UI_CSS),
    h(
      'div',
      { key: 'toast', className: 'dshu-toast dshu-toast--' + tone, role: 'status', 'aria-live': 'polite' },
      h('span', { className: 'dshu-toast-text' }, uiToastText(t, toast)),
      h(
        'button',
        {
          type: 'button',
          className: 'dshu-toast-close',
          'aria-label': t('toast.close'),
          title: t('toast.close'),
          onClick: function () {
            uiRun('dismissToast', toast.id)
          },
        },
        '✕',
      ),
    ),
  )
}
