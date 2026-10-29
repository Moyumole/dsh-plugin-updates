/**
 * Browser entry: wire the controller to the live client services and register
 * the seats the update check appears in.
 *
 * - Right Sidebar: a tab type plus its body, live tab title, and a Guide card
 *   with the update badge.
 * - Plugins page: a tab after the page's own Installed tab, available without an
 *   open Session.
 * - Left sidebar: the host's Plugins icon cell, shadowed so a red dot can ride
 *   the icon while updates wait.
 *
 * Every registration is effect-owned: services that this profile does not ship
 * simply leave the corresponding seat absent instead of failing the page.
 */
import { DICTS, NS } from './i18n.js'
import { createRegistry } from './registry.js'
import { createController } from './controller.js'
import { GuideCard, LeftSidebarPluginsIcon, PluginUpdatesTab, TabChip, UpdateGlyph, UpdatePanel, UpdateToast, setActiveController } from './ui.js'

/** This package's name: the client module id, the Loader row, and its self-exclusion. */
const DOC_ID = '@moyumole/dsh-plugin-updates'
/** The page kind the right Sidebar opens this panel by. */
const KIND = 'plugin-updates'
/** The Plugins page tab id. */
const PANEL_ID = 'plugin-updates'
/** Where the Guide card sits among the other page capsules. */
const GUIDE_ORDER = 40
/** The Guide card's identity within this tab type; must be unique per provider. */
const GUIDE_ENTRY_ID = 'plugin-updates'

/**
 * Services this browser half cannot work without. `remote.pluginManager` is a
 * nested service name: Cordis resolves `ctx.remote.pluginManager` by reading the
 * `remote.pluginManager` service, so it must be declared here — a dynamic
 * `ctx.inject` is not enough (the access would throw
 * `cannot get property "remote.pluginManager" without inject`).
 */
const inject = ['slots', 'locale', 'remote', 'remote.pluginManager']

/** The dsh release the page was served by, when the boot payload names it. */
function readBootRuntimeVersion() {
  try {
    const boot = typeof window !== 'undefined' ? window.__DSH_BOOT__ : undefined
    const release = boot !== undefined && boot !== null ? boot.release : undefined
    return release !== undefined && release !== null && typeof release.version === 'string'
      ? release.version
      : undefined
  } catch {
    return undefined
  }
}

/** The active locale id, for localizing installed bundle titles. */
function readLocaleId(ctx) {
  try {
    const snapshot = ctx.locale.getSnapshot()
    return snapshot !== undefined && snapshot !== null && typeof snapshot.active === 'string'
      ? snapshot.active
      : 'en'
  } catch {
    return 'en'
  }
}

/** Release a list of disposers, reporting each failure instead of stopping the teardown. */
function disposeAll(disposers) {
  for (const dispose of [...disposers].reverse()) {
    try {
      dispose()
    } catch (error) {
      console.error('[dsh-plugin-updates] teardown step failed:', error)
    }
  }
  disposers.length = 0
}

