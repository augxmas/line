import { themeCss, themeFontLinks } from './theme';

export function renderHomePage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="지자체 보고·결재 요청과 결정권자 일정을 하나로 연결하는 업무관리 서비스">
  <title>리포트온 | 지자체 보고·결재 예약관리</title>
  <link rel="icon" href="/favicon.ico">
  ${themeFontLinks}
  <style>${themeCss}
    .nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:30px;background:var(--color-bg);padding:15px max(40px,calc((100% - 1240px) / 2 + 40px))}
    .nav-brand{display:flex;align-items:baseline;gap:12px;margin-right:auto;font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:20px;color:var(--color-text)}
    .nav-mark{width:26px;height:26px;font-size:15px;transform:translateY(4px)}
    .nav-sub{font-family:var(--font-sans);font-size:12px;font-weight:500;letter-spacing:.1em;color:var(--ink-65)}
    .nav-link{color:var(--color-text);font-size:15px;white-space:nowrap}.nav .btn{white-space:nowrap}
    .sec{max-width:1240px;margin:0 auto;padding:0 40px}.sec-gap{padding-top:132px}
    .h2{font-size:clamp(32px,4.4vw,56px);line-height:1.14;letter-spacing:-.02em}
    .sec-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.85fr);gap:24px 80px;align-items:end}.sec-head p{font-size:17px;color:var(--ink-78)}
    .hero{padding-top:104px;padding-bottom:56px}.hero .kicker{margin-bottom:40px}
    .hero h1{font-size:clamp(42px,5.6vw,84px);line-height:1.1;letter-spacing:-.02em;margin-left:-.035em}.hero h1 span{color:var(--color-accent)}
    .hero-lead{max-width:62ch;margin-top:40px;font-size:19px;line-height:1.75;color:var(--ink-80)}
    .hero-cta{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin-top:44px}
    .hero-note{font-family:var(--font-sans);margin-top:34px;font-size:14px;color:var(--ink-65)}
    .demo{background:var(--color-surface);padding:clamp(20px,3vw,40px)}
    .demo-bar{display:flex;align-items:center;gap:12px;padding-bottom:22px;font-family:var(--font-sans);font-size:13px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-65)}
    .demo-dot{width:7px;height:7px;background:var(--color-accent)}.demo-live{margin-left:auto}
    .demo-body{display:grid;grid-template-columns:minmax(0,190px) minmax(0,1fr);gap:clamp(20px,3vw,44px);background:var(--color-bg);padding:clamp(20px,2.6vw,34px)}
    .demo-side-t{margin-bottom:18px;font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:17px}
    .demo-menu{display:grid;gap:12px;font-family:var(--font-sans);font-size:14px;color:var(--ink-72)}
    .demo-title{font-size:23px;letter-spacing:-.015em}
    .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:28px;margin-top:26px}
    .stat-label{font-family:var(--font-sans);font-size:13px;letter-spacing:.06em;color:var(--ink-62)}
    .stat-value{margin-top:6px;font-family:var(--font-heading);font-size:40px;line-height:1}.stat-value.hl{color:var(--color-accent)}
    .demo-listing{margin-top:36px}
    .table{width:100%;border-collapse:collapse;font-size:16px;margin-top:12px}
    .table td{padding:10px;border-bottom:1px solid color-mix(in srgb,var(--color-text) 8%,transparent)}
    .table tbody tr:hover{background:color-mix(in srgb,var(--color-text) 4%,transparent)}
    .table .ti{font-family:var(--font-heading);font-weight:var(--font-heading-weight)}
    .table .lv{width:88px;font-family:var(--font-sans);font-size:13px}
    .table .st{width:110px;text-align:right;font-family:var(--font-sans);font-size:13px;color:var(--ink-70)}
    .lv-urgent{color:var(--color-accent-2-700)}.lv-major{color:var(--color-accent-700)}.lv-normal{color:var(--ink-65)}
    .trust{padding-top:112px;display:grid;grid-template-columns:minmax(0,1.15fr) repeat(3,minmax(0,1fr));gap:44px 40px;align-items:start}
    .trust-lead{font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:26px;line-height:1.35;letter-spacing:-.02em}
    .trust-k{font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:30px;line-height:1.2;color:var(--color-accent)}
    .trust-d{margin-top:12px;font-size:16px;color:var(--ink-78)}
    .grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:64px 48px;margin-top:80px}
    .grid-5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:48px 32px;margin-top:80px}
    /* 항목 본문 규칙은 :where()로 감싼다 — .num/.kicker/.gain 같은 한 단어짜리 클래스가 그대로 이긴다. */
    :where(.b-item) h3{margin-top:24px;font-size:26px;line-height:1.2;letter-spacing:-.015em}
    :where(.b-item) p{margin-top:14px;font-size:17px;color:var(--ink-78)}
    :where(.s-item) h3{margin-top:18px;font-size:22px;line-height:1.25;letter-spacing:-.015em}
    :where(.s-item) p{margin-top:12px;font-size:16px;color:var(--ink-78)}
    :where(.f-item) h3{margin-top:20px;font-size:23px;line-height:1.25;letter-spacing:-.015em}
    :where(.f-item) p{margin-top:12px;font-size:16px;color:var(--ink-78)}
    .num{margin:0;font-family:var(--font-heading);font-size:44px;line-height:1;color:var(--color-accent)}.f-item .num{font-size:32px}
    .gain{margin-top:22px;font-family:var(--font-sans);font-size:14px;font-weight:500;color:var(--color-accent-700)}
    .feature-h2{max-width:22ch}
    .price{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);gap:56px clamp(40px,6vw,96px);align-items:center}
    .price .kicker{margin-bottom:40px}.price h2{font-size:clamp(30px,3.8vw,48px);line-height:1.16;letter-spacing:-.02em}
    .price-lead{max-width:46ch;margin-top:28px;font-size:17px;color:var(--ink-78)}
    .price-card{background:var(--color-surface);padding:clamp(28px,3.4vw,48px)}.price-card .btn-block{margin-top:36px}
    .price-main{display:flex;align-items:baseline;gap:12px;margin-top:26px}
    .price-amount{font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:clamp(40px,4.4vw,58px);line-height:1;letter-spacing:-.025em}
    .price-unit{font-size:17px;color:var(--ink-70)}.price-setup{margin-top:20px;font-size:16px;color:var(--ink-78)}
    .price-list{display:grid;gap:14px;margin:36px 0 0;padding:0;list-style:none;font-size:16px}
    .price-list li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:10px;align-items:baseline}
    .price-list i{font-style:normal;color:var(--color-accent)}
    .cta h2{max-width:22ch;font-size:clamp(32px,4.4vw,58px);line-height:1.12;letter-spacing:-.02em}
    .cta p{max-width:52ch;margin-top:32px;font-size:19px;color:var(--ink-80)}.cta-act{margin-top:44px}
    .footer{max-width:1240px;margin:0 auto;padding:96px 40px 72px;display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr) minmax(0,auto);gap:36px;align-items:start;font-family:var(--font-sans);font-size:14px;color:var(--ink-70)}
    .footer-brand{display:flex;align-items:center;gap:10px;font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:18px;color:var(--color-text)}
    .footer-mark{width:24px;height:24px;font-size:14px}
    .footer-co{display:flex;flex-wrap:wrap;gap:8px 22px;line-height:1.7}
    .footer-co strong{width:100%;font-family:var(--font-heading);font-size:16px;color:var(--color-text)}
    .footer-legal{text-align:right;white-space:nowrap;line-height:1.7;color:var(--ink-65)}
    @media (prefers-reduced-motion:no-preference){body[data-reveal] .rv{opacity:0;transform:translateY(20px);transition:opacity .85s cubic-bezier(.16,1,.3,1),transform .85s cubic-bezier(.16,1,.3,1)}body[data-reveal] .rv.in{opacity:1;transform:none}}
    @media print{body[data-reveal] .rv{opacity:1!important;transform:none!important}}
    @media(max-width:1080px){.grid-5{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:900px){.nav-link{display:none}.nav{gap:16px}.sec-gap{padding-top:96px}.hero{padding-top:72px}.sec-head{grid-template-columns:minmax(0,1fr);align-items:start;gap:18px}.trust{grid-template-columns:repeat(2,minmax(0,1fr));gap:36px 32px}.trust-lead{grid-column:1/-1}.grid-3{grid-template-columns:repeat(2,minmax(0,1fr));gap:52px 32px}.price{grid-template-columns:minmax(0,1fr);gap:40px}.footer{grid-template-columns:minmax(0,1fr);gap:28px}.footer-legal{text-align:left;white-space:normal}}
    @media(max-width:720px){.demo-body{grid-template-columns:minmax(0,1fr)}.demo-side-t{margin-bottom:12px}.demo-menu{grid-auto-flow:column;grid-auto-columns:max-content;gap:18px}}
    @media(max-width:600px){.sec,.footer{padding-inline:22px}.nav{padding-inline:22px;gap:12px}.nav-sub{display:none}.sec-gap{padding-top:80px}.hero{padding-top:56px;padding-bottom:40px}.hero-cta{align-items:stretch;flex-direction:column;gap:12px}.grid-3,.grid-5{grid-template-columns:minmax(0,1fr);gap:44px}.trust{grid-template-columns:minmax(0,1fr);gap:28px}.stats{gap:16px}.stat-value{font-size:32px}.table{font-size:15px}.table .lv{width:56px}.table .st{width:60px}.footer{padding-top:72px}}
  </style>
</head>
<body>
  <nav class="nav">
    <a class="nav-brand" href="/" aria-label="리포트온 홈"><span class="mark nav-mark">R</span><span>리포트온</span><span class="nav-sub">보고·결재 예약관리</span></a>
    <a class="nav-link" href="#benefit">도입 효과</a>
    <a class="nav-link" href="#flow">업무 흐름</a>
    <a class="nav-link" href="#feature">주요 기능</a>
    <a class="nav-link" href="#price">이용 요금</a>
    <a class="btn btn-primary btn-sm" href="/app">로그인</a>
  </nav>

  <main id="top">
    <section class="sec hero">
      <p class="kicker">지자체 의사결정 업무를 더 빠르게</p>
      <h1>보고 요청부터 일정 확정까지,<br><span>한 흐름으로 연결합니다</span></h1>
      <p class="hero-lead">전화, 메신저, 문서로 흩어진 보고·결재 예약 업무를 하나의 시스템으로 통합하세요. 요청자는 진행 상황을 확인하고, 부서장과 비서실은 필요한 안건에 집중할 수 있습니다.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="/app">업무 시스템 로그인 →</a>
        <a class="btn btn-ghost" href="#benefit">도입 효과 보기</a>
      </div>
      <p class="hero-note">지자체별 독립 운영 · 역할 기반 권한 · 실시간 상태 확인</p>
    </section>

    <section class="sec" aria-label="서비스 화면 예시">
      <div class="demo">
        <div class="demo-bar"><span class="demo-dot"></span><span>보고·결재 예약관리</span><span class="demo-live">실시간 연결</span></div>
        <div class="demo-body">
          <aside class="demo-side">
            <p class="demo-side-t">업무 홈</p>
            <div class="demo-menu"><span>내 요청 현황</span><span>알림 내역</span><span>결정권자 일정</span></div>
          </aside>
          <div>
            <h3 class="demo-title">오늘의 보고 현황</h3>
            <div class="stats">
              <div><p class="stat-label">요청 접수</p><p class="stat-value hl">12</p></div>
              <div><p class="stat-label">비서실 검토</p><p class="stat-value">5</p></div>
              <div><p class="stat-label">예약 확정</p><p class="stat-value">3</p></div>
            </div>
            <p class="kicker demo-listing">보고 요청 목록</p>
            <table class="table">
              <tbody>
                <tr><td class="lv lv-urgent">긴급</td><td class="ti">현안 대응 계획 보고</td><td class="st">검토 중</td></tr>
                <tr><td class="lv lv-major">중요</td><td class="ti">복지사업 추진안 결재</td><td class="st">이관</td></tr>
                <tr><td class="lv lv-normal">일반</td><td class="ti">주간 업무계획 보고</td><td class="st">접수</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="sec trust">
      <p class="trust-lead">행정 업무의 병목을<br>눈에 보이는 흐름으로</p>
      <div><p class="trust-k">한눈에</p><p class="trust-d">안건 상태와 담당자 확인</p></div>
      <div><p class="trust-k">실시간</p><p class="trust-d">상태 변경 및 이메일 알림</p></div>
      <div><p class="trust-k">역할별</p><p class="trust-d">필요한 업무만 정확하게</p></div>
    </section>

    <section class="sec sec-gap" id="benefit">
      <p class="kicker kicker-head">Why Reporton</p>
      <div class="sec-head">
        <h2 class="h2">지자체가 얻는<br>변화는 분명합니다</h2>
        <p>새로운 절차를 더하는 시스템이 아니라, 이미 하고 있는 보고·결재 업무의 대기와 확인 비용을 줄이는 시스템입니다.</p>
      </div>
      <div class="grid-3">
        <article class="b-item">
          <p class="num">01</p>
          <h3>보고 대기시간 단축</h3>
          <p>결정권자의 보고 가능 시간과 요청 우선순위를 한곳에서 조정해 불필요한 전화 확인과 문 앞 대기를 줄입니다.</p>
          <p class="gain">→ 담당자는 본연의 행정 업무에 집중</p>
        </article>
        <article class="b-item">
          <p class="num">02</p>
          <h3>누락 없는 책임 행정</h3>
          <p>누가 요청했고 어디까지 검토됐는지 상태와 이력을 남겨 구두 전달 과정에서 생기는 누락과 책임 공백을 예방합니다.</p>
          <p class="gain">→ 요청·검토·이관 과정의 투명성 향상</p>
        </article>
        <article class="b-item">
          <p class="num">03</p>
          <h3>긴급 현안의 빠른 판단</h3>
          <p>일반·중요·긴급·즉시 안건을 구분하고 긴급 안건을 대기열에 반영해 우선 대응이 필요한 사안을 놓치지 않습니다.</p>
          <p class="gain">→ 재난·민원·현안 대응 속도 향상</p>
        </article>
      </div>
    </section>

    <section class="sec sec-gap" id="flow">
      <p class="kicker kicker-head">Connected Workflow</p>
      <div class="sec-head">
        <h2 class="h2">요청부터 결정까지<br>끊김 없이</h2>
        <p>조직의 기존 결재선을 반영한 역할별 업무 화면으로 각 담당자가 다음 할 일을 명확하게 확인합니다.</p>
      </div>
      <div class="grid-5">
        <article class="s-item"><p class="kicker">01 요청자</p><h3>안건 등록</h3><p>긴급도, 보고 대상, 희망 시간과 자료를 등록합니다.</p></article>
        <article class="s-item"><p class="kicker">02 부서장</p><h3>내용 검토</h3><p>안건을 확인해 상신하거나 사유와 함께 반려합니다.</p></article>
        <article class="s-item"><p class="kicker">03 비서실</p><h3>대기열 배정</h3><p>우선순위와 결정권자 일정을 고려해 순서를 조정합니다.</p></article>
        <article class="s-item"><p class="kicker">04 결정권자</p><h3>보고·결재</h3><p>정리된 안건과 첨부자료를 바탕으로 판단합니다.</p></article>
        <article class="s-item"><p class="kicker">05 전체</p><h3>결과 공유</h3><p>변경 상태와 결과를 실시간 화면과 이메일로 확인합니다.</p></article>
      </div>
    </section>

    <section class="sec sec-gap" id="feature">
      <p class="kicker kicker-head">Core Features</p>
      <h2 class="h2 feature-h2">행정 조직을 고려한 핵심 기능</h2>
      <div class="grid-3">
        <article class="f-item"><p class="num">01</p><h3>결정권자 24시간 일정관리</h3><p>10분·30분 간격으로 보고 가능 시간을 지정하고 마우스로 일정 범위를 조정합니다.</p></article>
        <article class="f-item"><p class="num">02</p><h3>우선순위 기반 통합 대기열</h3><p>긴급도와 검토 상태에 따라 요청을 분류하고 비서실에서 보고 순서를 관리합니다.</p></article>
        <article class="f-item"><p class="num">03</p><h3>실시간 현황과 알림</h3><p>요청 상태가 바뀌면 화면의 현황이 연결되고 담당자 이메일로 변경 사실을 안내합니다.</p></article>
        <article class="f-item"><p class="num">04</p><h3>지자체 조직·역할별 권한</h3><p>요청자, 부서장, 국장, 비서실, 일정관리자, 의사결정권자별 화면과 권한을 제공합니다.</p></article>
        <article class="f-item"><p class="num">05</p><h3>검토·반려 이력 관리</h3><p>확인 전 수정, 검토 후 잠금, 반려사유 전달 등 실제 행정 검토 절차를 반영합니다.</p></article>
        <article class="f-item"><p class="num">06</p><h3>첨부자료 통합 관리</h3><p>한글·MS Office·PDF 자료를 요청과 함께 관리하고 권한이 있는 사용자가 내려받습니다.</p></article>
      </div>
    </section>

    <section class="sec sec-gap price" id="price">
      <div>
        <p class="kicker">Simple Pricing</p>
        <h2>작은 비용으로 시작하는<br>지자체 업무 혁신</h2>
        <p class="price-lead">별도 대규모 시스템 구축 부담 없이 필요한 기능부터 빠르게 도입하세요. 지자체 조직과 기본코드 설정을 지원합니다.</p>
      </div>
      <article class="price-card">
        <p class="kicker">지자체 단위 이용 요금</p>
        <div class="price-main"><span class="price-amount">월 30,000원</span><span class="price-unit">/ 지자체</span></div>
        <p class="price-setup">초기 설치비 500,000원</p>
        <ul class="price-list">
          <li><i aria-hidden="true">✓</i><span>역할별 사용자 및 권한 관리</span></li>
          <li><i aria-hidden="true">✓</i><span>보고·결재 요청과 검토 흐름</span></li>
          <li><i aria-hidden="true">✓</i><span>비서실 대기열 및 결정권자 일정</span></li>
          <li><i aria-hidden="true">✓</i><span>실시간 현황과 이메일 알림</span></li>
        </ul>
        <a class="btn btn-primary btn-block" href="/app">로그인하여 시작하기</a>
      </article>
    </section>

    <section class="sec sec-gap cta">
      <h2>더 빠른 보고, 더 명확한 의사결정</h2>
      <p>흩어진 보고 예약 업무를 하나의 행정 흐름으로 연결해 보세요.</p>
      <div class="cta-act"><a class="btn btn-primary" href="/app">리포트온 로그인 →</a></div>
    </section>
  </main>

  <footer class="footer">
    <span class="footer-brand"><span class="mark footer-mark">R</span><span>리포트온</span></span>
    <div class="footer-co">
      <strong>(주)모노라마</strong>
      <span>대표 김창호</span>
      <span>사업자등록번호 277-86-00185</span>
      <span>서울특별시 강남구 영동대로71길 16, 3층 (06187)</span>
      <span>대표전화 <a href="tel:0269254083">02-6925-4083</a></span>
      <span>팩스 0504-255-4082</span>
      <span>이메일 <a href="mailto:kimch@monorama.kr">kimch@monorama.kr</a></span>
    </div>
    <div class="footer-legal">지자체 보고·결재 예약관리 서비스<br>© 2026 MONORAMA Co., Ltd.</div>
  </footer>

  <script>
  // 스크롤 등장 효과: 한 그룹 = 순차로 올라오는 한 덩어리. 3열 이상 그리드는 칸별로 stagger.
  (function () {
    if (!window.IntersectionObserver) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var step = 80;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    var groups = [];
    document.querySelectorAll('main > section, footer').forEach(function (block) {
      var children = Array.prototype.slice.call(block.children);
      var grids = children.filter(function (el) {
        return getComputedStyle(el).display === 'grid' && el.children.length >= 3;
      });
      if (!grids.length) { groups.push([block]); return; }
      var pre = children.filter(function (el) { return grids.indexOf(el) < 0; });
      if (pre.length) groups.push(pre);
      grids.forEach(function (grid) { groups.push(Array.prototype.slice.call(grid.children)); });
    });

    document.body.setAttribute('data-reveal', '');
    groups.forEach(function (group) {
      group.forEach(function (el, i) {
        el.classList.add('rv');
        el.style.transitionDelay = Math.min(i, 4) * step + 'ms';
        if (el.getBoundingClientRect().top < innerHeight * 0.92) el.classList.add('in');
        else io.observe(el);
      });
    });
  })();
  </script>
</body>
</html>`;
}
