/**
 * Copy for dsh-plugin-updates, in English and Chinese.
 *
 * The two dictionaries must always carry the same key set; `test/ui-smoke.test.mjs`
 * enforces that, and the panel falls back to English when a locale is not known.
 */

/** Locale namespace this plugin registers its dictionary under. */
export const NS = 'pluginUpdates'

/** Every message the panel, the Guide card, and the tab chip can render. */
export const DICTS = {
  en: {
    'guide.title': 'Plugin Updates',
    'guide.description': 'Check installed plugins for newer npm versions and update them in place.',
    'tab.label': 'Plugin updates',
    'sidebar.pluginsLabel': 'Plugins',
    'panel.lastCheck': 'Last checked',
    'panel.never': 'Never',
    'panel.refresh': 'Refresh',
    'panel.refreshing': 'Checking…',
    'panel.checkFailed': 'Update check failed',
    'panel.retry': 'Retry',
    'panel.noPlugins': 'No third-party plugins to check.',
    'panel.allUpToDate': 'All plugins are up to date.',
    'panel.summary': '{count} plugin(s) can be updated',
    'panel.updateAll': 'Update all',
    'panel.updatingAll': 'Updating all…',
    'panel.restartBanner': 'Restart DSH for the updated plugins to take effect.',
    'row.current': 'Current',
    'row.latest': 'Latest',
    'row.update': 'Update',
    'row.updating': 'Updating…',
    'row.updatedRestart': 'Updated — restart DSH to apply',
    'row.updatedApplied': 'Updated — hot update applied',
    'row.failed': 'Update failed',
    'row.rolledBack': 'Update failed and was rolled back to the previous version',
    'row.rollbackFailed': 'Update failed and the rollback failed — check this plugin manually',
    'row.incompatible': 'Not compatible with this DSH version',
    'row.checkFailed': 'Version check failed',
    'row.unsupported': 'Installed from a non-registry source; in-place updates are unsupported',
    'row.latestLabel': 'Up to date',
    'status.latest': 'Up to date',
    'status.update': 'Update available',
    'status.incompatible': 'Incompatible',
    'status.failed': 'Check failed',
    'status.unsupported': 'Unsupported',
    'confirm.title': 'Confirm update',
    'confirm.body': 'Update {name} from {from} to {to}?',
    'confirm.update': 'Update',
    'confirm.cancel': 'Cancel',
    'error.noManager': 'The plugin manager is not available in this DSH version.',
    'error.noRemote': 'The DSH Remote service is not available.',
    'notice.dismiss': 'Dismiss',
    'progress.removing': 'Removing the old version…',
    'progress.installing': 'Installing the new version…',
    'progress.applying': 'Applying the update…',
    'progress.rollingBack': 'Install failed — rolling back…',
    'progress.cancelling': 'Cancelling…',
    'progress.batch': 'Updating {done}/{total}…',
    'toast.updated': '{name} updated — restart DSH to apply',
    'toast.applied': '{name} updated — hot update applied',
    'toast.rolledBack': '{name} update failed and was rolled back',
    'toast.failed': '{name} update failed',
    'toast.rollbackFailed': '{name} update and rollback both failed — check it manually',
    'toast.batch': 'Batch update finished: {updated} updated, {failed} failed',
    'toast.close': 'Dismiss',
  },
  zh: {
    'guide.title': '插件更新',
    'guide.description': '检查已安装插件在 npm 上的新版本，并就地更新。',
    'tab.label': '插件更新',
    'sidebar.pluginsLabel': '插件',
    'panel.lastCheck': '上次检查',
    'panel.never': '从未检查',
    'panel.refresh': '刷新',
    'panel.refreshing': '检查中…',
    'panel.checkFailed': '检查更新失败',
    'panel.retry': '重试',
    'panel.noPlugins': '没有需要检查的第三方插件。',
    'panel.allUpToDate': '全部插件已是最新。',
    'panel.summary': '{count} 个插件可更新',
    'panel.updateAll': '全部更新',
    'panel.updatingAll': '正在全部更新…',
    'panel.restartBanner': '请重启 DSH，使已更新的插件生效。',
    'row.current': '当前',
    'row.latest': '最新',
    'row.update': '更新',
    'row.updating': '更新中…',
    'row.updatedRestart': '已更新，需重启 DSH 生效',
    'row.updatedApplied': '已更新，热更新已生效',
    'row.failed': '更新失败',
    'row.rolledBack': '更新失败，已回滚到旧版本',
    'row.rollbackFailed': '更新失败且回滚失败，请手动检查该插件',
    'row.incompatible': '与当前 DSH 版本不兼容',
    'row.checkFailed': '版本检查失败',
    'row.unsupported': '非 npm registry 来源，不支持就地更新',
    'row.latestLabel': '已是最新',
    'status.latest': '已最新',
    'status.update': '可更新',
    'status.incompatible': '不兼容',
    'status.failed': '检查失败',
    'status.unsupported': '不支持',
    'confirm.title': '确认更新',
    'confirm.body': '将 {name} 从 {from} 更新到 {to}？',
    'confirm.update': '更新',
    'confirm.cancel': '取消',
    'error.noManager': '当前 DSH 版本中没有可用的插件管理器。',
    'error.noRemote': 'DSH 远端服务不可用。',
    'notice.dismiss': '关闭',
    'progress.removing': '正在移除旧版本…',
    'progress.installing': '正在安装新版本…',
    'progress.applying': '正在应用更新…',
    'progress.rollingBack': '安装失败，正在回滚…',
    'progress.cancelling': '正在取消…',
    'progress.batch': '正在更新 {done}/{total}…',
    'toast.updated': '{name} 已更新，重启 DSH 后生效',
    'toast.applied': '{name} 已更新，热更新已生效',
    'toast.rolledBack': '{name} 更新失败，已回滚到旧版本',
    'toast.failed': '{name} 更新失败',
    'toast.rollbackFailed': '{name} 更新与回滚均失败，请手动检查',
    'toast.batch': '批量更新完成：{updated} 个成功，{failed} 个失败',
    'toast.close': '关闭',
  },
}

/**
 * Pick the dictionary for a locale id.
 * @param {string | undefined} localeId - active locale, e.g. `zh-CN`, `en-US`.
 * @returns {Record<string, string>} the matching dictionary.
 */
export function dict(localeId) {
  const id = typeof localeId === 'string' ? localeId.toLowerCase() : ''
  return id.indexOf('zh') === 0 ? DICTS.zh : DICTS.en
}

/**
 * Fill `{name}`-style placeholders in a translated template.
 * @param {string} template - translated template text.
 * @param {Record<string, string | number> | undefined} params - placeholder values.
 * @returns {string} the filled text, with unknown placeholders left untouched.
 */
export function fill(template, params) {
  if (typeof template !== 'string') return ''
  if (params === undefined || params === null) return template
  return template.replace(/\{(\w+)\}/g, function (match, key) {
    const value = params[key]
    if (value === undefined || value === null) return match
    return String(value)
  })
}
