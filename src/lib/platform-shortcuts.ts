export interface NavigatorLike {
  userAgentData?: { platform?: string };
  platform?: string;
  userAgent?: string;
}

export interface ShortcutEventLike {
  code?: string;
  key?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface ShortcutLabels {
  search: string;
  jump: string;
  jumpTitle: string;
}

const MAC_PLATFORM_RE = /Mac|iOS|iPadOS|iPhone|iPad|iPod/i;

export function detectIsMac(
  nav: NavigatorLike | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
): boolean {
  const uadPlatform = nav?.userAgentData?.platform?.trim();
  if (uadPlatform) return MAC_PLATFORM_RE.test(uadPlatform);
  const platform = nav?.platform?.trim();
  if (platform) return MAC_PLATFORM_RE.test(platform);
  return MAC_PLATFORM_RE.test(nav?.userAgent ?? '');
}

export function getShortcutLabels(isMac: boolean): ShortcutLabels {
  return isMac
    ? { search: '⌘ K', jump: '⌥ J', jumpTitle: '快捷键 ⌥ J' }
    : { search: 'Ctrl K', jump: 'Alt J', jumpTitle: '快捷键 Alt + J' };
}

export function matchesSearchShortcut(event: ShortcutEventLike, isMac: boolean): boolean {
  if (event.code !== 'KeyK' || event.altKey || event.shiftKey) return false;
  return isMac ? Boolean(event.metaKey && !event.ctrlKey) : Boolean(event.ctrlKey && !event.metaKey);
}

export function matchesJumpShortcut(event: ShortcutEventLike): boolean {
  return Boolean(event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === 'KeyJ');
}

export function syncPlatformShortcuts(
  rootDoc: Document | undefined = typeof document !== 'undefined' ? document : undefined,
  nav?: NavigatorLike,
): boolean {
  if (!rootDoc) return false;
  const isMac = detectIsMac(nav);
  const labels = getShortcutLabels(isMac);
  rootDoc.documentElement.dataset.platform = isMac ? 'mac' : 'other';
  rootDoc.querySelectorAll<HTMLElement>('[data-search-shortcut]').forEach((el) => {
    el.textContent = labels.search;
    el.dataset.shortcutSynced = 'true';
  });
  rootDoc.querySelectorAll<HTMLElement>('[data-jump-shortcut]').forEach((el) => {
    el.textContent = labels.jump;
    el.dataset.shortcutSynced = 'true';
  });
  rootDoc.querySelectorAll<HTMLElement>('[data-jump-shortcut-title]').forEach((el) => {
    el.setAttribute('title', labels.jumpTitle);
  });
  return isMac;
}
