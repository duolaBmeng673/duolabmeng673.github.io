const LIST = document.querySelector<HTMLElement>('.study-series-list');

if (LIST && LIST.dataset.studyTransitionInit !== 'true') {
  LIST.dataset.studyTransitionInit = 'true';
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const clearLeaveState = () => {
    LIST.querySelectorAll('.study-series-row.is-entering-module').forEach((row) => {
      row.classList.remove('is-entering-module');
    });
  };

  LIST.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (reducedMotion()) return;
    const target = event.target as HTMLElement | null;
    const link = target?.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target) return;
    const row = link.closest<HTMLElement>('.study-series-row');
    row?.classList.add('is-entering-module');
  });

  window.addEventListener('pageshow', clearLeaveState);
}

export {};
