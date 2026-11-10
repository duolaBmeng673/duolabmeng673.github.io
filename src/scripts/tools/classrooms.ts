import themeCss from '../../styles/tools/classrooms.css?raw';

interface ClassroomApi { snapshot(): { query: unknown } | null }
interface ClassroomWindow extends Window {
  createHitRoomApp?: (env: Window) => { mount(options?: { enhanced?: boolean }): ClassroomApi };
}

// Preserve the upstream engine. Only its presentation is adapted inside its
// existing shadow root; inherited CSS variables follow the blog theme live.
const palette: Record<string, string> = {
  '#132b3a': '--text', '#f4f8fb': '--bg', '#197f83': '--focus',
  '#17666b': '--link', '#dbe5ec': '--border', '#fff': '--surface',
  '#173d56': '--accent', '#657e8d': '--text-muted', '#527182': '--text-muted',
  '#637d8d': '--text-muted', '#147d78': '--accent', '#f7fafc': '--surface',
  '#e7eef2': '--border', '#d7eae6': '--surface-soft', '#edd8d1': '--warm',
  '#526f7d': '--text-muted', '#a3452e': '--warm-text', '#cbdde5': '--border',
  '#eaf2f6': '--surface-soft', '#315c71': '--text-soft', '#fff1e9': '--warm-soft',
  '#994426': '--warm-text', '#ebcbbd': '--border-strong', '#9aadb8': '--text-muted',
  '#e8f2ef': '--surface-soft', '#a45d48': '--warm-text', '#e7f1ee': '--surface-soft',
  '#28665c': '--text-soft', '#f2e5df': '--warm-soft', '#945b48': '--warm-text',
  '#e8edf1': '--surface-raised', '#677984': '--text-muted', '#bdcfd9': '--border-strong',
  '#24485d': '--text', '#e8f0f5': '--surface-soft', '#8296a2': '--text-muted',
};

const mountPoint = document.getElementById('app');
const loading = document.querySelector<HTMLElement>('[data-classroom-loading]');
const importButton = document.querySelector<HTMLButtonElement>('[data-classroom-import]');
try {
  const createApp = (window as ClassroomWindow).createHitRoomApp;
  if (!createApp || !mountPoint) throw new Error('查询界面未能加载，请刷新页面，或使用下方的本机助手。');
  // enhanced=false is intentionally offline: never connect to campus or a
  // localhost API from the public blog, and never mount authentication forms.
  const api = createApp(window).mount({ enhanced: false });
  const shadow = mountPoint.querySelector('#hit-empty-room-helper')?.shadowRoot;
  if (!shadow) throw new Error('当前浏览器无法显示查询界面，请使用下方的本机助手。');
  const originalStyle = shadow.querySelector('style');
  if (originalStyle) originalStyle.textContent = (originalStyle.textContent ?? '').replace(/#[0-9a-f]{3,8}\b/gi, (color) => palette[color.toLowerCase()] ? `var(${palette[color.toLowerCase()]})` : color);
  const style = document.createElement('style');
  style.textContent = themeCss;
  shadow.append(style);
  shadow.querySelector('.intro h1')?.remove();
  shadow.querySelector('.intro .subtitle')?.remove();
  const offlineNote = shadow.querySelector('.tools')?.nextElementSibling;
  if (offlineNote) offlineNote.textContent = '本站仅查看已导入的快照。最新数据请通过上方“使用本机实时查询”入口获取，再导出 JSON 导入这里。';
  const status = shadow.getElementById('status');
  status?.setAttribute('role', 'status');
  status?.setAttribute('aria-live', 'polite');
  const updatePresentation = () => {
    const snapshot = api.snapshot();
    if (snapshot) {
      // The engine caches by query. Remember the validated imported query too,
      // so refreshing the blog reopens that cache instead of the default week.
      try { localStorage.setItem('hit-room-query-v2', JSON.stringify(snapshot.query)); } catch {}
      shadow.querySelectorAll('.room-note').forEach((note) => {
        if (note.textContent === '所选时段状态未知，请查看原页面') note.textContent = '所选时段状态未知，请在本机助手核对';
      });
      return;
    }
    const empty = shadow.querySelector('.empty');
    if (empty) {
      const title = document.createElement('strong'); title.textContent = '还没有导入教室快照';
      empty.replaceChildren(title, document.createTextNode('点击上方“导入 JSON 快照”，选择本机助手导出的完整数据。本站未预置数据，也不会向学校发起查询。'));
    }
    const term = shadow.getElementById('termLabel');
    const week = shadow.getElementById('weekLabel');
    const location = shadow.getElementById('locationLabel');
    if (term) term.textContent = '待导入';
    if (week) week.textContent = '—';
    if (location) location.textContent = '尚未导入快照';
  };
  const cards = shadow.getElementById('cards');
  if (cards) new MutationObserver(updatePresentation).observe(cards, { childList: true });
  updatePresentation();
  importButton?.addEventListener('click', () => shadow.getElementById('file')?.click());
  if (importButton) importButton.hidden = false;
  if (loading) loading.hidden = true;
} catch (error) {
  if (loading) loading.textContent = error instanceof Error ? error.message : '查询界面未能加载，请刷新页面或使用本机助手。';
}
