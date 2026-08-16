(() => {
  if (!location.pathname.startsWith('/app') || !('serviceWorker' in navigator)) return;
  let deferredPrompt = null;
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function applicationKey(value) { const padding = '='.repeat((4 - value.length % 4) % 4), raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(char => char.charCodeAt(0))); }
  async function enablePush() {
    if (!('Notification' in window) || !('PushManager' in window)) throw new Error('이 기기는 푸시 알림을 지원하지 않습니다.');
    if (Notification.permission === 'denied') throw new Error('Edge 주소창 왼쪽의 사이트 정보 아이콘을 누른 뒤 “이 사이트에 대한 권한”에서 알림을 “허용”으로 변경하고 페이지를 새로고침해 주세요.');
    const permission = await Notification.requestPermission(); if (permission !== 'granted') throw new Error('PWA 설치를 계속하려면 알림 권한을 허용해 주세요.');
    const registration = await navigator.serviceWorker.ready, configResponse = await fetch('/app/api/pwa/config'); if (!configResponse.ok) throw new Error('로그인 후 앱을 설치해 주세요.');
    const config = await configResponse.json(), subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config.vapidPublicKey) });
    const response = await fetch('/app/api/pwa/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) }); if (!response.ok) throw new Error('푸시 알림을 연결하지 못했습니다.');
  }
  function modal(message, install, requirePush = true, mandatory = false) {
    if (document.querySelector('[data-pwa-install-modal]')) return;
    const overlay = document.createElement('div'); overlay.dataset.pwaInstallModal = '1'; overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,29,50,.72)';
    overlay.innerHTML = '<section style="width:min(430px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;background:#1c2d4a;color:#fff;text-align:center;font-size:1.05rem">앱 설치 및 알림 설정</h2><p data-message style="margin:0;padding:25px;color:#43516a;line-height:1.7;white-space:pre-line"></p><p data-error style="min-height:20px;margin:0;padding:0 25px;color:#b42318;font-size:.78rem"></p><div style="display:flex;justify-content:center;gap:9px;padding:16px 22px 22px"><button data-later type="button">나중에</button><button data-install type="button">알림 허용 후 설치</button></div></section>';
    overlay.querySelector('[data-message]').textContent = message; overlay.querySelectorAll('button').forEach(button => button.style.cssText = 'padding:10px 15px;border:1px solid #ccd7e4;border-radius:8px;background:#fff;font-weight:800'); overlay.querySelector('[data-install]').style.cssText += ';border-color:#2563eb;background:#2563eb;color:#fff';
    if (!requirePush) overlay.querySelector('[data-install]').textContent = '확인'; if (mandatory) overlay.querySelector('[data-later]').style.display = 'none';
    if (requirePush && Notification.permission === 'denied') { overlay.querySelector('[data-error]').textContent = '알림이 차단되어 있습니다. Edge 주소창 왼쪽 사이트 정보 → 이 사이트에 대한 권한 → 알림을 허용으로 변경해 주세요.'; overlay.querySelector('[data-install]').textContent = '권한 설정 후 다시 확인'; }
    overlay.querySelector('[data-later]').onclick = () => overlay.remove(); overlay.querySelector('[data-install]').onclick = async () => { const button = overlay.querySelector('[data-install]'); button.disabled = true; overlay.querySelector('[data-error]').textContent = ''; try { if (requirePush) await enablePush(); await install(); overlay.remove(); } catch (error) { overlay.querySelector('[data-error]').textContent = error.message; button.textContent = Notification.permission === 'denied' ? '권한 설정 후 다시 확인' : '알림 허용 후 설치'; button.disabled = false; } }; document.body.append(overlay);
  }
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(async () => {
    const authCheck = await fetch('/app/api/pwa/config'); if (!authCheck.ok) return;
    if (standalone) { if (Notification.permission !== 'granted') setTimeout(() => modal('설치된 앱에서 업무를 진행하려면 실시간 알림 권한이 필요합니다.', async () => { await fetch('/app/api/pwa/remember', { method: 'POST' }); }, true, true), 800); else { await enablePush().catch(() => {}); await fetch('/app/api/pwa/remember', { method: 'POST' }); } return; }
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredPrompt = event; setTimeout(() => modal('보고·결재 앱을 설치하면 새 보고와 호출 알림을 바로 받을 수 있습니다.\n설치에는 알림 권한 허용이 필요합니다.', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); const choice = await deferredPrompt.userChoice; deferredPrompt = null; if (choice.outcome === 'accepted') await fetch('/app/api/pwa/remember', { method: 'POST' }); }), 700); }, { once: true });
    if (isiOS) setTimeout(() => modal('iPhone/iPad에서는 Safari 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택해 주세요.\n설치된 앱을 다시 실행하면 알림 권한을 설정할 수 있습니다.', async () => {}, false), 900);
  }).catch(console.error);
})();
