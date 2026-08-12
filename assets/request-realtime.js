(() => {
  if (!location.pathname.startsWith('/app')) return;

  let socket;
  let reconnectTimer;
  let reconnectDelay = 1000;
  let refreshPending = false;
  let suppressRefreshUntil = 0;

  const indicator = document.createElement('div');
  indicator.setAttribute('aria-live', 'polite');
  indicator.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:70;display:flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #dce4ed;border-radius:999px;background:#fff;color:#68758a;box-shadow:0 6px 18px rgba(30,48,75,.12);font:700 12px Pretendard,"Noto Sans KR",sans-serif';
  indicator.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#98a2b3"></span><span>실시간 연결 중</span>';

  function setState(connected) {
    const dot = indicator.firstElementChild;
    const label = indicator.lastElementChild;
    dot.style.background = connected ? '#16a34a' : '#98a2b3';
    label.textContent = connected ? '실시간 연결' : '재연결 중';
  }

  function editorOpen() {
    return Boolean(document.querySelector('.request-overlay.open, #requestModal.open'));
  }

  function refresh() {
    if (editorOpen() || document.visibilityState !== 'visible') {
      refreshPending = true;
      return;
    }
    location.reload();
  }

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(protocol + '//' + location.host + '/ws/requests');
    socket.addEventListener('open', () => {
      reconnectDelay = 1000;
      setState(true);
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'request.changed' && Date.now() >= suppressRefreshUntil) refresh();
      } catch (_error) {
        // Ignore malformed messages and keep the connection alive.
      }
    });
    socket.addEventListener('close', () => {
      setState(false);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15000);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(indicator);
    document.addEventListener('click', () => {
      if (refreshPending) setTimeout(() => {
        if (!editorOpen()) location.reload();
      }, 100);
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-manager-id]')) suppressRefreshUntil = Date.now() + 4000;
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (refreshPending && document.visibilityState === 'visible' && !editorOpen()) location.reload();
    });
    connect();
  });
})();
