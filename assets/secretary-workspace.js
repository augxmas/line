(() => {
  document.addEventListener('DOMContentLoaded', async () => {
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
        overlay.style.cssText = 'position:fixed;inset:0;z-index:260;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,29,50,.68)';
        overlay.innerHTML = `<section role="dialog" aria-modal="true" style="width:min(420px,100%);overflow:hidden;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(0,0,0,.3)"><h2 style="margin:0;padding:17px 60px;text-align:center;background:#000;color:#fff;font-size:1.05rem"></h2><p style="margin:0;padding:27px 24px;text-align:center;color:#56657a;line-height:1.7;white-space:pre-line"></p><div style="display:flex;justify-content:center;gap:8px;padding:0 24px 22px"></div></section>`;
        overlay.querySelector('h2').textContent = title;
        overlay.querySelector('p').textContent = message;
        const actions = overlay.querySelector('div');
        const close = value => { overlay.remove(); resolve(value); };
        if (options.cancelLabel) {
          const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = options.cancelLabel;
          cancel.style.cssText = 'width:auto;min-width:108px;height:40px;min-height:40px;padding:0 18px;border:1px solid #ccd7e4;border-radius:8px;background:#fff;color:#26364d;font-size:.8rem;font-weight:800;line-height:38px;box-shadow:none;cursor:pointer';
          cancel.onclick = () => close(false); actions.append(cancel);
        }
        const confirm = document.createElement('button'); confirm.type = 'button'; confirm.textContent = options.confirmLabel || '확인';
        confirm.style.cssText = `width:auto;min-width:108px;height:40px;min-height:40px;padding:0 18px;border:1px solid ${options.danger ? '#dc2626' : '#26364d'};border-radius:8px;background:${options.danger ? '#dc2626' : '#26364d'};color:#fff;font-size:.8rem;font-weight:800;line-height:38px;box-shadow:none;cursor:pointer`;
        confirm.onclick = () => close(true); actions.append(confirm);
        overlay.onclick = event => { if (event.target === overlay && options.cancelLabel) close(false); };
        document.body.append(overlay);
        confirm.focus();
      });
    }
    nav.innerHTML = '<button data-view="schedule">📅 결정권자 일정</button><button data-view="queue" class="active">⏱️ 통합 대기열</button><button data-view="stats">📈 처리 현황</button>';
    content.style.maxWidth = 'none';

    const requestCard = (item) => `<button data-secretary-id="${item.id}" style="display:block;width:100%;padding:14px;border:0;border-bottom:1px solid #edf1f5;background:#fff;text-align:left;cursor:pointer">
      <span style="float:right;padding:4px 8px;border-radius:999px;background:#f3e8ff;color:#7e22ce;font-size:.7rem">${labels[item.status] || item.status}</span>
      <div style="display:flex;gap:7px;color:#7b8798;font-size:.72rem"><b style="color:#7c3aed">${item.urgency}</b><span>${item.requestCode}</span><span>${item.requesterName} · ${item.department || '-'}${item.team ? ` / ${item.team}` : ''}</span></div>
      <strong style="display:block;margin-top:7px;font-size:.88rem">${item.title}</strong><p style="margin:6px 0;color:#66758b;font-size:.76rem">${item.summary}</p>
      <small style="color:#98a2b3">${item.reportTarget} · 기한: ${item.desiredDate || '-'}${item.queueNo ? ` · 대기번호 ${item.queueNo}번` : ''}</small></button>`;

    function statsCards() {
      const groups = [['배정 대기', 'secretary_review'], ['예약 확정', 'reservation_confirmed'], ['호출 예정', 'called'], ['오늘 완료', 'completed']];
      return `<div id="secretaryStats" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px">${groups.map(([label, status]) => `<div style="padding:16px;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><b style="display:block;color:#7c3aed;font-size:.75rem">${label}</b><strong style="display:block;margin-top:7px;font-size:1.5rem">${items.filter(item => item.status === status).length}</strong></div>`).join('')}</div>`;
    }

    async function act(item, action) {
      const names = { assign: '대기열 배정', urgent: '긴급 삽입', complete: '보고 완료 처리' };
      const approved = await customDialog(names[action], `${names[action]} 처리하시겠습니까?`, { cancelLabel: '취소', confirmLabel: '확인', danger: action === 'urgent' });
      if (!approved) return;
      const response = await fetch(`/app/api/secretary/requests/${item.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok) { await customDialog(`${names[action]} 결과`, result.message || '처리하지 못했습니다.'); return; }
      await customDialog(`${names[action]} 결과`, result.message || `${names[action]} 처리가 완료되었습니다.`);
      location.reload();
    }

    function showDetail(item) {
      const panel = document.getElementById('secretaryDetail');
      const rows = [['요청번호', item.requestCode], ['상태', labels[item.status] || item.status], ['요청자', `${item.requesterName} · ${item.department || '-'}${item.team ? ` / ${item.team}` : ''}`], ['긴급도', item.urgency], ['보고 대상', item.reportTarget], ['안건명', item.title], ['안건 요약', item.summary], ['배석자', item.attendees || '-'], ['의사결정 기한', item.desiredDate || '-'], ['대기번호', item.queueNo ? `${item.queueNo}번` : '-'], ['예상 호출', item.estimatedAt || '-']];
      panel.innerHTML = `<h3 style="margin:0 0 16px">요청 상세</h3>${rows.map(([name, value]) => `<div style="padding:9px 0;border-bottom:1px solid #edf1f5"><b style="display:block;margin-bottom:3px;color:#7b8798;font-size:.72rem">${name}</b><span style="font-size:.82rem;white-space:pre-wrap">${value}</span></div>`).join('')}<div data-actions style="display:flex;justify-content:center;gap:8px;margin-top:18px"></div>`;
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
      if (['reservation_confirmed', 'waiting', 'called'].includes(item.status)) add('보고 완료 처리', 'complete', '#0f766e');
      if (!actions.children.length) actions.remove();
    }

    function bindCards() {
      document.querySelectorAll('[data-secretary-id]').forEach(button => button.onclick = () => {
        document.querySelectorAll('[data-secretary-id]').forEach(row => row.style.background = '#fff');
        button.style.background = '#f5f3ff';
        showDetail(items.find(item => String(item.id) === button.dataset.secretaryId));
      });
    }

    function queueView() {
      const pending = items.filter(item => item.status === 'secretary_review');
      const queued = items.filter(item => ['reservation_confirmed', 'waiting', 'called'].includes(item.status)).sort((a, b) => (a.queueNo || 999) - (b.queueNo || 999));
      content.innerHTML = `<h2 style="margin:0 0 6px;font-size:1.25rem">통합 대기열 관리</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">부서장이 상신한 요청을 확인하고 대기번호와 호출 순서를 관리합니다.</p>${statsCards()}
        <section style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 330px;gap:14px"><div style="overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><h3 style="margin:0;padding:14px;border-bottom:1px solid #edf1f5;font-size:.86rem">배정 대기 · ${pending.length}건</h3>${pending.map(requestCard).join('') || '<p style="padding:25px;text-align:center;color:#98a2b3">부서장이 상신한 요청이 없습니다.</p>'}</div>
        <div style="overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><h3 style="margin:0;padding:14px;border-bottom:1px solid #edf1f5;font-size:.86rem">예약·호출 대기열 · ${queued.length}건</h3>${queued.map(requestCard).join('') || '<p style="padding:25px;text-align:center;color:#98a2b3">배정된 요청이 없습니다.</p>'}</div>
        <aside id="secretaryDetail" style="min-height:540px;padding:18px;border:1px solid #e1e7ef;border-radius:12px;background:#fff;color:#718096;text-align:center">📋<br><br>안건을 클릭하면<br>상세 내용이 표시됩니다.</aside></section>`;
      bindCards();
    }

    async function loadSchedule(date) {
      const response = await fetch(`/app/api/secretary/schedule?date=${encodeURIComponent(date)}`, { cache: 'no-store' });
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

    function scheduleTimelineView() {
      const today = new Date().toISOString().slice(0, 10);
      content.innerHTML = `<h2 style="margin:0 0 6px;font-size:1.25rem">구청장 24시간 일정표</h2><p style="margin:0 0 16px;color:#8792a3;font-size:.78rem">시간 칸을 클릭하거나 위·아래로 드래그해 구간을 선택하세요. 30분 단위로 지정됩니다.</p>
        <section style="max-width:980px;overflow:hidden;border:1px solid #e1e7ef;border-radius:12px;background:#fff"><header style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:13px 15px;background:#172033;color:#fff"><strong>구청장 일정</strong><label style="display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-size:.78rem">시간 간격 <select id="timelineInterval" style="padding:8px 10px;border:1px solid #64748b;border-radius:8px;background:#fff"><option value="30">30분</option><option value="10">10분</option></select></label><input id="timelineDate" type="date" value="${today}" style="padding:8px 10px;border:1px solid #64748b;border-radius:8px"></header>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 15px;border-bottom:1px solid #edf1f5;background:#f8fafc"><b id="timelineSelection" style="min-width:155px;color:#43516a">시간을 선택해 주세요</b><label style="display:inline-flex;align-items:center;gap:6px;font-weight:800"><input id="timelineAvailable" type="checkbox" checked> 보고 가능</label><input id="timelineTitle" placeholder="일반 일정 제목" disabled style="flex:1;min-width:190px;padding:9px 10px;border:1px solid #ccd7e4;border-radius:8px"><button id="timelineSave" type="button" disabled style="width:auto;min-width:120px;height:40px;min-height:40px;padding:0 16px;border:1px solid #26364d;border-radius:8px;background:#26364d;color:#fff;font-size:.78rem;font-weight:800;line-height:38px;box-shadow:none;cursor:pointer;white-space:nowrap">선택 시간 등록</button><span id="timelineMessage" style="width:100%;min-height:17px;color:#b42318;font-size:.76rem"></span></div>
        <div id="scheduleTimeline" style="max-height:650px;overflow-y:auto;padding:12px 16px;background:#fff;user-select:none"></div></section>`;
      const dateInput = document.getElementById('timelineDate');
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
        const slots = await loadSchedule(dateInput.value);
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
          const response = await fetch(`/app/api/secretary/schedule/${button.dataset.deleteSlot}`, { method: 'DELETE' });
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
        const response = await fetch(`/app/api/secretary/schedule/${state.block.dataset.slotId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateInput.value, startTime: time(state.start), endTime: time(state.end) }) });
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
        const payload = { date: dateInput.value, startTime: time(start), endTime: time(end), slotType: available.checked ? 'report_available' : 'general', title: title.value.trim() };
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
      if (view === 'schedule') scheduleTimelineView(); else if (view === 'stats') statsView(); else queueView();
    }
    nav.querySelectorAll('[data-view]').forEach(button => button.onclick = () => show(button.dataset.view));
    show('queue');
  });
})();