/**
 * Contribute the Plugins-page tab and the right Sidebar seat, and start the
 * once-per-page update check.
 * @param {object} ctx - the browser plugin context.
 */
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, DICTS), 'dsh-plugin-updates: dictionary')
  const t = ctx.locale.bind(NS)

  const registry = createRegistry()
  const controller = createController({
    remote: () => ctx.remote,
    registry,
    getRuntimeVersion: readBootRuntimeVersion,
    getLocaleId: () => readLocaleId(ctx),
    selfName: DOC_ID,
  })
  setActiveController(controller)
  ctx.effect(() => () => {
    controller.dispose()
    setActiveController(null)
  }, 'dsh-plugin-updates: controller')

  // A language switch re-localizes bundle titles; the registry cache makes this cheap.
  ctx.effect(() => ctx.locale.subscribe(() => {
    if (controller.getSnapshot().phase === 'ready') controller.handleHostChanged()
  }), 'dsh-plugin-updates: localized bundle titles')

  // `remote.pluginManager` is a static dependency, so the namespace is ready with
  // this plugin; subscribing here is what makes the first check automatic on
  // every page load, and host changes keep the panel current.
  ctx.effect(() => {
    const disposers = [
      ctx.remote.$on('plugin-manager/changed', () => controller.handleHostChanged()),
      ctx.remote.$on('plugin-manager/install-state', (frame) => controller.handleInstallState(frame)),
    ]
    void controller.refresh()
    return () => disposeAll(disposers)
  }, 'dsh-plugin-updates: host events and the first check')

  // Right Sidebar: the tab type must be registered before its body seat exists,
  // and both follow the registry's lifetime.
  ctx.inject(['sidebarRightTabs', 'sidebarRight'], (injected) => {
    const tabs = injected.get('sidebarRightTabs')
    const navigation = injected.get('sidebarRight')
    if (tabs === undefined || tabs === null || typeof tabs.register !== 'function') return
    const disposers = []
    const release = () => disposeAll(disposers)
    try {
      disposers.push(tabs.register({
        id: DOC_ID,
        kind: KIND,
        priority: 'extension',
        keepMounted: true,
        title: () => t('guide.title'),
        guide: [{
          id: GUIDE_ENTRY_ID,
          order: GUIDE_ORDER,
          title: () => t('guide.title'),
          description: () => t('guide.description'),
          icon: UpdateGlyph,
        }],
      }))
      disposers.push(ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: DOC_ID,
        locale: NS,
      }, UpdatePanel)))
      disposers.push(ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab.title',
        key: DOC_ID,
        locale: NS,
      }, TabChip)))
      disposers.push(ctx.slots.inject('sidebar.right.tab.guide.entry', () => ctx.slots.register({
        name: 'sidebar.right.tab.guide.entry',
        key: DOC_ID,
        locale: NS,
        inject: () => ({
          // Fallback opener for the Guide card: the card prefers the Guide tab's
          // own `useTabInfo().tab.actions.openTab`, but the navigation service
          // opens the same page if that hook is unavailable.
          openTab: () => {
            if (navigation === undefined || navigation === null || typeof navigation.openTab !== 'function') {
              throw new Error('sidebarRight navigation is unavailable')
            }
            navigation.openTab(KIND)
          },
        }),
      }, GuideCard)))
    } catch (error) {
      console.error('[dsh-plugin-updates] right sidebar registration failed:', error)
      release()
    }
    return release
  })

  // Left sidebar: shadow the Plugins icon's own cell so a red dot can ride it
  // while updates wait. The cell id stays `plugins`, so the click still selects
  // the Plugins panel. A list slot refuses a same-priority duplicate and renders
  // the lowest priority, so the host's own entry stays registered underneath.
  try {
    ctx.slots.inject('sidebar.panellist', () => {
      try {
        return ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'plugins',
          order: 0,
          priority: -1,
          label: () => t('sidebar.pluginsLabel'),
          locale: NS,
        }, LeftSidebarPluginsIcon)
      } catch (error) {
        console.error('[dsh-plugin-updates] left sidebar badge registration failed:', error)
        return () => {}
      }
    })
  } catch (error) {
    console.error('[dsh-plugin-updates] left sidebar badge seat unavailable:', error)
  }

  // Update toasts ride the frame-wide overlay seat, so a finished update is
  // reported even when the row itself is out of view.
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'plugin-updates-toast',
    order: 90,
    label: () => t('guide.title'),
    locale: NS,
  }, UpdateToast))

  // Plugins page: a global tab, so the panel is reachable with no Session open.
  ctx.slots.inject('plugins.tab', () => ctx.slots.register({
    name: 'plugins.tab',
    id: PANEL_ID,
    order: GUIDE_ORDER,
    label: () => t('tab.label'),
    locale: NS,
  }, PluginUpdatesTab))
}
