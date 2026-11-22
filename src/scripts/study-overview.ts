const LIST = document.querySelector<HTMLElement>('.study-series-list');

if (LIST && LIST.dataset.studyTransitionInit !== 'true') {
  LIST.dataset.studyTransitionInit = 'true';
  const main = document.getElementById('main-content');
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let leavingTimer = 0;

  const clearLeaveState = () => {
    if (leavingTimer) {
      window.clearTimeout(leavingTimer);
      leavingTimer = 0;
    }
    main?.classList.remove('study-page-leaving');
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
    if (!row || !main) return;

    event.preventDefault();
    clearLeaveState();
    row.classList.add('is-entering-module');
    main.classList.add('study-page-leaving');
    leavingTimer = window.setTimeout(() => {
      window.location.href = link.href;
    }, 120);
  });

  window.addEventListener('pageshow', clearLeaveState);
}

export {};
