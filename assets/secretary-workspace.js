(() => {
  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof role !== 'undefined' && ['requester','manager'].includes(role)) {
      const nav = document.getElementById('nav') || document.querySelector('.nav');
      const host = role === 'requester' ? document.querySelector('.main') : document.querySelector('.content');
      if (!nav || !host) return;
      let calendarView = null;
      const closeCalendar = () => { if (calendarView) calendarView.style.display='none'; Array.from(host.children).forEach(child=>{if(child!==calendarView&&child.dataset.scheduleOldDisplay!==undefined)child.style.display=child.dataset.scheduleOldDisplay}); };
      async function showReadOnlyDay(date, target='구청장') {
        calendarView.style.display='block';
        calendarView.innerHTML=`<h2 style="margin:0 0 6px">${target} 24시간 일정표</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">비서실에서 등록한 일정을 시간대별로 조회할 수 있습니다.</p><section style="max-width:980px;overflow:hidden;border:1px solid #dce4ed;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;gap:10px;padding:13px 15px;background:${role==='requester'?'#2563eb':'#6650a4'};color:#fff"><button data-day-back type="button">달력으로</button><strong>${target} 일정</strong><select data-day-target style="margin-left:auto;padding:8px 28px 8px 10px;border:0;border-radius:7px"><option value="구청장">구청장</option><option value="부서장">부서장</option></select><input data-day-date type="date" value="${date}" style="padding:8px 10px;border:0;border-radius:7px"></header><div data-day-timeline style="max-height:650px;overflow-y:auto;padding:12px 16px;background:#fff"></div></section>`;
        calendarView.querySelector('[data-day-target]').value=target;
        const back=calendarView.querySelector('[data-day-back]');back.style.cssText='padding:8px 11px;border:1px solid rgba(255,255,255,.6);border-radius:7px;background:#fff;color:#172033;font-weight:800;cursor:pointer';
        const timeline=calendarView.querySelector('[data-day-timeline]');
        try{const response=await fetch(`/app/api/secretary/schedule?date=${encodeURIComponent(date)}&target=${encodeURIComponent(target)}`,{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.message||'일정을 불러오지 못했습니다.');const slots=result.slots||[],interval=30,slotCount=48,rowHeight=30;timeline.innerHTML=`<div style="display:grid;grid-template-columns:72px minmax(0,1fr);grid-template-rows:repeat(${slotCount},${rowHeight}px);position:relative">${Array.from({length:slotCount},(_,index)=>`<span style="grid-column:1;grid-row:${index+1};padding:7px 8px 0 0;border-top:1px solid ${index%2?'#f1f5f9':'#dce4ed'};color:#718096;text-align:right;font-size:.68rem">${String(Math.floor(index/2)).padStart(2,'0')}:${index%2?'30':'00'}</span><div style="grid-column:2;grid-row:${index+1};border-top:1px solid ${index%2?'#f1f5f9':'#dce4ed'};background:${index%2?'#fafcff':'#fff'}"></div>`).join('')}${slots.map(slot=>{const [sh,sm]=slot.startTime.split(':').map(Number),[eh,em]=slot.endTime.split(':').map(Number),first=Math.floor((sh*60+sm)/interval),last=Math.max(first+1,Math.ceil((eh*60+em)/interval));return `<article style="grid-column:2;grid-row:${first+1}/${last+1};z-index:3;margin:2px 7px;padding:8px 10px;border:1px solid ${slot.slotType==='report_available'?'#6ee7b7':'#cbd5e1'};border-radius:7px;background:${slot.slotType==='report_available'?'#d1fae5':'#f1f5f9'};overflow:hidden"><b style="font-size:.78rem">${slot.startTime}–${slot.endTime} · ${slot.slotType==='report_available'?'보고 가능':slot.title}</b></article>`}).join('')}</div>`}catch(error){timeline.innerHTML=`<p style="padding:28px;color:#b42318">${error.message}</p>`}
        back.onclick=()=>showReadOnly(new Date(`${date}T00:00:00`),target);
        calendarView.querySelector('[data-day-target]').onchange=event=>showReadOnlyDay(date,event.target.value);
        calendarView.querySelector('[data-day-date]').onchange=event=>showReadOnlyDay(event.target.value,target);
      }
      async function showReadOnly(baseDate=new Date(),target='구청장') {
        Array.from(host.children).forEach(child=>{if(child!==calendarView){child.dataset.scheduleOldDisplay=child.style.display;child.style.display='none'}});
        if(!calendarView){calendarView=document.createElement('section');calendarView.style.cssText='padding:22px;min-height:100%';host.append(calendarView)}
        calendarView.style.display='block';
        const year=baseDate.getFullYear(),monthIndex=baseDate.getMonth(),month=`${year}-${String(monthIndex+1).padStart(2,'0')}`;
        calendarView.innerHTML=`<h2 style="margin:0 0 6px">결정권자 일정</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">비서실에서 등록한 일정을 조회할 수 있습니다.</p><div style="overflow:hidden;border:1px solid #dce4ed;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;justify-content:center;gap:12px;padding:13px;background:${role==='requester'?'#2563eb':'#6650a4'};color:#fff"><select data-readonly-target style="margin-right:auto;padding:8px 28px 8px 10px;border:0;border-radius:7px"><option value="구청장">구청장</option><option value="부서장">부서장</option></select><button data-readonly-prev type="button">‹</button><strong>${year}년 ${monthIndex+1}월</strong><button data-readonly-next type="button">›</button><button data-readonly-today type="button" style="margin-left:auto">오늘</button></header><div style="display:grid;grid-template-columns:repeat(7,1fr)">${['일','월','화','수','목','금','토'].map(day=>`<b style="padding:9px;text-align:center;font-size:.75rem">${day}</b>`).join('')}</div><div data-readonly-calendar style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:minmax(105px,1fr)"></div></div>`;
        calendarView.querySelector('[data-readonly-target]').value=target;
        calendarView.querySelectorAll('header button').forEach(button=>button.style.cssText+=';min-width:34px;padding:7px 10px;border:1px solid rgba(255,255,255,.55);border-radius:7px;background:#fff;color:#172033;font-weight:800;cursor:pointer');
        const grid=calendarView.querySelector('[data-readonly-calendar]');
        try{const response=await fetch(`/app/api/secretary/schedule/month?month=${month}&target=${encodeURIComponent(target)}`,{cache:'no-store'}),result=await response.json();if(!response.ok)throw new Error(result.message||'일정을 불러오지 못했습니다.');const slots=result.slots||[],leading=new Date(year,monthIndex,1).getDay(),lastDay=new Date(year,monthIndex+1,0).getDate();grid.innerHTML=Array.from({length:42},(_,index)=>{const day=index-leading+1,valid=day>0&&day<=lastDay,date=valid?`${month}-${String(day).padStart(2,'0')}`:'',daily=valid?slots.filter(slot=>slot.scheduleDate===date):[];return `<button type="button" ${valid?`data-readonly-date="${date}"`:'disabled'} style="min-width:0;padding:8px;border:0;border-top:1px solid #edf1f5;border-right:1px solid #edf1f5;background:${valid?'#fff':'#f8fafc'};text-align:left;cursor:${valid?'pointer':'default'}"><b>${valid?day:''}</b>${daily.map(slot=>`<span style="display:block;overflow:hidden;margin-top:4px;padding:4px;border-left:3px solid ${slot.slotType==='report_available'?'#059669':'#64748b'};background:${slot.slotType==='report_available'?'#ecfdf3':'#f1f5f9'};font-size:.67rem;white-space:nowrap;text-overflow:ellipsis">${slot.startTime}–${slot.endTime} ${slot.slotType==='report_available'?'보고 가능':slot.title}</span>`).join('')}</button>`}).join('');grid.querySelectorAll('[data-readonly-date]').forEach(button=>button.onclick=()=>showReadOnlyDay(button.dataset.readonlyDate,target))}catch(error){grid.innerHTML=`<p style="grid-column:1/-1;padding:30px;color:#b42318">${error.message}</p>`}
        calendarView.querySelector('[data-readonly-target]').onchange=event=>showReadOnly(baseDate,event.target.value);
        calendarView.querySelector('[data-readonly-prev]').onclick=()=>showReadOnly(new Date(year,monthIndex-1,1),target);
        calendarView.querySelector('[data-readonly-next]').onclick=()=>showReadOnly(new Date(year,monthIndex+1,1),target);
        calendarView.querySelector('[data-readonly-today]').onclick=()=>showReadOnly(new Date(),target);
      }
      function ensureMenu(){if(nav.querySelector('[data-readonly-schedule]'))return;const button=document.createElement('button');button.type='button';button.dataset.readonlySchedule='1';button.textContent='📅 결정권자 일정';button.onclick=()=>{nav.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));showReadOnly()};nav.append(button)}
      document.addEventListener('click',event=>{if(event.target.closest('#nav button:not([data-readonly-schedule])'))closeCalendar()},true);
      new MutationObserver(ensureMenu).observe(nav,{childList:true});ensureMenu();return;
    }
    if (typeof role === 'undefined' || role !== 'secretary') return;
    const content = document.querySelector('.content');
    const nav = document.getElementById('nav');
    if (!content || !nav) return;

    let items = [];
    try {
      const response = await fetch('/app/api/secretary/requests', { cache: 'no-store' });
      if (!response.ok) throw new Error('비서실 요청을 불러오지 못했습니다.');
      items = (await response.json()).requests || [];
    } catch (error) {
      content.innerHTML = `<div style="padding:30px;border:1px solid #fecaca;border-radius:12px;background:#fff;color:#b42318">${error.message}</div>`;
      return;
    }

    const labels = {
      secretary_review: '배정 대기', reservation_confirmed: '예약 확정',
      waiting: '대기 중', called: '호출 예정', completed: '완료',
    };
    function customDialog(title, message, options = {}) {
      return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:320;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
        overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(420px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px 60px;text-align:center;background:#c45124;color:#fff;font-size:1.05rem"></h2><p style="margin:0;padding:27px 24px;text-align:center;color:#56657a;line-height:1.7;white-space:pre-line"></p><div style="display:flex;justify-content:center;gap:8px;padding:0 24px 22px"></div></section>`;
        overlay.querySelector('h2').textContent = title;
        overlay.querySelector('p').textContent = message;
        overlay.querySelector('p').style.maxHeight = '60vh';
        overlay.querySelector('p').style.overflowY = 'auto';
        const actions = overlay.querySelector('div');
        const close = value => { overlay.remove(); resolve(value); };
        if (options.cancelLabel) {
          const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = options.cancelLabel;
          cancel.style.cssText = 'width:auto;min-width:108px;height:40px;min-height:40px;padding:0 18px;border:1px solid #c45124;border-radius:8px;background:#fff;color:#c45124;font-size:.8rem;font-weight:800;line-height:38px;box-shadow:none;cursor:pointer';
          cancel.onclick = () => close(false); actions.append(cancel);
        }
        const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = options.confirmLabel || '확인';
        confirm.style.cssText = `width:auto;min-width:108px;height:40px;min-height:40px;padding:0 18px;border:1px solid ${options.danger ? '#dc2626' : '#c45124'};border-radius:8px;background:${options.danger ? '#dc2626' : '#c45124'};color:#fff;font-size:.8rem;font-weight:800;line-height:38px;box-shadow:none;cursor:pointer`;
        confirm.onclick = () => close(true); actions.append(confirm);
        overlay.onclick = event => { if (event.target === overlay && options.cancelLabel) close(false); };
        document.body.append(overlay);
        confirm.focus();
      });
    }
    nav.innerHTML = '<button data-view="schedule">📅 결정권자 일정</button><button data-view="queue" class="active">⏱️ 통합 대기열</button><button data-view="stats">📈 처리 현황</button><button data-view="district-notices" data-district-notice-menu="1">📢 공지사항</button>';
    content.style.maxWidth = 'none';

    const requestCard = (item) => { const immediate=item.urgency==='즉시',urgent=item.urgency==='긴급',priority=immediate?'즉시':urgent?'긴급':'',background=immediate?'#fff1f2':urgent?'#fff7ed':'#fff',accent=immediate?'#dc2626':urgent?'#f97316':'transparent';return `<button data-secretary-id="${item.id}" data-priority="${priority}" ${['reservation_confirmed', 'waiting', 'called'].includes(item.status) ? 'draggable="true"' : ''} style="display:block;width:100%;padding:14px;border:0;border-left:5px solid ${accent};border-bottom:1px solid #edf1f5;background:${background};text-align:left;box-shadow:${priority?'inset 0 0 0 1px '+accent+'22':'none'};cursor:${['reservation_confirmed', 'waiting', 'called'].includes(item.status) ? 'grab' : 'pointer'}">
      <span style="float:right;padding:4px 8px;border-radius:999px;background:#f3e8ff;color:#7e22ce;font-size:.7rem">${labels[item.status] || item.status}</span>
      <div style="display:flex;align-items:center;gap:7px;color:#7b8798;font-size:.72rem"><b style="padding:${priority?'3px 7px':'0'};border-radius:999px;background:${priority?accent:'transparent'};color:${priority?'#fff':'#7c3aed'};font-size:${priority?'.7rem':'inherit'}">${immediate?'<span class="secretary-priority-icon">🚨</span> 즉시':urgent?'<span class="secretary-priority-icon">⚠</span> 긴급':item.urgency}</b><span>${item.requestCode}</span><span>${item.requesterName} · ${item.department || '-'}${item.team ? ` / ${item.team}` : ''}</span></div>
      <strong style="display:block;margin-top:7px;font-size:.88rem">${item.title}</strong><p style="margin:6px 0;color:#66758b;font-size:.76rem">${item.summary}</p>
      <small style="color:#98a2b3">${item.reportTarget} · 기한: ${item.desiredDate || '-'}${item.queueNo ? ` · 대기번호 ${item.queueNo}번` : ''}</small></button>`; };

    function statsCards() {
      const groups = [['배정 대기', 'secretary_review'], ['예약 확정', 'reservation_confirmed'], ['호출 예정', 'called'], ['오늘 완료', 'completed']];
      return `<div id="secretaryStats" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px">${groups.map(([label, status]) => `<div style="padding:16px;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><b style="display:block;color:#7c3aed;font-size:.75rem">${label}</b><strong style="display:block;margin-top:7px;font-size:1.5rem">${items.filter(item => item.status === status).length}</strong></div>`).join('')}</div>`;
    }

    async function act(item, action) {
      const names = { assign: '대기열 배정', urgent: '긴급 삽입', complete: '보고 완료 처리', complete_call: '보고 완료 처리 & 호출' };
      const nextItem = action === 'complete_call'
        ? items.filter(candidate => candidate.id !== item.id && ['reservation_confirmed', 'waiting', 'called'].includes(candidate.status)).sort((a, b) => (a.queueNo || 9999) - (b.queueNo || 9999))[0]
        : null;
      const confirmationMessage = action === 'complete_call'
        ? `보고 완료되었습니다. 대기열 보고자[${nextItem?.title || '다음 보고 없음'}], [${nextItem?.managerName || '부장 미지정'}]에게 알림을 보내겠습니까?`
        : `${names[action]} 처리하시겠습니까?`;
      const approved = await customDialog(names[action], confirmationMessage, { cancelLabel: '취소', confirmLabel: '확인', danger: action === 'urgent' });
      if (!approved) return;
      const response = await fetch(`/app/api/secretary/requests/${item.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) { await customDialog(`${names[action]} 결과`, result.message || '처리하지 못했습니다.'); return; }
      await customDialog(`${names[action]} 결과`, result.message || `${names[action]} 처리가 완료되었습니다.`);
      location.reload();
    }

    async function callManager(item) {
      const isRecall = item.status === 'called';
      const callLabel = isRecall ? '재호출하기' : '호출하기';
      const now = new Date(Date.now() + 10 * 60 * 1000);
      const defaultTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:270;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
      overlay.innerHTML = `<section style="width:min(420px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px;text-align:center;background:#c45124;color:#fff;font-size:1.05rem">부서장 ${isRecall?'재호출':'호출'}</h2><div style="padding:24px"><p style="margin:0 0 14px;color:#56657a;line-height:1.6"><b>${item.title}</b><br>부서장에게 전달할 대기 마감 시각을 선택해 주세요.</p><label style="display:grid;gap:7px;font-size:.78rem;font-weight:800">대기 시각<input data-wait-until type="time" value="${defaultTime}" required style="height:42px;padding:0 12px;border:1px solid #ccd7e4;border-radius:8px"></label></div><div style="display:flex;justify-content:center;gap:8px;padding:0 24px 22px"><button data-cancel type="button">취소</button><button data-confirm type="button">${callLabel}</button></div></section>`;
      overlay.querySelectorAll('button').forEach(button=>button.style.cssText='min-width:108px;height:40px;border:1px solid #c45124;border-radius:8px;background:#fff;color:#c45124;font-weight:800;cursor:pointer');
      overlay.querySelector('[data-confirm]').style.cssText += ';background:#c45124;color:#fff';
      overlay.querySelector('[data-cancel]').onclick=()=>overlay.remove();
      overlay.querySelector('[data-confirm]').onclick=async()=>{const waitUntil=overlay.querySelector('[data-wait-until]').value;if(!waitUntil)return;const approved=await customDialog(`부서장 ${isRecall?'재호출':'호출'}`, `${waitUntil}까지 대기하세요.\n메시지를 부서장에게 ${isRecall?'다시 ':''}보내시겠습니까?`,{cancelLabel:'취소',confirmLabel:'확인'});if(!approved)return;const response=await fetch(`/app/api/secretary/requests/${item.id}/action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'call',waitUntil})}),result=await response.json();if(!response.ok){await customDialog(`${isRecall?'재호출':'호출'} 결과`,result.message||'호출하지 못했습니다.');return}overlay.remove();await customDialog(`${isRecall?'재호출':'호출'} 결과`,result.message);location.reload()};
      document.body.append(overlay); overlay.querySelector('[data-wait-until]').focus();
    }

    function showDetail(item) {
      const panel = document.getElementById('secretaryDetail');
      const rows = [['요청번호', item.requestCode], ['상태', labels[item.status] || item.status], ['요청자', `${item.requesterName} · ${item.department || '-'}${item.team ? ` / ${item.team}` : ''}`], ['긴급도', item.urgency], ['보고 대상', item.reportTarget], ['안건명', item.title], ['안건 요약', item.summary], ['배석자', item.attendees || '-'], ['의사결정 기한', item.desiredDate || '-'], ['대기번호', item.queueNo ? `${item.queueNo}번` : '-'], ['예상 호출', item.estimatedAt || '-']];
      panel.innerHTML = `<h3 class="secretary-scroll-head secretary-detail-head" style="text-align:center">요청 상세</h3><div class="secretary-scroll-body secretary-detail-body" style="padding:0 18px 18px">${rows.map(([name, value]) => `<div style="padding:9px 0;border-bottom:1px solid #edf1f5"><b style="display:block;margin-bottom:3px;color:#7b8798;font-size:.72rem">${name}</b><span style="font-size:.82rem;white-space:pre-wrap">${value}</span></div>`).join('')}</div><div data-actions class="secretary-detail-actions"></div>`;
      const actions = panel.querySelector('[data-actions]');
      const add = (text, action, color) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.style.cssText = `width:auto;min-width:104px;height:38px;min-height:38px;padding:0 15px;border:1px solid ${color};border-radius:8px;background:${color};color:#fff;font-size:.76rem;font-weight:800;line-height:36px;box-shadow:none;cursor:pointer;white-space:nowrap`;
        button.onclick = () => act(item, action);
        actions.append(button);
      };
      if (item.status === 'secretary_review') { add('대기열 배정', 'assign', '#059669'); if (['긴급', '즉시'].includes(item.urgency)) add('긴급 삽입', 'urgent', '#dc2626'); }
      if (['reservation_confirmed', 'waiting', 'called'].includes(item.status)) {
        add('보고 완료 처리', 'complete', '#0f766e');
        add('보고 완료 처리 & 호출', 'complete_call', '#b42318');
      }
      if (!actions.children.length) actions.remove();
    }

    function bindCards() {
      document.querySelectorAll('[data-secretary-id]').forEach(button => button.onclick = () => {
        document.querySelectorAll('[data-secretary-id]').forEach(row => row.style.background = row.dataset.priority==='즉시'?'#fff1f2':row.dataset.priority==='긴급'?'#fff7ed':'#fff');
        button.style.background = button.dataset.priority==='즉시'?'#ffe4e6':button.dataset.priority==='긴급'?'#ffedd5':'#f5f3ff';
        showDetail(items.find(item => String(item.id) === button.dataset.secretaryId));
      });
      document.querySelectorAll('[data-secretary-queue-list] [data-secretary-id]').forEach(card=>{const item=items.find(value=>String(value.id)===card.dataset.secretaryId);if(!item||card.querySelector('[data-call-manager]'))return;const call=document.createElement('span');call.dataset.callManager='1';call.setAttribute('role','button');call.tabIndex=0;call.textContent=item.status==='called'?'재호출하기':'호출하기';call.style.cssText='float:right;clear:right;margin-top:8px;padding:6px 11px;border-radius:7px;background:#c45124;color:#fff;font-size:.72rem;font-weight:800;cursor:pointer';call.onclick=event=>{event.preventDefault();event.stopPropagation();callManager(item)};call.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();callManager(item)}};card.append(call)});
    }

    function bindQueueDragAndDrop() {
      const list = document.querySelector('[data-secretary-queue-list]');
      if (!list) return;
      let dragged = null, moved = false;
      const cards = () => Array.from(list.querySelectorAll('[data-secretary-id]'));
      cards().forEach(card => {
        card.addEventListener('dragstart', event => {
          dragged = card; moved = false;
          card.style.opacity = '.45';
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', card.dataset.secretaryId);
        });
        card.addEventListener('dragover', event => {
          event.preventDefault();
          if (!dragged || dragged === card) return;
          const box = card.getBoundingClientRect();
          list.insertBefore(dragged, event.clientY < box.top + box.height / 2 ? card : card.nextSibling);
          moved = true;
        });
        card.addEventListener('dragend', async () => {
          if (!dragged) return;
          dragged.style.opacity = '1';
          dragged = null;
          if (!moved) return;
          const orderedIds = cards().map(card => Number(card.dataset.secretaryId));
          const approved = await customDialog('대기열 순서 조정', '대기열을 조정하시겠습니까?', { cancelLabel: '취소', confirmLabel: '확인' });
          if (!approved) { location.reload(); return; }
          cards().forEach((card, index) => {
            const queueText = card.querySelector('small');
            if (queueText) queueText.textContent = queueText.textContent.replace(/대기번호 \d+번/, `대기번호 ${index + 1}번`);
          });
          const response = await fetch('/app/api/secretary/requests/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderedIds }) });
          const result = await response.json();
          if (!response.ok) { await customDialog('대기열 순서 조정', result.message || '순서를 저장하지 못했습니다.'); location.reload(); return; }
          await customDialog('대기열 순서 조정', result.message || '대기열 순서를 조정하고 담당자에게 알림을 보냈습니다.');
          location.reload();
        });
      });
    }

    function queueView() {
      const pending = items.filter(item => item.status === 'secretary_review');
      const queued = items.filter(item => ['reservation_confirmed', 'waiting', 'called'].includes(item.status)).sort((a, b) => (a.queueNo || 999) - (b.queueNo || 999));
      content.innerHTML = `<style>
        @keyframes secretaryPriorityBlink{0%,45%,100%{opacity:1;transform:scale(1)}55%,85%{opacity:.12;transform:scale(.82)}}
        .secretary-priority-icon{display:inline-block;transform-origin:center;animation:secretaryPriorityBlink 1.15s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){.secretary-priority-icon{animation:none}}
        .secretary-queue-grid{height:calc(100vh - 280px);min-height:360px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 330px;gap:14px;overflow:hidden}
        .secretary-scroll-block{min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff}
        .secretary-scroll-head{flex:0 0 auto;margin:0;padding:14px;border-bottom:1px solid #edf1f5;background:#fff;font-size:.86rem}
        .secretary-scroll-body{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
        #secretaryDetail{min-height:0;display:flex;flex-direction:column;overflow:hidden}
        #secretaryDetail>.secretary-detail-head{position:relative;z-index:3;flex:0 0 auto;margin:0;background:#fff}
        #secretaryDetail>.secretary-detail-body{min-height:0;flex:1 1 auto;overflow-x:hidden;overflow-y:auto;text-align:left;overscroll-behavior:contain;scrollbar-gutter:stable}
        #secretaryDetail>.secretary-detail-actions{position:relative;z-index:3;flex:0 0 48px;display:flex;align-items:center;justify-content:center;gap:8px;height:48px;min-height:48px;margin:0;padding:5px 12px;border-top:1px solid #edf1f5;background:#fff}
        @media(max-width:1000px){.secretary-queue-grid{height:auto;min-height:0;grid-template-columns:1fr}.secretary-scroll-block,#secretaryDetail{height:460px}}
      </style><h2 style="margin:0 0 6px;font-size:1.25rem">통합 대기열 관리</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">부서장이 상신한 요청을 확인하고 대기번호와 호출 순서를 관리합니다.</p>${statsCards()}
        <section class="secretary-queue-grid"><div class="secretary-scroll-block"><h3 class="secretary-scroll-head">배정 대기 · ${pending.length}건</h3><div class="secretary-scroll-body">${pending.map(requestCard).join('') || '<p style="padding:25px;text-align:center;color:#98a2b3">부서장이 상신한 요청이 없습니다.</p>'}</div></div>
        <div class="secretary-scroll-block"><h3 class="secretary-scroll-head">예약·호출 대기열 · ${queued.length}건</h3><div class="secretary-scroll-body" data-secretary-queue-list>${queued.map(requestCard).join('') || '<p style="padding:25px;text-align:center;color:#98a2b3">배정된 요청이 없습니다.</p>'}</div></div>
        <aside id="secretaryDetail" style="border:1px solid #e1e7ef;border-radius:12px;background:#fff;color:#718096;text-align:center"><h3 class="secretary-scroll-head" style="text-align:center">요청 상세</h3><div class="secretary-scroll-body" style="display:grid;place-items:center;padding:18px">📋<br><br>안건을 클릭하면<br>상세 내용이 표시됩니다.</div></aside></section>`;
      bindCards();
      bindQueueDragAndDrop();
    }

    async function loadSchedule(date, target = '구청장') {
      const response = await fetch(`/app/api/secretary/schedule?date=${encodeURIComponent(date)}&target=${encodeURIComponent(target)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || '일정을 불러오지 못했습니다.');
      return result.slots || [];
    }

    async function renderScheduleSlots(date) {
      const list = document.getElementById('mayorScheduleList');
      try {
        const slots = await loadSchedule(date);
        list.innerHTML = slots.length ? slots.map(slot => `<article style="display:grid;grid-template-columns:110px 1fr auto;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid #edf1f5;background:${slot.slotType === 'report_available' ? '#ecfdf3' : '#fff'}">
          <b style="font-size:.82rem;color:${slot.slotType === 'report_available' ? '#047857' : '#43516a'}">${slot.startTime}–${slot.endTime}</b>
          <div><strong style="font-size:.84rem">${slot.slotType === 'report_available' ? '보고 가능' : slot.title}</strong><p style="margin:4px 0 0;color:#718096;font-size:.72rem">${slot.slotType === 'report_available' ? '구청장이 보고·결재를 받을 수 있는 예약 시간' : '일반 일정'}</p></div>
          <button data-delete-slot="${slot.id}" type="button" style="width:auto;min-width:44px;height:28px;min-height:28px;padding:0 9px;border:1px solid #efb4b4;border-radius:6px;background:#fff;color:#c73535;font-size:.72rem;font-weight:700;line-height:26px;box-shadow:none">삭제</button></article>`).join('') : '<p style="padding:30px;text-align:center;color:#98a2b3">등록된 일정이 없습니다.</p>';
        list.querySelectorAll('[data-delete-slot]').forEach(button => button.onclick = async () => {
          if (!confirm('이 일정을 삭제하시겠습니까?')) return;
          const response = await fetch(`/app/api/secretary/schedule/${button.dataset.deleteSlot}`, { method: 'DELETE' });
          const result = await response.json();
          if (!response.ok) { alert(result.message); return; }
          renderScheduleSlots(date);
        });
      } catch (error) { list.innerHTML = `<p style="padding:25px;color:#b42318">${error.message}</p>`; }
    }

    function scheduleView() {
      const today = new Date().toISOString().slice(0, 10);
      content.innerHTML = `<h2 style="margin:0 0 6px;font-size:1.25rem">구청장 하루 일정표 관리</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem"><b>보고 가능</b>은 구청장이 보고 또는 결재를 받을 수 있는 예약 시간 블록입니다.</p>
        <section style="max-width:920px;overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:14px;border-bottom:1px solid #edf1f5;background:#172033;color:#fff"><strong>구청장 일정</strong><input id="mayorScheduleDate" type="date" value="${today}" style="margin-left:auto;padding:8px 10px;border:1px solid #64748b;border-radius:8px"></header>
        <form id="mayorScheduleForm" style="display:grid;grid-template-columns:120px 120px 150px minmax(180px,1fr) auto;gap:9px;padding:14px;border-bottom:1px solid #edf1f5;background:#f8fafc"><input name="startTime" type="time" required aria-label="시작시간"><input name="endTime" type="time" required aria-label="종료시간"><select name="slotType"><option value="report_available">보고 가능</option><option value="general">일반 일정</option></select><input name="title" placeholder="일반 일정 제목 (보고 가능은 입력 불필요)"><button type="submit">등록</button><p data-message style="grid-column:1/-1;min-height:18px;margin:0;color:#b42318;font-size:.76rem"></p></form><div id="mayorScheduleList"></div></section>`;
      const dateInput = document.getElementById('mayorScheduleDate');
      const form = document.getElementById('mayorScheduleForm');
      dateInput.onchange = () => renderScheduleSlots(dateInput.value);
      form.elements.slotType.onchange = () => { const general = form.elements.slotType.value === 'general'; form.elements.title.disabled = !general; form.elements.title.required = general; if (!general) form.elements.title.value = ''; };
      form.elements.slotType.dispatchEvent(new Event('change'));
      form.onsubmit = async event => {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(form)); payload.date = dateInput.value;
        const response = await fetch('/app/api/secretary/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) { form.querySelector('[data-message]').textContent = result.message || '등록하지 못했습니다.'; return; }
        form.reset(); form.elements.slotType.dispatchEvent(new Event('change')); form.querySelector('[data-message]').textContent = ''; renderScheduleSlots(dateInput.value);
      };
      renderScheduleSlots(today);
    }

    async function scheduleCalendarView(baseDate = new Date(), target = '구청장') {
      const year = baseDate.getFullYear(), monthIndex = baseDate.getMonth(), month = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      content.innerHTML = `<h2 style="margin:0 0 6px;font-size:1.25rem">결정권자 일정 달력</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">월간 일정을 확인하고 날짜를 선택하면 24시간 일정표에서 상세 일정을 관리할 수 있습니다.</p><section style="overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;justify-content:center;gap:14px;padding:14px;background:#c45124;color:#fff"><button data-prev-month type="button" aria-label="이전 달" style="width:34px;height:32px;border:1px solid rgba(255,255,255,.5);border-radius:7px;background:transparent;color:#fff;cursor:pointer">‹</button><strong style="min-width:130px;text-align:center;font-size:1.05rem">${year}년 ${monthIndex + 1}월</strong><button data-next-month type="button" aria-label="다음 달" style="width:34px;height:32px;border:1px solid rgba(255,255,255,.5);border-radius:7px;background:transparent;color:#fff;cursor:pointer">›</button><button data-today type="button" style="position:absolute;right:28px;padding:7px 12px;border:1px solid rgba(255,255,255,.55);border-radius:7px;background:#fff;color:#c45124;font-weight:800;cursor:pointer">오늘</button></header><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid #e1e7ef">${['일','월','화','수','목','금','토'].map((day,index)=>`<b style="padding:10px;text-align:center;color:${index===0?'#dc2626':index===6?'#2563eb':'#526078'};font-size:.78rem">${day}</b>`).join('')}</div><div id="secretaryMonthCalendar" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:minmax(112px,1fr)"></div></section>`;
      content.querySelector('section > header').style.position = 'relative';
      const targetPicker = document.createElement('label');
      targetPicker.style.cssText = 'position:absolute;left:18px;display:flex;align-items:center;gap:7px;font-size:.78rem;font-weight:800';
      targetPicker.innerHTML = `일정 대상 <select style="padding:7px 28px 7px 10px;border:1px solid rgba(255,255,255,.6);border-radius:7px;background:#fff;color:#172033"><option value="구청장">구청장</option><option value="부서장">부서장</option></select>`;
      targetPicker.querySelector('select').value = target;
      targetPicker.querySelector('select').onchange = event => scheduleCalendarView(baseDate, event.target.value);
      content.querySelector('section > header').prepend(targetPicker);
      const importBar = document.createElement('div');
      importBar.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:-4px 0 12px';
      importBar.innerHTML = '<a data-csv-example download="결정권자_일정_예제.csv" style="padding:9px 12px;border:1px solid #c45124;border-radius:8px;background:#fff;color:#c45124;font-size:.76rem;font-weight:800;text-decoration:none">CSV 예제 다운로드</a><label style="padding:9px 12px;border:1px solid #c45124;border-radius:8px;background:#c45124;color:#fff;font-size:.76rem;font-weight:800;cursor:pointer">UTF-8 CSV 업로드<input data-csv-upload type="file" accept=".csv,text/csv" style="display:none"></label>';
      const example = '\ufeff날짜,대상,시작시간,종료시간,구분,제목\r\n2026-08-17,구청장,09:00,10:00,general,간부회의\r\n2026-08-17,구청장,10:00,10:30,report_available,보고 가능\r\n2026-08-17,부서장,13:00,14:00,general,부서 업무회의\r\n2026-08-17,부서장,14:00,15:00,report_available,보고 가능\r\n';
      importBar.querySelector('[data-csv-example]').href = URL.createObjectURL(new Blob([example], { type: 'text/csv;charset=utf-8' }));
      content.querySelector('section').before(importBar);
      importBar.querySelector('[data-csv-upload]').onchange = async event => {
        const file = event.target.files[0]; if (!file) return;
        try {
          const text = (await file.text()).replace(/^\ufeff/, '');
          const parse = line => { const cells=[]; let value='', quoted=false; for(let i=0;i<line.length;i++){const char=line[i];if(char==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(char===','&&!quoted){cells.push(value.trim());value='';}else value+=char;}cells.push(value.trim());return cells; };
          const lines = text.split(/\r?\n/).filter(line => line.trim());
          if (lines.length < 2) throw new Error('CSV에 등록할 일정이 없습니다.');
          const headers = parse(lines[0]), required = ['날짜','대상','시작시간','종료시간','구분','제목'];
          if (required.some(header => !headers.includes(header))) throw new Error('CSV 헤더를 예제 파일과 동일하게 작성해 주세요.');
          const rows = lines.slice(1).map(line => { const cells=parse(line), get=name=>cells[headers.indexOf(name)]||''; return { date:get('날짜'),target:get('대상'),startTime:get('시작시간'),endTime:get('종료시간'),slotType:get('구분'),title:get('제목') }; });
          const approved = await customDialog('일정 CSV 등록', `${rows.length}건의 일정을 처리하시겠습니까?\n시간이 정확히 같은 일정은 업데이트하고, 일부 겹치는 일정은 건너뜁니다.`, { cancelLabel:'취소', confirmLabel:'등록' });
          if (!approved) return;
          const response = await fetch('/app/api/secretary/schedule/import', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({rows}) });
          const result = await response.json(); if (!response.ok) throw new Error(result.message || 'CSV 일정을 등록하지 못했습니다.');
          const statusLabel = { inserted:'신규', updated:'수정', skipped:'건너뜀' };
          const detailMessage = [result.message, '', ...(result.details || []).map(detail => `${detail.line}행 [${statusLabel[detail.status] || detail.status}] ${detail.reason}`)].join('\n');
          await customDialog('CSV 처리 결과', detailMessage); scheduleCalendarView(baseDate, target);
        } catch (error) { await customDialog('CSV 업로드 오류', error.message || 'CSV 파일을 처리하지 못했습니다.'); }
        finally { event.target.value = ''; }
      };
      const calendar = document.getElementById('secretaryMonthCalendar');
      try {
        const response = await fetch(`/app/api/secretary/schedule/month?month=${month}&target=${encodeURIComponent(target)}`, { cache: 'no-store' }), result = await response.json();
        if (!response.ok) throw new Error(result.message || '월간 일정을 불러오지 못했습니다.');
        const slots = result.slots || [], first = new Date(year, monthIndex, 1), lastDay = new Date(year, monthIndex + 1, 0).getDate(), leading = first.getDay(), today = new Date().toISOString().slice(0, 10), cells = [];
        for (let index = 0; index < 42; index += 1) {
          const day = index - leading + 1, valid = day >= 1 && day <= lastDay, date = valid ? `${month}-${String(day).padStart(2, '0')}` : '', daily = valid ? slots.filter(slot => slot.scheduleDate === date) : [];
          cells.push(`<button type="button" ${valid?`data-calendar-date="${date}"`:'disabled'} style="min-width:0;padding:8px;border:0;border-right:1px solid #edf1f5;border-bottom:1px solid #edf1f5;background:${date===today?'#fff7ed':valid?'#fff':'#f8fafc'};text-align:left;vertical-align:top;cursor:${valid?'pointer':'default'}"><b style="display:block;margin-bottom:6px;color:${index%7===0?'#dc2626':index%7===6?'#2563eb':'#334155'}">${valid?day:''}</b>${daily.slice(0,3).map(slot=>`<span style="display:block;overflow:hidden;margin-top:3px;padding:4px 5px;border-left:3px solid ${slot.slotType==='report_available'?'#059669':'#c45124'};border-radius:4px;background:${slot.slotType==='report_available'?'#ecfdf3':'#fff0e8'};color:#43516a;font-size:.67rem;white-space:nowrap;text-overflow:ellipsis">${slot.startTime} ${slot.slotType==='report_available'?'보고 가능':slot.title}</span>`).join('')}${daily.length>3?`<small style="display:block;margin-top:4px;color:#7b8798">외 ${daily.length-3}건</small>`:''}</button>`);
        }
        calendar.innerHTML = cells.join('');
        calendar.querySelectorAll('[data-calendar-date]').forEach(button => button.onclick = () => scheduleTimelineView(button.dataset.calendarDate, target));
      } catch (error) { calendar.innerHTML = `<p style="grid-column:1/-1;padding:30px;color:#b42318">${error.message}</p>`; }
      content.querySelector('[data-prev-month]').onclick = () => scheduleCalendarView(new Date(year, monthIndex - 1, 1), target);
      content.querySelector('[data-next-month]').onclick = () => scheduleCalendarView(new Date(year, monthIndex + 1, 1), target);
      content.querySelector('[data-today]').onclick = () => scheduleCalendarView(new Date(), target);
    }

    function scheduleTimelineView(selectedDate, target = '구청장') {
      const today = selectedDate || new Date().toISOString().slice(0, 10);
      content.innerHTML = `<h2 style="margin:0 0 6px;font-size:1.25rem">구청장 24시간 일정표</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">시간 칸을 클릭하거나 위·아래로 드래그해 구간을 선택하세요. 30분 단위로 지정됩니다.</p>
        <section style="max-width:980px;overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 15px;background:#172033;color:#fff"><strong>구청장 일정</strong><label style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:.78rem">시간 간격 <select id="timelineInterval" style="padding:8px 10px;border:1px solid #64748b;border-radius:8px;background:#fff"><option value="30">30분</option><option value="10">10분</option></select></label><input id="timelineDate" type="date" value="${today}" style="padding:8px 10px;border:1px solid #64748b;border-radius:8px"></header>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 15px;border-bottom:1px solid #edf1f5;background:#f8fafc"><b id="timelineSelection" style="min-width:155px;color:#43516a">시간을 선택해 주세요</b><label style="display:inline-flex;align-items:center;gap:6px;font-weight:800"><input id="timelineAvailable" type="checkbox" checked> 보고 가능</label><input id="timelineTitle" placeholder="일반 일정 제목" disabled style="flex:1;min-width:190px;padding:9px 10px;border:1px solid #ccd7e4;border-radius:8px"><button id="timelineSave" type="button" disabled style="width:auto;min-width:120px;height:40px;min-height:40px;padding:0 16px;border:1px solid #26364d;border-radius:8px;background:#26364d;color:#fff;font-size:.78rem;font-weight:800;line-height:38px;box-shadow:none;cursor:pointer;white-space:nowrap">선택 시간 등록</button><span id="timelineMessage" style="width:100%;min-height:17px;color:#b42318;font-size:.76rem"></span></div>
        <div id="scheduleTimeline" style="max-height:650px;overflow-y:auto;padding:12px 16px;background:#fff;user-select:none"></div></section>`;
      const dateInput = document.getElementById('timelineDate');
      content.querySelector('h2').textContent = `${target} 24시간 일정표`;
      const timelineHeading = content.querySelector('section > header > strong');
      timelineHeading.textContent = `${target} 일정`;
      const timelineTarget = document.createElement('select');
      timelineTarget.style.cssText = 'padding:8px 28px 8px 10px;border:1px solid #64748b;border-radius:8px;background:#fff;color:#172033';
      timelineTarget.innerHTML = '<option value="구청장">구청장</option><option value="부서장">부서장</option>';
      timelineTarget.value = target;
      timelineTarget.onchange = event => scheduleTimelineView(dateInput.value, event.target.value);
      timelineHeading.after(timelineTarget);
      const intervalInput = document.getElementById('timelineInterval');
      const available = document.getElementById('timelineAvailable');
      const title = document.getElementById('timelineTitle');
      const save = document.getElementById('timelineSave');
      const selection = document.getElementById('timelineSelection');
      const message = document.getElementById('timelineMessage');
      let start = null, end = null, anchor = null, dragging = false, resizeState = null, interval = Number(intervalInput.value);
      const time = index => { const minutes = index * interval; if (minutes >= 1440) return '24:00'; return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
      const paint = () => {
        document.querySelectorAll('[data-time-index]').forEach(cell => { const index = Number(cell.dataset.timeIndex); cell.style.background = start !== null && index >= start && index < end ? '#dbeafe' : index % 2 ? '#fafcff' : '#fff'; });
        selection.textContent = start === null ? '시간을 선택해 주세요' : `${time(start)}–${time(end)} 선택`;
        save.disabled = start === null;
      };
      async function draw() {
        message.textContent = '';
        const slots = await loadSchedule(dateInput.value, target);
        const timeline = document.getElementById('scheduleTimeline');
        const slotCount = 1440 / interval, rowHeight = interval === 10 ? 24 : 30;
        timeline.innerHTML = `<div data-timeline-grid style="display:grid;grid-template-columns:72px minmax(0,1fr);grid-template-rows:repeat(${slotCount},${rowHeight}px);position:relative">${Array.from({ length: slotCount }, (_, index) => `<span style="grid-column:1;grid-row:${index + 1};padding:${interval === 10 ? '4px' : '7px'} 8px 0 0;border-top:1px solid ${(index * interval) % 60 ? '#f1f5f9' : '#dce4ed'};color:#718096;text-align:right;font-size:.68rem">${time(index)}</span><div data-time-index="${index}" style="grid-column:2;grid-row:${index + 1};border-top:1px solid ${(index * interval) % 60 ? '#f1f5f9' : '#dce4ed'};cursor:crosshair"></div>`).join('')}${slots.map(slot => { const [sh, sm] = slot.startTime.split(':').map(Number), [eh, em] = slot.endTime.split(':').map(Number), first = Math.floor((sh * 60 + sm) / interval), last = Math.ceil((eh * 60 + em) / interval); return `<article data-existing-slot data-slot-id="${slot.id}" data-slot-start="${first}" data-slot-end="${Math.max(first + 1, last)}" style="grid-column:2;grid-row:${first + 1}/${Math.max(first + 2, last + 1)};z-index:3;margin:2px 7px;padding:8px 10px;border:1px solid ${slot.slotType === 'report_available' ? '#6ee7b7' : '#cbd5e1'};border-radius:7px;background:${slot.slotType === 'report_available' ? '#d1fae5' : '#f1f5f9'};display:flex;align-items:center;justify-content:space-between;gap:10px;overflow:visible;position:relative" title="위아래 경계를 끌어 일정 시간을 조절할 수 있습니다"><i data-resize-handle="start" aria-label="시작시간 조절" style="position:absolute;z-index:5;top:-4px;left:20px;right:20px;height:8px;border-radius:8px;background:#64748b;cursor:ns-resize"></i><span><b data-slot-label>${slot.startTime}–${slot.endTime} · ${slot.slotType === 'report_available' ? '보고 가능' : slot.title}</b></span><button data-delete-slot="${slot.id}" type="button" style="flex:none;width:auto;min-width:44px;height:26px;min-height:26px;padding:0 9px;border:1px solid #efb4b4;border-radius:6px;background:#fff;color:#c73535;font-size:.68rem;font-weight:700;line-height:24px;box-shadow:none">삭제</button><i data-resize-handle="end" aria-label="종료시간 조절" style="position:absolute;z-index:5;bottom:-4px;left:20px;right:20px;height:8px;border-radius:8px;background:#64748b;cursor:ns-resize"></i></article>`; }).join('')}</div>`;
        timeline.querySelectorAll('[data-time-index]').forEach(cell => {
          cell.onmousedown = event => { event.preventDefault(); dragging = true; anchor = Number(cell.dataset.timeIndex); start = anchor; end = anchor + 1; paint(); };
          cell.onmouseenter = () => { if (!dragging) return; const index = Number(cell.dataset.timeIndex); start = Math.min(anchor, index); end = Math.max(anchor, index) + 1; paint(); };
          cell.onclick = () => { if (start === null) { anchor = Number(cell.dataset.timeIndex); start = anchor; end = start + 1; paint(); } };
        });
        timeline.querySelectorAll('[data-resize-handle]').forEach(handle => {
          handle.onmousedown = event => {
            event.preventDefault(); event.stopPropagation(); dragging = false;
            const block = handle.closest('[data-existing-slot]');
            resizeState = { block, edge: handle.dataset.resizeHandle, start: Number(block.dataset.slotStart), end: Number(block.dataset.slotEnd), originalStart: Number(block.dataset.slotStart), originalEnd: Number(block.dataset.slotEnd), grid: timeline.querySelector('[data-timeline-grid]'), rowHeight, slotCount, labelSuffix: block.querySelector('[data-slot-label]').textContent.split(' · ').slice(1).join(' · ') };
            document.body.style.cursor = 'ns-resize';
          };
        });
        timeline.querySelectorAll('[data-delete-slot]').forEach(button => button.onclick = async () => {
          const approved = await customDialog('시간 블록 삭제', '이 시간 블록을 삭제하시겠습니까?\n삭제한 일정은 복구할 수 없습니다.', { cancelLabel: '취소', confirmLabel: '삭제', danger: true });
          if (!approved) return;
          button.disabled = true;
          const response = await fetch(`/app/api/secretary/schedule/${button.dataset.deleteSlot}?target=${encodeURIComponent(target)}`, { method: 'DELETE' });
          const result = await response.json();
          if (!response.ok) { button.disabled = false; await customDialog('삭제 결과', result.message || '시간 블록을 삭제하지 못했습니다.'); return; }
          start = end = null; await draw(); paint();
          await customDialog('삭제 결과', result.message || '시간 블록을 삭제했습니다.');
        });
        paint();
      }
      document.addEventListener('mousemove', event => {
        if (!resizeState) return;
        event.preventDefault();
        const gridRect = resizeState.grid.getBoundingClientRect();
        const boundary = Math.max(0, Math.min(resizeState.slotCount, Math.round((event.clientY - gridRect.top) / resizeState.rowHeight)));
        if (resizeState.edge === 'start') resizeState.start = Math.min(boundary, resizeState.end - 1);
        else resizeState.end = Math.max(resizeState.start + 1, boundary);
        resizeState.block.style.gridRow = `${resizeState.start + 1}/${resizeState.end + 1}`;
        resizeState.block.dataset.slotStart = String(resizeState.start);
        resizeState.block.dataset.slotEnd = String(resizeState.end);
        resizeState.block.querySelector('[data-slot-label]').textContent = `${time(resizeState.start)}–${time(resizeState.end)} · ${resizeState.labelSuffix}`;
        message.textContent = `${time(resizeState.start)}–${time(resizeState.end)}로 조절 중입니다.`;
      });
      document.addEventListener('mouseup', async () => {
        dragging = false;
        if (!resizeState) return;
        const state = resizeState; resizeState = null; document.body.style.cursor = '';
        const changed = state.start !== state.originalStart || state.end !== state.originalEnd;
        if (!changed) { message.textContent = ''; return; }
        const approved = await customDialog('일정 조정', `${time(state.start)}–${time(state.end)}로 일정을 조정하시겠습니까?`, { cancelLabel: '취소', confirmLabel: '적용' });
        if (!approved) { message.textContent = ''; await draw(); return; }
        message.textContent = '일정 시간을 변경하는 중입니다.';
        const response = await fetch(`/app/api/secretary/schedule/${state.block.dataset.slotId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateInput.value, startTime: time(state.start), endTime: time(state.end), target }) });
        const result = await response.json();
        if (!response.ok) { message.textContent = result.message || '일정 시간을 변경하지 못했습니다.'; await draw(); return; }
        message.textContent = changed ? (result.message || '일정 시간을 변경했습니다.') : '';
        await draw();
      }, { once: false });
      available.onchange = () => { title.disabled = available.checked; title.required = !available.checked; if (available.checked) title.value = ''; };
      intervalInput.onchange = () => { interval = Number(intervalInput.value); start = end = anchor = null; draw(); };
      dateInput.onchange = () => { start = end = null; draw(); };
      save.onclick = async () => {
        if (start === null) return;
        const payload = { date: dateInput.value, startTime: time(start), endTime: time(end), slotType: available.checked ? 'report_available' : 'general', title: title.value.trim(), target };
        const response = await fetch('/app/api/secretary/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) { message.textContent = result.message || '등록하지 못했습니다.'; return; }
        start = end = null; title.value = ''; await draw(); paint();
      };
      draw();
    }

    function statsView() {
      const statuses = ['secretary_review', 'reservation_confirmed', 'waiting', 'called', 'completed'];
      const max = Math.max(1, ...statuses.map(status => items.filter(item => item.status === status).length));
      content.innerHTML = `<h2 style="margin:0 0 16px">상태별 처리 현황</h2><section style="max-width:760px;padding:20px;border:1px solid #e1e7ef;border-radius:12px;background:#fff">${statuses.map(status => { const count = items.filter(item => item.status === status).length; return `<div style="display:grid;grid-template-columns:90px 1fr 45px;align-items:center;gap:10px;margin:13px 0"><b style="font-size:.76rem">${labels[status]}</b><div style="height:9px;border-radius:999px;background:#edf1f5"><div style="width:${count / max * 100}%;height:100%;border-radius:999px;background:#7c3aed"></div></div><span>${count}건</span></div>`; }).join('')}</section>`;
    }

    function show(view) {
      nav.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
      if (view === 'district-notices') { if (window.openDistrictNoticePage) window.openDistrictNoticePage(); return; }
      if (view === 'schedule') scheduleCalendarView(); else if (view === 'stats') statsView(); else queueView();
    }
    nav.querySelectorAll('[data-view]').forEach(button => button.onclick = () => show(button.dataset.view));
    show('queue');
  });
})();
