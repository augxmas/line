// 홈과 인증 화면이 공유하는 디자인 토큰과 기본 스타일.
// Claude Design 의 Broadsheet 디자인 시스템에서 실제로 쓰는 부분만 추려 인라인한다.
// 화면 고유 스타일은 각 화면이 이 뒤에 이어 붙인다 (뒤에 오는 쪽이 캐스케이드에서 이긴다).

/** <head> 에 넣을 웹폰트 링크. */
export const themeFontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Noto+Serif+KR:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">`;

/**
 * 토큰 + 기본 리셋 + 버튼. 모든 화면이 쓴다.
 *
 * 색 역할이 둘로 나뉜다:
 *  - --color-accent (#0088b0) 는 종이 바탕에서 3.65:1 이라 24px 이상 표시용과 로고 마크에만 쓴다.
 *  - --color-accent-700 (#006786, 5.72:1) 은 버튼·링크·작은 글씨 등 실제로 읽는 텍스트에 쓴다.
 */
export const themeCss = `
:root{--color-bg:#f3f2f2;--color-surface:#eae9e9;--color-text:#201e1d;--color-accent:#0088b0;--color-accent-700:#006786;--color-accent-800:#004961;--color-accent-900:#0a303e;--color-accent-2-700:#aa0b56;--color-divider:color-mix(in srgb,#201e1d 16%,transparent);--radius-md:2px;--font-heading:"Source Serif 4","Noto Serif KR",serif;--font-body:"Source Serif 4","Noto Serif KR",serif;--font-sans:Pretendard,"Noto Sans KR","Apple SD Gothic Neo",sans-serif;--font-heading-weight:600}
:root{--ink-80:color-mix(in srgb,var(--color-text) 80%,transparent);--ink-78:color-mix(in srgb,var(--color-text) 78%,transparent);--ink-72:color-mix(in srgb,var(--color-text) 72%,transparent);--ink-70:color-mix(in srgb,var(--color-text) 70%,transparent);--ink-65:color-mix(in srgb,var(--color-text) 65%,transparent);--ink-62:color-mix(in srgb,var(--color-text) 62%,transparent)}
/* scrollbar-gutter: 스크롤바 자리를 항상 비워 둔다. 없으면 내용 길이에 따라 스크롤바가
   생겼다 사라지면서 가운데 정렬된 화면이 가로로 밀린다 (로그인 ↔ 회원가입 전환에서 7px). */
*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth;scrollbar-gutter:stable}
body{margin:0;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body);font-size:17px;line-height:1.78;word-break:keep-all;text-wrap:pretty;-webkit-font-smoothing:antialiased}
h1,h2,h3{margin:0;font-family:var(--font-heading);font-weight:var(--font-heading-weight)}p{margin:0}
a{color:var(--color-accent-700);text-decoration:none;text-underline-offset:3px}a:not(.btn):hover{color:var(--color-accent-800)}
:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}::selection{background:color-mix(in srgb,var(--color-accent) 30%,transparent)}
.kicker{margin:0;font-family:var(--font-sans);font-weight:500;font-size:12.5px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--color-accent-700)}.kicker-head{margin-bottom:44px}
.mark{display:inline-grid;place-items:center;background:var(--color-accent);color:var(--color-bg);font-family:var(--font-heading);font-weight:var(--font-heading-weight)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-family:var(--font-heading);font-weight:var(--font-heading-weight);font-size:17px;line-height:1.2;padding:16px 30px;background:transparent;border:1px solid transparent;border-radius:var(--radius-md)}
.btn-primary{background:var(--color-accent-700);color:var(--color-bg)}.btn-primary:hover{background:var(--color-accent-800);color:var(--color-bg)}.btn-primary:active{background:var(--color-accent-900)}
.btn-ghost{color:var(--color-accent-700);padding:16px 8px}.btn-ghost:hover{background:color-mix(in srgb,var(--color-accent) 10%,transparent)}
.btn-sm{font-size:15px;padding:11px 20px}.btn-block{width:100%}`;

/**
 * 폼 요소. 입력 화면에서만 추가로 붙인다.
 *
 * input/select 는 클래스가 아니라 .field 자손 선택자로 잡는다 — 인증 화면의 검증 스크립트가
 * input.className 에 'valid'/'invalid' 를 통째로 대입해서 기존 클래스를 지우기 때문이다.
 */
export const themeFormCss = `
.field{display:grid;gap:8px;margin-bottom:18px;position:relative}
/* 밑줄형 입력 — 종이 위 서식 용지 느낌. 라벨은 Pretendard, 입력값은 본문 세리프.
   .field 는 position:relative 라서 자동완성 목록이 top:calc(100% - 16px) 로 붙는다
   (칸 높이 = 라벨 + 6 + 입력 + 6 + 안내문 17 이므로, 16px 를 빼면 입력 바로 아래). */
.field{display:grid;gap:6px;position:relative}
.field label{font-family:var(--font-sans);font-size:13px;font-weight:500;letter-spacing:.01em;color:var(--ink-72)}
.field input,.field select{width:100%;font-family:var(--font-body);font-size:17px;color:var(--color-text);background:transparent;border:0;border-bottom:1px solid color-mix(in srgb,var(--color-text) 28%,transparent);border-radius:0;padding:9px 0;outline:0;transition:border-color .15s,box-shadow .15s}
.field select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--color-accent) 50%),linear-gradient(135deg,var(--color-accent) 50%,transparent 50%);background-position:right 7px center,right 1px center;background-size:6px 6px,6px 6px;background-repeat:no-repeat;padding-right:22px}
.field input::placeholder{color:var(--ink-65);opacity:1}
.field input:hover,.field select:hover{border-color:color-mix(in srgb,var(--color-text) 50%,transparent)}
.field input:focus,.field select:focus{border-color:var(--color-accent);box-shadow:0 1px 0 0 var(--color-accent)}
.field input.valid{border-color:var(--color-accent);box-shadow:0 1px 0 0 var(--color-accent)}
.field input.invalid,.field select.invalid{border-color:var(--color-accent-2-700);box-shadow:0 1px 0 0 var(--color-accent-2-700)}
.validation{min-height:17px;font-family:var(--font-sans);font-size:12.5px;line-height:1.45;color:var(--ink-65)}
.validation.bad{color:var(--color-accent-2-700)}.validation.good{color:var(--color-accent-700)}
.hint{font-family:var(--font-sans);font-size:12.5px;color:var(--ink-65)}
.error,.client-error{padding:12px 0 12px 14px;border-left:3px solid var(--color-accent-2-700);font-family:var(--font-sans);font-size:13.5px;line-height:1.6;color:var(--color-accent-2-700)}`;
