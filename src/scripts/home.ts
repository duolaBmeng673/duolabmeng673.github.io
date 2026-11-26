import { STORAGE_KEYS } from '../lib/storage-keys';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// 1. Stage Presets + Terminal + RSS Copy
function initHeroStage() {
  const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
  if (!stage || stage.dataset.initialized === '1') return;
  stage.dataset.initialized = '1';

  const buttons = [...stage.querySelectorAll<HTMLButtonElement>('[data-preset-slug]')];
  const panels = [...stage.querySelectorAll<HTMLElement>('[data-preset-panel]')];
  const cmdNode = stage.querySelector<HTMLElement>('[data-terminal-cmd]');
  const copyBtn = stage.querySelector<HTMLButtonElement>('[data-copy-rss]');

  let typingTimer = 0;
  let resetTimer = 0;

  const typeCommand = (text: string, animate: boolean) => {
    if (!cmdNode) return;
    window.clearTimeout(typingTimer);
    if (!animate || reducedMotion()) {
      cmdNode.textContent = text;
      return;
    }
    let idx = 0;
    cmdNode.textContent = '';
    const step = () => {
      idx += 1;
      cmdNode.textContent = text.slice(0, idx);
      if (idx < text.length) {
        typingTimer = window.setTimeout(step, 18);
      }
    };
    step();
  };

  const activatePreset = (slug: string, persist: boolean, animate: boolean) => {
    const matched = buttons.find((btn) => btn.dataset.presetSlug === slug) ?? buttons[0];
    if (!matched) return;
    const activeSlug = matched.dataset.presetSlug ?? 'all';

    for (const btn of buttons) {
      btn.setAttribute('aria-checked', String(btn.dataset.presetSlug === activeSlug));
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.presetPanel !== activeSlug;
    }

    typeCommand(`notes ls --cat=${activeSlug} --limit=6`, animate);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS.preset, activeSlug);
      } catch {
        /* Storage is optional. */
      }
    }
    const PRESET_TRAIL_RGB: Record<string, string> = {
      all: '139 92 246',
      research: '37 99 235',
      cs: '225 65 107',
      '837': '13 148 136',
    };
    document.documentElement.dataset.preset = activeSlug;
    document.documentElement.style.setProperty('--trail-rgb', PRESET_TRAIL_RGB[activeSlug] ?? PRESET_TRAIL_RGB.all);
    window.dispatchEvent(new CustomEvent('duolabmeng673:preset-change', { detail: { slug: activeSlug } }));
  };

  const initial = document.documentElement.dataset.preset || 'all';
  activatePreset(initial, false, false);

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.presetSlug;
      if (slug) activatePreset(slug, true, true);
    });
  }

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rss.xml`);
    } catch {
      /* Clipboard permission fallback */
    }
    copyBtn.textContent = '✓ 已复制 RSS';
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      copyBtn.textContent = '⧉ 复制 RSS';
    }, 1400);
  });
}

// 2. Zero-React Daily Review Card (seeded by Asia/Shanghai date, with shuffle)
interface DailyReviewEntry {
  question: string;
  isExam: boolean;
  subject: string;
  noteTitle: string;
  href: string;
}

interface DailyReviewPoolPayload {
  buildDate: string;
  initialIndex: number;
  items: DailyReviewEntry[];
}

function pickDailyIndex(dateStr: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i += 1) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

function getShanghaiDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function initDailyReview() {
  const card = document.querySelector<HTMLElement>('[data-daily-review]');
  const poolScript = document.querySelector<HTMLScriptElement>('#daily-review-pool');
  if (!card || !poolScript || card.dataset.initialized === '1') return;
  card.dataset.initialized = '1';

  let payload: DailyReviewPoolPayload | null = null;
  try {
    payload = JSON.parse(poolScript.textContent || 'null') as DailyReviewPoolPayload | null;
  } catch {
    payload = null;
  }
  const items = payload?.items ?? [];
  if (!items.length) return;

  const badgeEl = card.querySelector<HTMLElement>('[data-review-badge]');
  const sourceEl = card.querySelector<HTMLElement>('[data-review-source]');
  const dateEl = card.querySelector<HTMLElement>('[data-review-date]');
  const questionEl = card.querySelector<HTMLElement>('[data-review-question]');
  const linkEl = card.querySelector<HTMLAnchorElement>('[data-review-link]');
  const shuffleBtn = card.querySelector<HTMLButtonElement>('[data-review-shuffle]');

  const renderItem = (idx: number, displayDate?: string) => {
    const item = items[idx];
    if (!item) return;
    if (badgeEl) badgeEl.hidden = !item.isExam;
    if (sourceEl) sourceEl.textContent = `${item.subject} · ${item.noteTitle}`;
    if (dateEl && displayDate) dateEl.textContent = displayDate;
    if (questionEl) questionEl.textContent = item.question;
    if (linkEl) linkEl.href = item.href;
  };

  const today = getShanghaiDateString();
  let currentIndex = pickDailyIndex(today, items.length);
  renderItem(currentIndex, today);

  shuffleBtn?.addEventListener('click', () => {
    if (items.length <= 1) return;
    let next = currentIndex;
    for (let attempt = 0; attempt < 6 && next === currentIndex; attempt += 1) {
      next = Math.floor(Math.random() * items.length);
    }
    if (next === currentIndex) next = (currentIndex + 1) % items.length;
    currentIndex = next;
    renderItem(currentIndex);
  });
}

initHeroStage();
initDailyReview();
