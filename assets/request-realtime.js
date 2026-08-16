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

  async function markNotificationsRead(ids) {
    if (!ids.length) return;
    await fetch('/app/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
  }

  function confirmNotificationDeletion(){
    return new Promise(resolve=>{const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:380;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';overlay.innerHTML='<section role="alertdialog" aria-modal="true" style="width:min(430px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;text-align:center;background:#172033;color:#fff;font-size:1.05rem">알림 삭제</h2><p style="margin:0;padding:32px 24px;text-align:center;color:#172033;font-weight:800">선택된 알림을 삭제하시겠습니까?</p><div style="display:flex;justify-content:center;gap:10px;padding:14px 24px 20px;border-top:1px solid #edf1f5"><button data-cancel type="button" style="min-width:92px;padding:10px 16px;border:0;border-radius:8px;background:#000;color:#fff;font-weight:800;cursor:pointer">취소</button><button data-confirm type="button" style="min-width:92px;padding:10px 16px;border:0;border-radius:8px;background:#000;color:#fff;font-weight:800;cursor:pointer">확인</button></div></section>';const close=result=>{overlay.remove();resolve(result)};overlay.querySelector('[data-cancel]').onclick=()=>close(false);overlay.querySelector('[data-confirm]').onclick=()=>close(true);overlay.onclick=event=>{if(event.target===overlay)close(false)};document.body.append(overlay);overlay.querySelector('[data-confirm]').focus()});
  }

  function installNotificationSelection(container,onDeleted){
    if(!container||container.dataset.notificationSelectionReady)return;const rows=Array.from(container.querySelectorAll('[data-notification-id]'));if(!rows.length)return;container.dataset.notificationSelectionReady='1';
    const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:11px 13px;border:1px solid #dce4ed;border-radius:10px;background:#fff';toolbar.innerHTML='<label style="display:inline-flex;align-items:center;gap:8px;color:#43516a;font-size:.82rem;font-weight:800;cursor:pointer"><input data-select-all type="checkbox" style="width:18px;height:18px;accent-color:#172033"> 전체 선택</label><button data-delete-selected type="button" disabled style="min-width:82px;padding:9px 14px;border:0;border-radius:8px;background:#000;color:#fff;font-weight:800;cursor:pointer">삭제</button>';container.before(toolbar);
    rows.forEach(row=>{row.style.position='relative';row.style.paddingLeft='48px';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.notificationSelect='1';checkbox.value=row.dataset.notificationId;checkbox.setAttribute('aria-label','알림 선택');checkbox.style.cssText='position:absolute;left:17px;top:18px;width:18px;height:18px;accent-color:#172033;cursor:pointer';row.prepend(checkbox)});
    const all=toolbar.querySelector('[data-select-all]'),remove=toolbar.querySelector('[data-delete-selected]'),boxes=()=>Array.from(container.querySelectorAll('[data-notification-select]'));const sync=()=>{const selected=boxes().filter(box=>box.checked);remove.disabled=!selected.length;all.checked=Boolean(boxes().length&&selected.length===boxes().length);all.indeterminate=selected.length>0&&selected.length<boxes().length};all.onchange=()=>{boxes().forEach(box=>box.checked=all.checked);sync()};container.addEventListener('change',event=>{if(event.target.matches('[data-notification-select]'))sync()});remove.onclick=async()=>{const ids=boxes().filter(box=>box.checked).map(box=>Number(box.value));if(!ids.length||!await confirmNotificationDeletion())return;remove.disabled=true;const response=await fetch('/app/api/notifications/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})}),result=await response.json();if(!response.ok){remove.disabled=false;alert(result.message||'알림을 삭제하지 못했습니다.');return}ids.forEach(id=>container.querySelector('[data-notification-id="'+id+'"]')?.remove());if(onDeleted)onDeleted(ids);if(!container.querySelector('[data-notification-id]'))container.innerHTML='<p style="padding:28px;text-align:center;color:#98a2b3">알림이 없습니다.</p>';sync()};sync();
  }

  function installRequesterQueueLayout(){
    if(typeof role==='undefined'||role!=='requester')return;const view=document.getElementById('requestView'),list=view?.querySelector('.list'),detail=document.getElementById('detailPanel');if(!view||!list||!detail||view.querySelector('.requester-request-grid'))return;
    const style=document.createElement('style');style.textContent='.requester-request-grid{height:calc(100vh - 245px);min-height:360px;display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;overflow:hidden}.requester-request-grid .list{min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff}.requester-request-grid .list-head{flex:0 0 auto;background:#fff}.requester-request-grid #requestList{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}.requester-request-grid #detailPanel{width:auto;min-height:0;padding:0 18px 18px;display:block;overflow-x:hidden;overflow-y:auto;border:1px solid #e1e7ef;border-radius:12px;background:#fff}.requester-request-grid #detailPanel>h2{position:sticky;top:0;z-index:2;margin:0 -18px 14px;padding:14px 18px;border-bottom:1px solid #edf1f5;background:#fff;text-align:center}.requester-request-grid #detailPanel .detail-empty{min-height:100%}@media(max-width:1000px){.requester-request-grid{height:auto;min-height:0;grid-template-columns:1fr}.requester-request-grid .list,.requester-request-grid #detailPanel{height:460px}}';document.head.append(style);
    const grid=document.createElement('section');grid.className='requester-request-grid';list.before(grid);grid.append(list,detail);
  }

  function installRequesterSubmitValidation(){
    if(typeof role==='undefined'||role!=='requester')return;const form=document.getElementById('newRequestForm'),submit=form?.querySelector('[data-status="submitted"]');if(!form||!submit||form.dataset.submitValidationReady)return;form.dataset.submitValidationReady='1';const duration=form.elements.duration,desiredDate=form.elements.desiredDate;if(duration){duration.required=false;duration.closest('.request-field')?.querySelector('.req')?.remove();if(!Array.from(duration.options).some(option=>option.value===''))duration.insertAdjacentHTML('afterbegin','<option value="">선택 안 함</option>')}if(desiredDate){desiredDate.required=true;const label=desiredDate.closest('.request-field')?.querySelector('label');if(label&&!label.querySelector('.req'))label.insertAdjacentHTML('beforeend',' <span class="req">*</span>')}const update=()=>{submit.disabled=!form.checkValidity()};form.addEventListener('input',update);form.addEventListener('change',update);document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="new"]'))setTimeout(update,0)},true);const modal=document.getElementById('requestModal');if(modal)new MutationObserver(update).observe(modal,{attributes:true,attributeFilter:['class']});update();
  }

  function renameRequesterCallStatus(){
    if(typeof role==='undefined'||role!=='requester')return;const stats=document.getElementById('requestStats');if(!stats)return;const label=Array.from(stats.querySelectorAll('.stat b')).find(item=>item.textContent.trim()==='호출예정');if(!label||label.classList.contains('requester-call-label'))return;label.classList.add('requester-call-label');const style=document.createElement('style');style.textContent='.requester-call-label{font-size:0!important}.requester-call-label::after{content:"호출";font-size:.77rem!important}';document.head.append(style);
  }

  function installRequesterMobileMenu(){
    if(typeof role==='undefined'||role!=='requester'||document.querySelector('[data-requester-mobile-menu]'))return;
    const header=document.querySelector('.head'),nav=document.querySelector('.side .nav'),identity=header?.querySelector('.identity');if(!header||!nav||!identity)return;
    const style=document.createElement('style');style.textContent=`
      [data-requester-menu-toggle],[data-requester-mobile-menu]{display:none}
      @media(max-width:900px),(hover:none) and (pointer:coarse){
        .head{height:58px!important;padding:0 12px!important;gap:8px!important}.head .brand{min-width:0;font-size:.86rem;line-height:1.25}.head .brand span:last-child{display:block;max-width:150px}.head>.identity,.head>#userSettingsButton,.head>[data-header-notifications],.head>form{display:none!important}
        [data-requester-menu-toggle]{margin-left:auto!important;width:40px!important;height:40px!important;display:grid!important;place-items:center!important;padding:0!important;border:1px solid rgba(255,255,255,.45)!important;border-radius:9px!important;background:#2563eb!important;color:#fff!important;font-size:1.35rem!important;cursor:pointer!important}
        [data-requester-mobile-menu]{position:fixed;inset:0;z-index:520;display:block;visibility:hidden;background:rgba(15,29,50,.55);opacity:0;transition:opacity .2s,visibility .2s}
        [data-requester-mobile-menu].open{visibility:visible;opacity:1}[data-requester-menu-panel]{position:absolute;top:0;right:0;width:min(310px,86vw);height:100%;display:flex;flex-direction:column;padding:18px;background:#fff;color:#172033;box-shadow:-14px 0 40px rgba(15,29,50,.2);transform:translateX(100%);transition:transform .22s}[data-requester-mobile-menu].open [data-requester-menu-panel]{transform:translateX(0)}
        [data-requester-menu-nav]{display:grid;gap:7px;margin-top:18px}[data-requester-menu-nav] button,[data-requester-menu-actions] button{width:100%!important;min-height:44px!important;padding:11px 13px!important;border:0!important;border-radius:9px!important;background:#eff6ff!important;color:#1d4ed8!important;text-align:left!important;font-weight:800!important}
        [data-requester-menu-actions]{display:grid;gap:7px;margin-top:auto;padding-top:16px;border-top:1px solid #e1e7ef}[data-requester-menu-actions] button[data-mobile-logout]{background:#1c2d4a!important;color:#fff!important}
        .main{padding:14px!important}.stats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.stat{min-width:0!important;padding:14px!important}.requester-request-grid{height:calc(100vh - 250px)!important;display:block!important}.requester-request-grid .list{height:100%!important}.requester-request-grid #detailPanel{display:none!important}.request-list-tools{gap:6px!important}.list-head{align-items:flex-start!important;gap:8px!important}.request-list-tools{flex-wrap:wrap!important;justify-content:flex-end!important}.request{padding-right:12px!important}.request-pager,.page-size-control{display:none!important}#requestList{padding-bottom:0!important}
      }`;
    document.head.append(style);
    const toggle=document.createElement('button');toggle.type='button';toggle.dataset.requesterMenuToggle='1';toggle.setAttribute('aria-label','메뉴 열기');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';header.append(toggle);
    const menu=document.createElement('div');menu.dataset.requesterMobileMenu='1';menu.innerHTML='<aside data-requester-menu-panel><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div data-requester-menu-user></div><button data-requester-menu-close type="button" aria-label="메뉴 닫기" style="width:38px;height:38px;border:0;border-radius:8px;background:#eef2f7;font-size:1.2rem">✕</button></div><nav data-requester-menu-nav></nav><div data-requester-menu-actions></div></aside>';document.body.append(menu);
    const open=()=>{menu.classList.add('open');toggle.setAttribute('aria-expanded','true')},close=()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false')};toggle.onclick=open;menu.querySelector('[data-requester-menu-close]').onclick=close;menu.onclick=event=>{if(event.target===menu)close()};
    function sync(){menu.querySelector('[data-requester-menu-user]').innerHTML=`<b style="display:block;font-size:.95rem">${identity.querySelector('b')?.textContent||''}</b><small style="display:block;margin-top:4px;color:#718096">${identity.querySelector('small')?.textContent||''}</small>`;const mobileNav=menu.querySelector('[data-requester-menu-nav]');mobileNav.innerHTML='';nav.querySelectorAll('button').forEach(original=>{const button=document.createElement('button');button.type='button';button.textContent=original.textContent;button.onclick=()=>{original.click();close()};mobileNav.append(button)});const actions=menu.querySelector('[data-requester-menu-actions]');actions.innerHTML='';const notification=document.createElement('button');notification.type='button';notification.textContent='🔔 알림 확인'+(document.querySelector('[data-header-notification-badge]')?` (${document.querySelector('[data-header-notification-badge]').textContent})`:'');notification.onclick=()=>{document.querySelector('[data-header-notifications]')?.click();close()};const settings=document.createElement('button');settings.type='button';settings.textContent='⚙ 설정';settings.onclick=()=>{document.getElementById('userSettingsButton')?.click();close()};const logout=document.createElement('button');logout.type='button';logout.dataset.mobileLogout='1';logout.textContent='로그아웃';logout.onclick=()=>header.querySelector('form')?.requestSubmit();actions.append(notification,settings,logout)}
    function setMobileRequestMode(mode){const requestView=document.getElementById('requestView'),head=requestView?.querySelector('.main-head'),stats=document.getElementById('requestStats'),grid=requestView?.querySelector('.requester-request-grid');if(!requestView||!stats||!grid)return;requestView.style.setProperty('display','block','important');if(head)head.style.setProperty('display',mode==='summary'?'flex':'none','important');stats.style.setProperty('display',mode==='summary'?'grid':'none','important');grid.style.setProperty('display',mode==='list'?'block':'none','important')}
    function showMobileRequestDetail(item){if(!item)return;const statusNames={draft:'임시저장',submitted:'요청접수',manager_review:'검토 중',revision_requested:'보완요청',secretary_review:'비서실검토',reservation_confirmed:'예약확정',waiting:'호출',called:'호출',completed:'완료',held:'보류',rejected:'반려',cancelled:'취소'},rows=[['요청번호',item.requestCode||`REQ-${String(item.id).padStart(6,'0')}`],['상태',statusNames[item.status]||item.status],['긴급도',item.urgency||'-'],['요청 구분',item.requestType||'-'],['보고 대상',item.reportTarget||'-'],['안건 제목',item.title||'-'],['요청 내용',item.summary||'-'],['의사결정 기한',item.desiredDate||'-'],['배석자',item.attendees||'-'],['등록일시',item.createdAt||'-']];const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:540;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(15,29,50,.68)';const box=document.createElement('section');box.style.cssText='width:100%;max-width:520px;max-height:calc(100vh - 28px);display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)';box.innerHTML='<header style="flex:none;display:flex;align-items:center;justify-content:center;padding:16px;background:#2563eb;color:#fff"><h2 style="margin:0;font-size:1rem">요청 안건 상세</h2></header><div data-mobile-detail-body style="min-height:0;overflow-y:auto;padding:5px 18px"></div><footer style="flex:none;padding:12px 18px 16px;border-top:1px solid #edf1f5;text-align:center"><button type="button" style="min-width:100px;padding:10px 18px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:800">확인</button></footer>';const body=box.querySelector('[data-mobile-detail-body]');rows.forEach(([name,value])=>{const field=document.createElement('div');field.style.cssText='padding:11px 0;border-bottom:1px solid #edf1f5';const label=document.createElement('b');label.style.cssText='display:block;margin-bottom:5px;color:#718096;font-size:.72rem';label.textContent=name;const text=document.createElement('span');text.style.cssText='display:block;color:#172033;font-size:.84rem;line-height:1.55;white-space:pre-wrap;word-break:break-word';text.textContent=String(value);field.append(label,text);body.append(field)});const close=()=>overlay.remove();box.querySelector('button').onclick=close;overlay.onclick=event=>{if(event.target===overlay)close()};overlay.append(box);document.body.append(overlay)}
    function splitMobileRequestMenu(){const mobileNav=menu.querySelector('[data-requester-menu-nav]');if(!mobileNav||mobileNav.querySelector('[data-mobile-request-list]'))return;const summary=Array.from(mobileNav.querySelectorAll('button')).find(button=>button.textContent.includes('내 요청 현황'));if(!summary)return;const original=document.querySelector('.side .nav [data-view="requests"]');summary.dataset.mobileRequestSummary='1';summary.textContent='📊 내 요청 현황';summary.onclick=()=>{original?.click();setMobileRequestMode('summary');close()};const list=document.createElement('button');list.type='button';list.dataset.mobileRequestList='1';list.textContent='📋 전체 요청 현황';list.onclick=()=>{original?.click();setMobileRequestMode('list');close()};summary.after(list)}
    const mobileQuery='(max-width:900px), (hover:none) and (pointer:coarse)';
    const enforceMobilePageSize=()=>{if(!matchMedia(mobileQuery).matches)return;const select=document.querySelector('.page-size-control select');if(select&&select.value!=='5'){select.value='5';select.dispatchEvent(new Event('change'))}};
    const handleViewport=()=>{if(matchMedia(mobileQuery).matches){enforceMobilePageSize();return}const requestView=document.getElementById('requestView'),head=requestView?.querySelector('.main-head'),stats=document.getElementById('requestStats'),grid=requestView?.querySelector('.requester-request-grid');[requestView,head,stats,grid].forEach(element=>{element?.style.removeProperty('display')})};
    document.getElementById('requestList')?.addEventListener('click',event=>{if(!matchMedia(mobileQuery).matches||event.target.closest('input[type="checkbox"]'))return;const row=event.target.closest('.request[data-id]');if(!row||typeof requests==='undefined')return;showMobileRequestDetail(requests.find(item=>String(item.id)===row.dataset.id))});
    const observer=new MutationObserver(()=>{sync();splitMobileRequestMenu()});observer.observe(header,{childList:true,subtree:true});observer.observe(nav,{childList:true,subtree:true});sync();splitMobileRequestMenu();if(matchMedia(mobileQuery).matches)setMobileRequestMode('summary');enforceMobilePageSize();setTimeout(enforceMobilePageSize,100);window.addEventListener('resize',handleViewport);document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  }

  function installManagerMobileMenu(){
    if(typeof role==='undefined'||!['manager','director'].includes(role)||document.querySelector('[data-manager-mobile-menu]'))return;
    const header=document.querySelector('.topbar'),actions=header?.querySelector('.top-actions'),nav=document.getElementById('nav');if(!header||!actions||!nav)return;
    const style=document.createElement('style');style.textContent=`
      [data-manager-menu-toggle],[data-manager-mobile-menu]{display:none}
      @media(max-width:900px),(hover:none) and (pointer:coarse){
        .layout{display:block!important}.sidebar{display:none!important}.topbar{height:58px!important;padding:0 12px!important}.topbar>.top-actions{display:none!important}.topbar h1{font-size:1rem!important}
        [data-manager-menu-toggle]{margin-left:auto;width:40px;height:40px;display:grid!important;place-items:center;padding:0;border:1px solid #d8d2ed;border-radius:9px;background:#6650a4;color:#fff;font-size:1.35rem;cursor:pointer}
        [data-manager-mobile-menu]{position:fixed;inset:0;z-index:520;display:block;visibility:hidden;background:rgba(15,29,50,.58);opacity:0;transition:opacity .2s,visibility .2s}[data-manager-mobile-menu].open{visibility:visible;opacity:1}
        [data-manager-menu-panel]{position:absolute;top:0;right:0;width:min(310px,86vw);height:100%;display:flex;flex-direction:column;padding:18px;background:#fff;color:#172033;box-shadow:-14px 0 40px rgba(15,29,50,.22);transform:translateX(100%);transition:transform .22s}[data-manager-mobile-menu].open [data-manager-menu-panel]{transform:translateX(0)}
        [data-manager-menu-nav]{display:grid;gap:7px;margin-top:18px}[data-manager-menu-nav] button,[data-manager-menu-actions] button{width:100%!important;min-height:44px!important;padding:11px 13px!important;border:0!important;border-radius:9px!important;background:#f2effa!important;color:#57418f!important;text-align:left!important;font-weight:800!important}[data-manager-menu-actions]{display:grid;gap:7px;margin-top:auto;padding-top:16px;border-top:1px solid #e1e7ef}[data-manager-menu-actions] [data-mobile-logout]{background:#2f2548!important;color:#fff!important}
        .content{height:auto!important;max-height:none!important;padding:14px!important;overflow:visible!important}.main{overflow-y:auto!important}.manager-page-fixed{height:auto!important;max-height:none!important}.manager-request-grid{height:calc(100vh - 88px)!important;max-height:none!important;display:block!important;overflow:hidden!important}.manager-request-grid>.manager-scroll-block{height:100%!important;margin-bottom:0!important}.manager-request-grid>#managerDetail{display:none!important}.manager-definitive-pager{display:flex!important}#managerStats{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}#managerStats>div{min-width:0!important;padding:14px!important}
        #managerSearchConditions{align-items:center!important;gap:6px!important;padding:10px!important}#managerSearchConditions [data-requester]{width:112px!important}#managerSearchConditions [data-urgencies]{flex-wrap:wrap!important}#managerSearchConditions .manager-page-size{display:inline-flex!important;margin-left:auto!important}#managerSearchConditions [data-result]{display:inline!important;white-space:nowrap!important}#managerList [data-manager-id]{padding-right:12px!important}
        body[data-manager-mobile-view="summary"] .manager-request-grid{display:none!important}
        body[data-manager-mobile-view="list"] #managerStats,body[data-manager-mobile-view="list"] .content>h2,body[data-manager-mobile-view="list"] .content>p{display:none!important}
        [data-manager-status-cards]{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}[data-manager-status-list]{border-radius:10px!important}[data-manager-status-id]{min-height:72px!important}[data-manager-status-detail]{width:100%!important;border-radius:10px!important}
        [data-manager-detail-overlay]{position:fixed!important;inset:0!important;z-index:540!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:14px!important;background:rgba(15,29,50,.68)!important}[data-manager-detail-overlay] #managerDetail{position:relative!important;width:100%!important;max-width:520px!important;height:min(720px,calc(100vh - 28px))!important;display:flex!important;border:0!important;border-radius:14px!important;box-shadow:0 24px 70px rgba(0,0,0,.3)!important}[data-manager-detail-overlay] #managerDetail>.manager-scroll-head{background:#6650a4!important;color:#fff!important}[data-manager-detail-overlay] #managerDetail>.manager-scroll-body{padding-bottom:72px!important}
        [data-manager-request-modal]{z-index:2000!important}body:has([data-manager-request-modal]) .manager-definitive-pager,body:has([data-manager-request-modal]) .manager-page-pager{clip-path:inset(100%)!important;pointer-events:none!important}body:has([data-manager-request-modal])>div[style*="z-index: 560"]{z-index:2100!important}
      }`;
    document.head.append(style);
    const toggle=document.createElement('button');toggle.type='button';toggle.dataset.managerMenuToggle='1';toggle.setAttribute('aria-label','메뉴 열기');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰';header.append(toggle);
    const menu=document.createElement('div');menu.dataset.managerMobileMenu='1';menu.innerHTML='<aside data-manager-menu-panel><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div data-manager-menu-user></div><button data-manager-menu-close type="button" aria-label="메뉴 닫기" style="width:38px;height:38px;border:0;border-radius:8px;background:#f2effa;color:#57418f;font-size:1.2rem">✕</button></div><nav data-manager-menu-nav></nav><div data-manager-menu-actions></div></aside>';document.body.append(menu);
    const open=()=>{menu.classList.add('open');toggle.setAttribute('aria-expanded','true')},close=()=>{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false')};toggle.onclick=open;menu.querySelector('[data-manager-menu-close]').onclick=close;menu.onclick=event=>{if(event.target===menu)close()};
    const mobileQuery='(max-width:900px), (hover:none) and (pointer:coarse)';
    function setManagerMobileView(view){if(!matchMedia(mobileQuery).matches)return;document.body.dataset.managerMobileView=view;const grid=document.querySelector('.manager-request-grid'),stats=document.getElementById('managerStats');if(view==='summary'){stats?.scrollIntoView({block:'start'})}else{grid?.scrollIntoView({block:'start'})}}
    function showManagerMobileDetail(){if(!matchMedia(mobileQuery).matches||document.querySelector('[data-manager-detail-overlay]'))return;const detail=document.getElementById('managerDetail'),grid=document.querySelector('.manager-request-grid');if(!detail||!grid)return;const overlay=document.createElement('div');overlay.dataset.managerDetailOverlay='1';const close=()=>{detail.querySelector('[data-manager-mobile-detail-close]')?.remove();grid.append(detail);detail.style.removeProperty('display');overlay.remove()};overlay.onclick=event=>{if(event.target===overlay)close()};overlay.append(detail);document.body.append(overlay);detail.style.setProperty('display','flex','important');const footer=document.createElement('div');footer.dataset.managerMobileDetailClose='1';footer.style.cssText='position:absolute;top:8px;right:10px;z-index:30';const closeButton=document.createElement('button');closeButton.type='button';closeButton.setAttribute('aria-label','상세 닫기');closeButton.textContent='✕';closeButton.style.cssText='width:34px;height:34px;border:1px solid rgba(255,255,255,.5);border-radius:8px;background:transparent;color:#fff;font-size:1rem;cursor:pointer';closeButton.onclick=close;footer.append(closeButton);detail.append(footer);setTimeout(()=>{const actions=detail.querySelector('[data-manager-actions]');if(actions){actions.style.setProperty('position','absolute','important');actions.style.setProperty('right','0','important');actions.style.setProperty('bottom','0','important');actions.style.setProperty('left','0','important');actions.style.setProperty('width','100%','important');actions.style.setProperty('border-radius','0','important');actions.style.setProperty('box-shadow','none','important')}},250)}
    function managerMobileConfirm(action,item){return new Promise(resolve=>{const confirmOverlay=document.createElement('div');confirmOverlay.style.cssText='position:fixed;inset:0;z-index:560;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,29,50,.7)';confirmOverlay.innerHTML='<section style="width:min(410px,100%);overflow:hidden;border-radius:14px;background:#fff"><h3 style="margin:0;padding:16px;background:#6650a4;color:#fff;text-align:center;font-size:1rem">'+(action==='approve'?'비서실 이관':'요청 반려')+'</h3><div style="padding:20px"><p style="margin:0 0 14px;text-align:center;line-height:1.55">'+(action==='approve'?'선택한 안건을 비서실로 이관하시겠습니까?':'선택한 안건을 반려하시겠습니까?')+'</p>'+(action==='reject'?'<textarea data-manager-mobile-reason maxlength="1000" placeholder="반려 사유를 입력해 주세요." style="box-sizing:border-box;width:100%;min-height:100px;padding:10px;border:1px solid #ccd7e4;border-radius:8px;resize:vertical"></textarea>':'')+'<p data-manager-mobile-error style="min-height:18px;margin:6px 0;color:#b42318;font-size:.76rem"></p><div style="display:flex;justify-content:center;gap:8px"><button data-cancel type="button">취소</button><button data-ok type="button">확인</button></div></div></section>';confirmOverlay.querySelectorAll('button').forEach(button=>button.style.cssText='min-width:88px;padding:10px 16px;border:1px solid #c9c0df;border-radius:8px;background:#fff;color:#6650a4;font-weight:800');confirmOverlay.querySelector('[data-ok]').style.cssText+=';border-color:#6650a4;background:#6650a4;color:#fff';const close=value=>{confirmOverlay.remove();resolve(value)};confirmOverlay.querySelector('[data-cancel]').onclick=()=>close(null);confirmOverlay.querySelector('[data-ok]').onclick=()=>{const reason=confirmOverlay.querySelector('[data-manager-mobile-reason]')?.value.trim()||'';if(action==='reject'&&!reason){confirmOverlay.querySelector('[data-manager-mobile-error]').textContent='반려 사유를 입력해 주세요.';return}close(reason)};confirmOverlay.onclick=event=>{if(event.target===confirmOverlay)close(null)};document.body.append(confirmOverlay)})}
    async function openManagerRequestModal(requestId){if(document.querySelector('[data-manager-request-modal]'))return;let item,status;try{const listResponse=await fetch('/app/api/manager/requests',{cache:'no-store'}),listResult=await listResponse.json();if(!listResponse.ok)throw new Error(listResult.message||'요청을 불러오지 못했습니다.');item=(listResult.requests||[]).find(value=>String(value.id)===String(requestId));if(!item)throw new Error('요청을 찾을 수 없습니다.');const reviewResponse=await fetch('/app/api/manager/requests/'+requestId+'/review',{method:'POST'}),reviewResult=await reviewResponse.json();if(!reviewResponse.ok)throw new Error(reviewResult.message||'요청을 확인하지 못했습니다.');status=reviewResult.status;item.statusLabel=reviewResult.statusLabel||item.statusLabel}catch(error){alert(error.message);return}const overlay=document.createElement('div');overlay.dataset.managerRequestModal='1';overlay.style.cssText='position:fixed;inset:0;z-index:540;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(15,29,50,.68)';overlay.innerHTML='<section style="width:100%;max-width:520px;max-height:calc(100vh - 28px);display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><header style="flex:none;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#6650a4;color:#fff"><h2 style="margin:0;font-size:1rem">요청 상세</h2><button data-close type="button" aria-label="팝업 닫기" style="width:36px;height:36px;border:1px solid rgba(255,255,255,.5);border-radius:8px;background:transparent;color:#fff;font-size:1.05rem">✕</button></header><div data-body style="min-height:0;overflow-y:auto;padding:4px 18px"></div><footer data-actions style="flex:none;display:flex;justify-content:center;gap:8px;padding:12px 18px 16px;border-top:1px solid #edf1f5;background:#fff"></footer></section>';const fields=[['요청번호',item.requestCode],['상태',item.statusLabel],['요청자',item.requesterName],['소속',[item.department,item.team].filter(Boolean).join(' / ')||'-'],['긴급도',item.urgency],['보고 대상',item.reportTarget],['안건명',item.title],['안건 요약',item.summary],['의사결정 기한',item.desiredDate||'-']],body=overlay.querySelector('[data-body]');fields.forEach(([label,value])=>{const field=document.createElement('div');field.style.cssText='padding:11px 0;border-bottom:1px solid #edf1f5;text-align:left';const name=document.createElement('b');name.style.cssText='display:block;margin-bottom:5px;color:#718096;font-size:.72rem';name.textContent=label;const text=document.createElement('span');text.style.cssText='display:block;color:#172033;font-size:.84rem;line-height:1.55;white-space:pre-wrap;word-break:break-word';text.textContent=value==null||value===''?'-':String(value);field.append(name,text);body.append(field)});const close=()=>overlay.remove();overlay.querySelector('[data-close]').onclick=close;overlay.onclick=event=>{if(event.target===overlay)close()};const actions=overlay.querySelector('[data-actions]');if(status==='manager_review'){actions.innerHTML='<button data-approve type="button">비서실 이관</button><button data-reject type="button">반려</button>';actions.querySelectorAll('button').forEach(button=>button.style.cssText='min-width:105px;padding:10px 15px;border:1px solid #c9c0df;border-radius:8px;background:#fff;color:#6650a4;font-weight:800');actions.querySelector('[data-approve]').style.cssText+=';border-color:#6650a4;background:#6650a4;color:#fff';const decide=async action=>{const reason=await managerMobileConfirm(action,item);if(reason===null)return;const response=await fetch('/app/api/manager/requests/'+requestId+'/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reason})}),result=await response.json();if(!response.ok){alert(result.message||'처리하지 못했습니다.');return}sessionStorage.setItem('managerMobileView','list');location.reload()};actions.querySelector('[data-approve]').onclick=()=>decide('approve');actions.querySelector('[data-reject]').onclick=()=>decide('reject')}else actions.innerHTML='<button data-only-close type="button" style="min-width:105px;padding:10px 15px;border:0;border-radius:8px;background:#6650a4;color:#fff;font-weight:800">닫기</button>',actions.querySelector('[data-only-close]').onclick=close;document.body.append(overlay)}
    function openManagerMobileView(view){sessionStorage.setItem('managerMobileView',view);if(document.getElementById('managerStats')&&document.querySelector('.manager-request-grid')){setManagerMobileView(view);sessionStorage.removeItem('managerMobileView')}else location.reload();close()}
    function sync(){Array.from(nav.querySelectorAll('button')).find(button=>button.textContent.trim().replace(/^📊\s*/, '')==='부서 현황')?.remove();const pageTitle=document.querySelector('.content>h2');if(pageTitle?.textContent.trim()==='부서 요청 목록')pageTitle.textContent='부서 요청 현황';const primaryNav=Array.from(nav.querySelectorAll('button')).find(button=>button.textContent.includes('부서 요청 목록'));if(primaryNav)primaryNav.innerHTML=primaryNav.innerHTML.replace('부서 요청 목록','부서 요청 현황');const roleLabel=document.getElementById('roleLabel')?.textContent||'부서장 / 국장',roleDept=document.getElementById('roleDept')?.textContent||'';menu.querySelector('[data-manager-menu-user]').innerHTML=`<b style="display:block;font-size:.95rem">${roleLabel}</b><small style="display:block;margin-top:4px;color:#718096">${roleDept}</small>`;const mobileNav=menu.querySelector('[data-manager-menu-nav]');mobileNav.innerHTML='';nav.querySelectorAll('button').forEach(original=>{if(role==='manager'&&original.textContent.includes('부서 요청 현황')){const summary=document.createElement('button');summary.type='button';summary.dataset.managerMobileSummary='1';summary.textContent='📊 부서 요청 현황';summary.onclick=()=>openManagerMobileView('summary');const list=document.createElement('button');list.type='button';list.dataset.managerMobileRequestList='1';list.textContent='📋 부서 요청 목록';list.onclick=()=>openManagerMobileView('list');mobileNav.append(summary,list);return}const button=document.createElement('button');button.type='button';button.textContent=original.textContent;button.onclick=()=>{delete document.body.dataset.managerMobileView;original.click();close()};mobileNav.append(button)});const mobileActions=menu.querySelector('[data-manager-menu-actions]');mobileActions.innerHTML='';const notification=document.createElement('button');notification.type='button';notification.textContent='🔔 알림 확인'+(document.querySelector('[data-header-notification-badge]')?` (${document.querySelector('[data-header-notification-badge]').textContent})`:'');notification.onclick=()=>{delete document.body.dataset.managerMobileView;document.querySelector('[data-header-notifications]')?.click();close()};const settings=document.createElement('button');settings.type='button';settings.textContent='⚙ 설정';settings.onclick=()=>{document.getElementById('userSettingsButton')?.click();close()};const logout=document.createElement('button');logout.type='button';logout.dataset.mobileLogout='1';logout.textContent='로그아웃';logout.onclick=()=>actions.querySelector('form')?.requestSubmit();mobileActions.append(notification,settings,logout)}
    document.addEventListener('click',event=>{if(!matchMedia(mobileQuery).matches||event.target.closest('input,select,label'))return;const row=event.target.closest('#managerList [data-manager-id]');if(!row)return;event.preventDefault();event.stopImmediatePropagation();openManagerRequestModal(row.dataset.managerId)},true);
    const enforceManagerMobilePageSize=()=>{if(!matchMedia(mobileQuery).matches)return;const select=document.querySelector('#managerSearchConditions .manager-page-size select');if(select&&select.value!=='5'){select.value='5';select.dispatchEvent(new Event('change'))}};
    const restorePendingView=()=>{const pending=sessionStorage.getItem('managerMobileView');if(matchMedia(mobileQuery).matches&&pending&&document.getElementById('managerStats')){setManagerMobileView(pending);sessionStorage.removeItem('managerMobileView')}};const observer=new MutationObserver(()=>{sync();enforceManagerMobilePageSize();restorePendingView()});observer.observe(nav,{childList:true,subtree:true});observer.observe(actions,{childList:true,subtree:true});sync();if(matchMedia(mobileQuery).matches){const initialView=sessionStorage.getItem('managerMobileView')||'summary';setManagerMobileView(initialView);if(document.getElementById('managerStats'))sessionStorage.removeItem('managerMobileView');setTimeout(restorePendingView,250)}enforceManagerMobilePageSize();setTimeout(enforceManagerMobilePageSize,150);window.addEventListener('resize',()=>{if(matchMedia(mobileQuery).matches){if(!document.body.dataset.managerMobileView)setManagerMobileView('summary');enforceManagerMobilePageSize()}else delete document.body.dataset.managerMobileView});document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('[data-manager-detail-overlay] [data-manager-mobile-detail-close] button')?.click();close()}});
  }

  function showQueuePopup(notifications) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
    overlay.innerHTML = '<section role="dialog" aria-modal="true" style="width:min(440px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;text-align:center;background:#176b87;color:#fff;font-size:1.05rem">대기 순서 조정 알림</h2><div data-notice-body style="max-height:55vh;overflow-y:auto;padding:22px"></div><div style="padding:0 22px 22px;text-align:center"><button type="button" style="min-width:110px;padding:10px 18px;border:0;border-radius:8px;background:#176b87;color:#fff;font-weight:800;cursor:pointer">확인</button></div></section>';
    overlay.querySelector('[data-notice-body]').innerHTML = notifications.map(item => `<article style="padding:13px 0;border-bottom:1px solid #edf1f5"><b>${item.title}</b><p style="margin:7px 0 0;color:#56657a;white-space:pre-line">${item.message || ''}</p></article>`).join('');
    overlay.querySelector('button').onclick = async () => {
      await markNotificationsRead(notifications.map(item => item.id));
      notifications.forEach(item => { item.readAt = new Date().toISOString(); });
      const badge = document.querySelector('[data-manager-notifications] b');
      if (badge) {
        const remaining = Math.max(0, Number(badge.textContent || 0) - notifications.length);
        if (remaining) badge.textContent = String(remaining); else badge.remove();
      }
      const headerBadge = document.querySelector('[data-header-notification-badge]');
      if (headerBadge) {
        const remaining = Math.max(0, Number(headerBadge.textContent || 0) - notifications.length);
        if (remaining) headerBadge.textContent = String(remaining); else headerBadge.remove();
      }
      overlay.remove();
    };
    document.body.append(overlay);
  }

  function installManagerNotifications(notifications) {
    const install = () => {
      const nav = document.getElementById('nav');
      if (!nav) return;
      const managerButtons = Array.from(nav.querySelectorAll('button'));
      const requestListButton = managerButtons.find(item => item.textContent.includes('부서 요청 목록') || item.textContent.includes('부서 요청 현황'));
      const statusButton = managerButtons.find(item => item.textContent.includes('부서 현황'));
      if (requestListButton && !requestListButton.dataset.managerMenuBound) {
        requestListButton.dataset.managerMenuBound = '1';
        requestListButton.onclick = () => location.reload();
      }
      if (statusButton && !statusButton.dataset.managerMenuBound) {
        statusButton.dataset.managerMenuBound = '1';
        statusButton.onclick = async () => {
          nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === statusButton));
          const content = document.querySelector('.content'); if (!content) return;
          content.innerHTML = '<p style="padding:30px;text-align:center;color:#718096">부서 현황을 불러오는 중입니다.</p>';
          try {
            const response = await fetch('/app/api/manager/requests', { cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || '부서 현황을 불러오지 못했습니다.');
            const requests = result.requests || [];
            const groups = [['검토 대기', 'submitted'], ['검토 중', 'manager_review'], ['비서실 이관', 'secretary_review'], ['예약·호출', ['reservation_confirmed', 'waiting', 'called']], ['완료', 'completed']];
            content.innerHTML = `<h2 style="margin:0 0 6px;font-size:1.25rem">부서 현황</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">소속 부서의 보고 요청 진행 상태입니다.</p><div data-manager-status-cards style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px">${groups.map(([label, statuses]) => { const values = Array.isArray(statuses) ? statuses : [statuses]; return `<article style="padding:17px;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><b style="display:block;color:#6650a4;font-size:.76rem">${label}</b><strong style="display:block;margin-top:8px;font-size:1.55rem">${requests.filter(item => values.includes(item.status)).length}</strong></article>`; }).join('')}</div><section data-manager-status-list style="overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><h3 style="margin:0;padding:14px;border-bottom:1px solid #edf1f5;font-size:.88rem">전체 요청 · ${requests.length}건</h3>${requests.length ? requests.map(item => `<button type="button" data-manager-status-id="${item.id}" style="display:block;width:100%;padding:14px 16px;border:0;border-bottom:1px solid #edf1f5;background:#fff;text-align:left;cursor:pointer"><b>${item.title || '-'}</b><p style="margin:5px 0 0;color:#718096;font-size:.76rem">${item.requestCode} · ${item.statusLabel} · ${item.requesterName}</p></button>`).join('') : '<p style="padding:28px;text-align:center;color:#98a2b3">등록된 요청이 없습니다.</p>'}</section>`;
            content.querySelectorAll('[data-manager-status-id]').forEach(row => row.onclick = () => {
              const item = requests.find(value => String(value.id) === row.dataset.managerStatusId); if (!item) return;
              const fields = [['요청번호', item.requestCode], ['상태', item.statusLabel], ['요청자', item.requesterName], ['소속', [item.department, item.team].filter(Boolean).join(' / ') || '-'], ['긴급도', item.urgency], ['보고 대상', item.reportTarget], ['안건명', item.title], ['안건 요약', item.summary], ['의사결정 기한', item.desiredDate || '-']];
              content.innerHTML = '<section data-manager-status-detail style="max-width:760px;margin:0 auto;overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;gap:10px;padding:13px 15px;background:#6650a4;color:#fff"><button data-manager-status-back type="button" style="width:36px;height:36px;border:1px solid rgba(255,255,255,.45);border-radius:8px;background:transparent;color:#fff;font-size:1.1rem;cursor:pointer">‹</button><h2 style="margin:0;font-size:1rem">요청 상세</h2></header><div data-manager-status-detail-body style="padding:4px 18px 18px"></div></section>';
              const detailBody = content.querySelector('[data-manager-status-detail-body]'); fields.forEach(([label, value]) => { const field = document.createElement('div'); field.style.cssText = 'padding:12px 0;border-bottom:1px solid #edf1f5;text-align:left'; const name = document.createElement('b'); name.style.cssText = 'display:block;margin-bottom:5px;color:#718096;font-size:.72rem'; name.textContent = label; const text = document.createElement('span'); text.style.cssText = 'display:block;color:#172033;font-size:.84rem;line-height:1.55;white-space:pre-wrap;word-break:break-word'; text.textContent = value == null || value === '' ? '-' : String(value); field.append(name, text); detailBody.append(field) });
              content.querySelector('[data-manager-status-back]').onclick = () => statusButton.click();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          } catch (error) { content.innerHTML = `<p style="padding:25px;color:#b42318">${error.message}</p>`; }
        };
      }
      if (nav.querySelector('[data-manager-notifications]')) return;
      const unread = notifications.filter(item => !item.readAt).length;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.managerNotifications = '1';
      button.innerHTML = `🔔 알림 ${unread ? `<b style="margin-left:5px;padding:2px 6px;border-radius:999px;background:#dc2626;color:#fff;font-size:.68rem">${unread}</b>` : ''}`;
      button.onclick = async () => {
        const content = document.querySelector('.content'); if (!content) return;
        nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
        content.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px"><div><h2 style="margin:0;font-size:1.25rem">알림</h2><p style="margin:5px 0 0;color:#8792a3;font-size:.78rem">보고 처리 및 대기열 변경 알림입니다.</p></div><button data-back type="button" style="padding:9px 14px;border:1px solid #ccd7e4;border-radius:8px;background:#fff;cursor:pointer">목록으로</button></div><section data-manager-notification-list style="overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff">${notifications.length ? notifications.map(item => `<article data-notification-id="${item.id}" style="padding:15px 17px;border-bottom:1px solid #edf1f5;background:${item.readAt ? '#fff' : '#f5f9ff'}"><b>${item.title}</b><p style="margin:7px 0;color:#56657a;white-space:pre-line">${item.message || ''}</p><small style="color:#98a2b3">${item.createdAt}</small></article>`).join('') : '<p style="padding:28px;text-align:center;color:#98a2b3">알림이 없습니다.</p>'}</section>`;
        installNotificationSelection(content.querySelector('[data-manager-notification-list]'),ids=>{ids.forEach(id=>{const index=notifications.findIndex(item=>Number(item.id)===id);if(index>=0)notifications.splice(index,1)})});
        await markNotificationsRead(notifications.filter(item => !item.readAt).map(item => item.id));
        notifications.forEach(item => { item.readAt = item.readAt || new Date().toISOString(); });
        button.querySelector('b')?.remove();
        document.querySelector('[data-header-notification-badge]')?.remove();
        content.querySelector('[data-back]').onclick = () => location.reload();
      };
      nav.append(button);
    };
    const observer = new MutationObserver(install); observer.observe(document.body, { childList: true, subtree: true }); install();
  }

  function installHeaderNotificationIcon(notifications) {
    if (!['requester','manager','director','secretary'].includes(role) || document.querySelector('[data-header-notifications]')) return;
    const unread = notifications.filter(item => !item.readAt).length;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.headerNotifications = '1'; button.className = 'icon-btn'; button.title = '알림'; button.setAttribute('aria-label', `알림${unread ? ` ${unread}건` : ''}`);
    button.style.cssText = 'position:relative;flex:none;width:38px;height:38px;display:grid;place-items:center;border:1px solid #8796aa;border-radius:9px;background:transparent;color:inherit;font-size:18px;cursor:pointer';
    button.innerHTML = `🔔${unread ? `<b data-header-notification-badge style="position:absolute;top:-6px;right:-7px;min-width:19px;height:19px;padding:0 5px;display:grid;place-items:center;border:2px solid #fff;border-radius:999px;background:#dc2626;color:#fff;font-size:.65rem;line-height:15px">${unread > 99 ? '99+' : unread}</b>` : ''}`;
    if (role === 'requester') {
      const identity = document.querySelector('.head .identity'); if (!identity) return;
      identity.insertAdjacentElement('afterend', button);
      const markRequesterNotifications = async () => {
        const ids = notifications.filter(item => !item.readAt).map(item => item.id); await markNotificationsRead(ids);
        notifications.forEach(item => { item.readAt = item.readAt || new Date().toISOString(); }); button.querySelector('[data-header-notification-badge]')?.remove();
      };
      button.onclick = async () => { document.querySelector('.nav [data-view="notices"]')?.click(); await markRequesterNotifications(); };
      document.querySelector('.nav [data-view="notices"]')?.addEventListener('click', markRequesterNotifications);
    } else if (['manager','director'].includes(role)) {
      const actions = document.querySelector('.top-actions'); if (!actions) return;
      actions.querySelectorAll('.icon-btn[aria-label="알림"]').forEach(existing => existing.remove());
      const settings = actions.querySelector('#userSettingsButton');
      if (settings) actions.insertBefore(button, settings);
      else {
        const form = actions.querySelector('form');
        if (form) actions.insertBefore(button, form); else actions.append(button);
      }
      button.onclick = () => document.querySelector('[data-manager-notifications]')?.click();
    } else {
      const actions = document.querySelector('.top-actions'); if (!actions) return;
      actions.querySelectorAll('.icon-btn[aria-label="알림"]').forEach(existing => existing.remove());
      actions.querySelector('[data-district-notices]')?.remove();
      const settings = actions.querySelector('#userSettingsButton'), form = actions.querySelector('form');
      if (settings) actions.insertBefore(button, settings); else if (form) actions.insertBefore(button, form); else actions.append(button);
      button.onclick = () => {
        const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:390;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
        overlay.innerHTML=`<section style="width:min(560px,100%);max-height:80vh;display:flex;flex-direction:column;overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;text-align:center;background:#c45124;color:#fff;font-size:1.05rem">알림</h2><div style="overflow-y:auto">${notifications.length?notifications.map(item=>`<article style="padding:15px 18px;border-bottom:1px solid #edf1f5;background:${item.readAt?'#fff':'#fff7ed'}"><b>${item.title}</b><p style="margin:7px 0;color:#56657a;white-space:pre-line">${item.message||''}</p><small style="color:#98a2b3">${item.createdAt}</small></article>`).join(''):'<p style="padding:32px;text-align:center;color:#98a2b3">알림이 없습니다.</p>'}</div><div style="padding:14px;text-align:center"><button data-close type="button" style="min-width:100px;padding:10px;border:0;border-radius:8px;background:#c45124;color:#fff;font-weight:800">확인</button></div></section>`;
        overlay.querySelector('[data-close]').onclick=async()=>{await markNotificationsRead(notifications.filter(item=>!item.readAt).map(item=>item.id));notifications.forEach(item=>item.readAt=item.readAt||new Date().toISOString());button.querySelector('[data-header-notification-badge]')?.remove();overlay.remove()};document.body.append(overlay);
      };
    }
  }

  async function initializeRoleNotifications() {
    if (typeof role === 'undefined' || !['requester', 'manager', 'director', 'secretary'].includes(role)) return;
    try {
      const response = await fetch('/app/api/notifications', { cache: 'no-store' });
      if (!response.ok) return;
      const notifications = (await response.json()).notifications || [];
      if (role === 'requester') {
        const unreadQueueNotifications = notifications.filter(item => !item.readAt && item.title === '[보고대기열 조정]');
        if (unreadQueueNotifications.length) showQueuePopup(unreadQueueNotifications);
      }
      if (['manager', 'director'].includes(role)) {
        const unreadQueueNotifications = notifications.filter(item => !item.readAt && item.title === '[보고대기열 조정]');
        if (unreadQueueNotifications.length) showQueuePopup(unreadQueueNotifications);
        installManagerNotifications(notifications);
      }
      installHeaderNotificationIcon(notifications);
    } catch (_error) {}
  }

  async function initializeManagerSecretaryLoginHistory() {
    if (typeof role === 'undefined' || !['manager', 'secretary'].includes(role)) return;
    try {
      const response = await fetch('/app/api/login-history/previous', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.previous) return;
      const shownKey = `previousLoginShown:${data.historyId}`;
      if (sessionStorage.getItem(shownKey)) return;
      sessionStorage.setItem(shownKey, '1');
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:360;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
      overlay.innerHTML = '<section role="dialog" aria-modal="true" style="width:min(430px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;text-align:center;background:#172033;color:#fff;font-size:1.05rem">최근 접속 정보</h2><p data-login-history style="margin:0;padding:27px 24px;text-align:center;color:#56657a;line-height:1.9;white-space:pre-line"></p><div style="padding:0 24px 22px;text-align:center"><button type="button" style="min-width:108px;padding:10px 18px;border:0;border-radius:8px;background:#26364d;color:#fff;font-weight:800;cursor:pointer">확인</button></div></section>';
      overlay.querySelector('[data-login-history]').textContent = `마지막 접속 IP: ${data.previous.ip}\n마지막 로그아웃 시간: ${data.previous.logoutAt || '기록 없음'}`;
      overlay.querySelector('button').onclick = () => overlay.remove();
      document.body.append(overlay);
    } catch (_error) {}
  }

  const noticeHtml = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  function renderDistrictNoticeOverlay(notices, popupMode = false) {
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:350;display:flex;align-items:'+(popupMode?'flex-start':'center')+';justify-content:'+(popupMode?'flex-start':'center')+';padding:20px;background:rgba(15,29,50,.68)';
    const popupContent=notices.length?notices.map(item=>`<article style="padding:16px 0;border-bottom:1px solid #edf1f5"><h3 style="margin:0 0 8px;font-size:1rem">${item.isPinned?'📌 ':''}${noticeHtml(item.title)}</h3><p style="margin:0;color:#56657a;line-height:1.75;white-space:pre-wrap">${noticeHtml(item.content)}</p>${item.attachmentPath?`<a href="${noticeHtml(item.attachmentPath)}" target="_blank" style="display:inline-block;margin-top:10px;color:#2563eb">📎 ${noticeHtml(item.attachmentName||'첨부파일')}</a>`:''}<small style="display:block;margin-top:9px;color:#98a2b3">${noticeHtml(item.createdAt)}</small></article>`).join(''):'<p style="padding:35px 0;text-align:center;color:#98a2b3">등록된 공지사항이 없습니다.</p>';
    const gridContent=`<div style="overflow:auto;padding:16px"><table style="width:100%;min-width:760px;border-collapse:collapse;font-size:.86rem"><thead><tr style="background:#f1f3f6;color:#172033"><th style="width:70px;padding:12px;border:1px solid #dce4ed">고정</th><th style="width:220px;padding:12px;border:1px solid #dce4ed">제목</th><th style="padding:12px;border:1px solid #dce4ed">내용</th><th style="width:150px;padding:12px;border:1px solid #dce4ed">첨부파일</th><th style="width:145px;padding:12px;border:1px solid #dce4ed">등록일</th></tr></thead><tbody>${notices.length?notices.map(item=>`<tr><td style="padding:12px;border:1px solid #e3e8ef;text-align:center">${item.isPinned?'📌':'-'}</td><td style="padding:12px;border:1px solid #e3e8ef;font-weight:800">${noticeHtml(item.title)}</td><td style="padding:12px;border:1px solid #e3e8ef;line-height:1.6;white-space:pre-wrap">${noticeHtml(item.content)}</td><td style="padding:12px;border:1px solid #e3e8ef;text-align:center">${item.attachmentPath?`<a href="${noticeHtml(item.attachmentPath)}" target="_blank" style="color:#2563eb">${noticeHtml(item.attachmentName||'다운로드')}</a>`:'-'}</td><td style="padding:12px;border:1px solid #e3e8ef;text-align:center;white-space:nowrap">${noticeHtml(item.createdAt)}</td></tr>`).join(''):'<tr><td colspan="5" style="padding:36px;border:1px solid #e3e8ef;text-align:center;color:#98a2b3">등록된 공지사항이 없습니다.</td></tr>'}</tbody></table></div>`;
    overlay.innerHTML=`<section role="dialog" aria-modal="true" style="width:${popupMode?'min(560px,100%)':'min(1100px,100%)'};max-height:85vh;display:flex;flex-direction:column;overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;text-align:center;background:#172033;color:#fff;font-size:1.05rem">공지사항</h2>${popupMode?`<div style="overflow-y:auto;padding:10px 24px">${popupContent}</div>`:gridContent}<div style="display:flex;align-items:center;justify-content:${popupMode?'space-between':'flex-end'};gap:12px;padding:14px 24px 20px;border-top:1px solid #edf1f5">${popupMode?'<label style="display:inline-flex;align-items:center;gap:7px;color:#56657a;font-size:.82rem"><input data-hide-today type="checkbox"> 오늘 하루 그만 보기</label>':''}<button type="button" style="min-width:108px;padding:10px 18px;border:0;border-radius:8px;background:#26364d;color:#fff;font-weight:800;cursor:pointer">확인</button></div></section>`;
    overlay.querySelector('button').onclick=()=>{if(popupMode&&overlay.querySelector('[data-hide-today]').checked){const today=new Date().toLocaleDateString('en-CA');notices.forEach(item=>localStorage.setItem(`districtNoticeHide:${item.id}`,today))}overlay.remove()};document.body.append(overlay);
  }
  function showDistrictNoticeDetail(item){
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:360;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
    overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="districtNoticeDetailTitle" style="width:min(680px,100%);max-height:85vh;display:flex;flex-direction:column;overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 id="districtNoticeDetailTitle" style="margin:0;padding:17px 60px;text-align:center;background:#172033;color:#fff;font-size:1.05rem">공지사항 상세</h2><div style="overflow-y:auto;padding:24px"><div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:16px"><span style="font-size:1.05rem">${item.isPinned?'📌':''}</span><h3 style="margin:0;color:#172033;font-size:1.15rem;line-height:1.5">${noticeHtml(item.title)}</h3></div><div style="min-height:150px;padding:18px;border:1px solid #e3e8ef;border-radius:10px;background:#fafbfd;color:#46556a;line-height:1.8;white-space:pre-wrap">${noticeHtml(item.content)}</div>${item.attachmentPath?`<div style="margin-top:16px"><b style="display:block;margin-bottom:7px;color:#172033;font-size:.84rem">첨부파일</b><a href="${noticeHtml(item.attachmentPath)}" target="_blank" style="color:#2563eb">📎 ${noticeHtml(item.attachmentName||'첨부파일')}</a></div>`:''}<div style="margin-top:16px;color:#8792a3;font-size:.8rem;text-align:right">등록일 ${noticeHtml(item.createdAt)}</div></div><div style="display:flex;justify-content:center;padding:14px 24px 20px;border-top:1px solid #edf1f5"><button type="button" style="min-width:108px;padding:10px 18px;border:0;border-radius:8px;background:#000;color:#fff;font-weight:800;cursor:pointer">확인</button></div></section>`;
    const onKeydown=event=>{if(event.key==='Escape')close()};const close=()=>{document.removeEventListener('keydown',onKeydown);overlay.remove()};overlay.querySelector('button').onclick=close;overlay.onclick=event=>{if(event.target===overlay)close()};document.addEventListener('keydown',onKeydown);document.body.appendChild(overlay);
  }
  function createDistrictNoticePage(notices){
    const host=document.querySelector('main.main .content')||document.querySelector('.workspace > main.main')||document.querySelector('main.main');if(!host)return null;
    let page=host.querySelector('[data-district-notice-page]');if(page)return page;
    page=document.createElement('section');page.dataset.districtNoticePage='1';page.style.cssText='display:none;width:100%;min-width:0';
    page.innerHTML=`<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px"><div><h2 style="margin:0;color:#172033;font-size:1.45rem">공지사항</h2><p style="margin:7px 0 0;color:#718096;font-size:.86rem">등록된 공지사항을 확인할 수 있습니다.</p></div><strong style="color:#172033">총 ${notices.length}건</strong></div><div style="overflow:auto;border:1px solid #dce4ed;border-radius:13px;background:#fff;box-shadow:0 5px 18px rgba(30,48,75,.05)"><table style="width:100%;min-width:760px;border-collapse:collapse;font-size:.86rem"><thead><tr style="background:#f1f3f6;color:#172033"><th style="width:70px;padding:13px;border-bottom:1px solid #dce4ed">고정</th><th style="width:220px;padding:13px;border-bottom:1px solid #dce4ed;text-align:left">제목</th><th style="padding:13px;border-bottom:1px solid #dce4ed;text-align:left">내용</th><th style="width:150px;padding:13px;border-bottom:1px solid #dce4ed">첨부파일</th><th style="width:145px;padding:13px;border-bottom:1px solid #dce4ed">등록일</th></tr></thead><tbody>${notices.length?notices.map(item=>`<tr data-notice-id="${noticeHtml(item.id)}" tabindex="0" style="cursor:pointer"><td style="padding:13px;border-bottom:1px solid #edf1f5;text-align:center">${item.isPinned?'📌':'-'}</td><td style="padding:13px;border-bottom:1px solid #edf1f5;font-weight:800">${noticeHtml(item.title)}</td><td style="padding:13px;border-bottom:1px solid #edf1f5;line-height:1.65;white-space:pre-wrap">${noticeHtml(item.content)}</td><td style="padding:13px;border-bottom:1px solid #edf1f5;text-align:center">${item.attachmentPath?`<a href="${noticeHtml(item.attachmentPath)}" target="_blank" style="color:#2563eb">${noticeHtml(item.attachmentName||'다운로드')}</a>`:'-'}</td><td style="padding:13px;border-bottom:1px solid #edf1f5;text-align:center;white-space:nowrap">${noticeHtml(item.createdAt)}</td></tr>`).join(''):'<tr><td colspan="5" style="padding:42px;text-align:center;color:#98a2b3">등록된 공지사항이 없습니다.</td></tr>'}</tbody></table></div>`;
    page.querySelector('tbody').addEventListener('click',event=>{if(event.target.closest('a'))return;const row=event.target.closest('tr[data-notice-id]');if(!row)return;const item=notices.find(value=>String(value.id)===row.dataset.noticeId);if(item)showDistrictNoticeDetail(item)});page.querySelector('tbody').addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const row=event.target.closest('tr[data-notice-id]');if(!row)return;event.preventDefault();const item=notices.find(value=>String(value.id)===row.dataset.noticeId);if(item)showDistrictNoticeDetail(item)});
    host.appendChild(page);const contentChildren=()=>Array.from(host.children).filter(item=>item!==page);
    page.showNoticePage=()=>{contentChildren().forEach(item=>{if(!item.hasAttribute('data-notice-previous-display'))item.setAttribute('data-notice-previous-display',item.style.display||'');item.style.display='none'});page.style.display='block'};
    page.hideNoticePage=()=>{page.style.display='none';contentChildren().forEach(item=>{if(item.hasAttribute('data-notice-previous-display')){item.style.display=item.getAttribute('data-notice-previous-display');item.removeAttribute('data-notice-previous-display')}})};
    return page;
  }
  window.openDistrictNoticePage=async()=>{try{const response=await fetch('/app/api/district-notices',{cache:'no-store'});if(!response.ok)return;const notices=(await response.json()).notices||[];document.querySelector('[data-district-notice-page]')?.remove();const page=createDistrictNoticePage(notices);if(page)page.showNoticePage()}catch(_error){}};
  function installDistrictNoticeMenu(notices){
    const install=()=>{const nav=document.getElementById('nav')||document.querySelector('.side .nav');if(!nav||nav.querySelector('[data-district-notice-menu]'))return;const button=document.createElement('button');button.type='button';button.dataset.districtNoticeMenu='1';button.textContent='📢 공지사항';button.onclick=()=>{const page=createDistrictNoticePage(notices);if(!page)return;nav.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));page.showNoticePage()};nav.addEventListener('click',event=>{const selected=event.target.closest('button');if(!selected||selected===button)return;const page=document.querySelector('[data-district-notice-page]');if(page?.hideNoticePage)page.hideNoticePage()});nav.append(button)};
    const observer=new MutationObserver(install);observer.observe(document.body,{childList:true,subtree:true});install();
  }
  async function initializeDistrictNotices(){
    if(typeof role==='undefined'||!['requester','manager','secretary'].includes(role))return;
    try{const response=await fetch('/app/api/district-notices',{cache:'no-store'});if(!response.ok)return;const notices=(await response.json()).notices||[];installDistrictNoticeMenu(notices);
      const topActions=document.querySelector('.top-actions');if(!['manager','secretary'].includes(role)&&topActions&&!topActions.querySelector('[data-district-notices]')){const button=document.createElement('button');button.type='button';button.dataset.districtNotices='1';button.className='icon-btn';button.title='공지사항';button.textContent='📢';button.onclick=()=>window.openDistrictNoticePage();topActions.prepend(button)}
      const today=new Date().toLocaleDateString('en-CA'),popups=notices.filter(item=>item.popupActive&&!localStorage.getItem(`districtNoticeHide:${item.id}`)?.includes(today));if(popups.length)renderDistrictNoticeOverlay(popups,true);
    }catch(_error){}
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
    initializeManagerSecretaryLoginHistory();
    initializeRoleNotifications();
    initializeDistrictNotices();
    installRequesterQueueLayout();
    installRequesterSubmitValidation();
    renameRequesterCallStatus();
    installRequesterMobileMenu();
    installManagerMobileMenu();
    if(typeof role!=='undefined'&&role==='requester')installNotificationSelection(document.getElementById('noticeList'));
  });
})();
