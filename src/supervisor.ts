import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import type { Pool, PoolConnection } from 'mysql2/promise';

type DistrictRow = {
  seq: number;
  metropolitan_city: string;
  upper_city: string;
  district_name: string;
  district_type: string;
  full_name: string;
};

type BasicSettingRow = {
  district_seq: number;
  district_unique_number: string | null;
  district_unique_number_copy: string | null;
  bank_name: string | null;
  account_number: string | null;
  contract_date: string | null;
  contract_from: string | null;
  contract_to: string | null;
  contract_status: string;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  manager_mobile: string | null;
  subscription_status: string | null;
  billing_cycle: string | null;
  image_path: string | null;
  updated_at: string;
};

type SupervisorSettingResponse = {
  districtSeq: number;
  districtUniqueNumber: string | null;
  districtUniqueNumberCopy: string | null;
  bankName: string | null;
  accountNumber: string | null;
  contractDate: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  contractStatus: string;
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  managerMobile: string | null;
  subscriptionStatus: string | null;
  billingCycle: string | null;
  imagePath: string | null;
  updatedAt: string;
};

type FieldRole = 'required' | 'optional';

type SupervisorFieldConfig = {
  fieldKey: string;
  displayName: string;
  role: FieldRole;
  sortOrder: number;
  isEnabled: boolean;
  isSearchable: boolean;
  gridVisible?: boolean;
  gridFrozen?: boolean;
  gridAlignment?: 'left' | 'center' | 'right';
};

type SupervisorSettingsGridRow = {
  districtSeq: number;
  districtName: string;
  districtUniqueNumber: string | null;
  districtUniqueNumberCopy: string | null;
  bankName: string | null;
  accountNumber: string | null;
  contractDate: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  contractStatus: string;
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  managerMobile: string | null;
  subscriptionStatus: string | null;
  billingCycle: string | null;
  imagePath: string | null;
  updatedAt: string | null;
};

const AUTH_COOKIE_NAME = 'supervisor_auth';
const AUTH_TTL_MS = 8 * 60 * 60 * 1000;
const BANKS = [
  'KB국민은행',
  '신한은행',
  '우리은행',
  '하나은행',
  'NH농협은행',
  'IBK기업은행',
  'SC제일은행',
  'iM뱅크',
  'BNK부산은행',
  'BNK경남은행',
  '광주은행',
  '전북은행',
  '제주은행',
  '카카오뱅크',
  '케이뱅크',
  '토스뱅크',
];
const SUBSCRIPTION_STATUSES = ['구독중', '구독중지'] as const;
const BILLING_CYCLES = ['월', '년'] as const;
const CONTRACT_STATUSES = ['계약', '미계약'] as const;
const FIELD_KEYS = [
  'districtName',
  'districtUniqueNumber',
  'districtUniqueNumberCopy',
  'bankName',
  'accountNumber',
  'contractDate',
  'contractFrom',
  'contractTo',
  'contractStatus',
  'managerName',
  'managerEmail',
  'managerPhone',
  'managerMobile',
  'subscriptionStatus',
  'billingCycle',
  'imagePath',
] as const;

const DEFAULT_FIELD_CONFIGS: Array<SupervisorFieldConfig> = [
  { fieldKey: 'districtName', displayName: '지자체명', role: 'required', sortOrder: 1, isEnabled: true, isSearchable: false },
  { fieldKey: 'districtUniqueNumber', displayName: '지자체의 고유번호', role: 'required', sortOrder: 2, isEnabled: true, isSearchable: false },
  { fieldKey: 'districtUniqueNumberCopy', displayName: '고유번호사본', role: 'optional', sortOrder: 3, isEnabled: true, isSearchable: false },
  { fieldKey: 'bankName', displayName: '은행', role: 'required', sortOrder: 4, isEnabled: true, isSearchable: false },
  { fieldKey: 'accountNumber', displayName: '계좌번호', role: 'required', sortOrder: 5, isEnabled: true, isSearchable: false },
  { fieldKey: 'contractDate', displayName: '계약일', role: 'required', sortOrder: 6, isEnabled: true, isSearchable: false },
  { fieldKey: 'contractFrom', displayName: '계약기간 From', role: 'optional', sortOrder: 7, isEnabled: true, isSearchable: false },
  { fieldKey: 'contractTo', displayName: '계약기간 To', role: 'optional', sortOrder: 8, isEnabled: true, isSearchable: false },
  { fieldKey: 'contractStatus', displayName: '계약상태', role: 'required', sortOrder: 9, isEnabled: true, isSearchable: false },
  { fieldKey: 'managerName', displayName: '담당자명', role: 'optional', sortOrder: 10, isEnabled: true, isSearchable: false },
  { fieldKey: 'managerEmail', displayName: '담당자이메일', role: 'optional', sortOrder: 11, isEnabled: true, isSearchable: false },
  { fieldKey: 'managerPhone', displayName: '담당자연락처', role: 'optional', sortOrder: 12, isEnabled: true, isSearchable: false },
  { fieldKey: 'managerMobile', displayName: '담당자모바일폰', role: 'optional', sortOrder: 13, isEnabled: true, isSearchable: false },
  { fieldKey: 'subscriptionStatus', displayName: '구독상태', role: 'required', sortOrder: 14, isEnabled: true, isSearchable: false },
  { fieldKey: 'billingCycle', displayName: '구독료청구방식', role: 'required', sortOrder: 15, isEnabled: true, isSearchable: false },
  { fieldKey: 'imagePath', displayName: '이미지', role: 'optional', sortOrder: 16, isEnabled: true, isSearchable: false },
];

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string | number | null | undefined): string {
  return escapeHtml(String(value ?? ''));
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      return cookies;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function createAuthToken(username: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, expiresAt: Date.now() + AUTH_TTL_MS }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function verifyAuthToken(token: string, expectedUsername: string, secret: string): boolean {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      username?: string;
      expiresAt?: number;
    };

    return decoded.username === expectedUsername && typeof decoded.expiresAt === 'number' && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function getSupervisorAuth(req: Request): boolean {
  const supervisorUsername = requiredEnv('SUPERVISOR_USERNAME', 'supervisor');
  const supervisorPassword = requiredEnv('SUPERVISOR_PASSWORD');
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[AUTH_COOKIE_NAME];

  if (!token) {
    return false;
  }

  return verifyAuthToken(token, supervisorUsername, supervisorPassword);
}

function setSupervisorCookie(res: Response, username: string): void {
  const supervisorPassword = requiredEnv('SUPERVISOR_PASSWORD');
  const token = createAuthToken(username, supervisorPassword);
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: AUTH_TTL_MS,
    path: '/supervisor',
  });
}

function clearSupervisorCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/supervisor' });
}

function ensureDigitsOnly(value: string, fieldName: string): string {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${fieldName}은 숫자만 입력할 수 있습니다.`);
  }

  return value;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isWholeYearPeriod(from: string, to: string): boolean {
  if (!isValidDate(from) || !isValidDate(to)) return false;
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const years = toYear - fromYear;
  if (years < 1) return false;
  const expected = new Date(`${from}T00:00:00Z`);
  expected.setUTCFullYear(fromYear + years);
  return expected.toISOString().slice(0, 10) === to;
}

function isFieldRole(value: string): value is FieldRole {
  return value === 'required' || value === 'optional';
}

function toRoleKorean(value: FieldRole): string {
  if (value === 'required') {
    return '필수';
  }

  return '선택';
}

function normalizeFieldConfigs(input: unknown): SupervisorFieldConfig[] {
  if (!Array.isArray(input)) {
    throw new Error('관리항목 데이터 형식이 올바르지 않습니다.');
  }

  const normalized = input.map((item, index) => {
    const candidate = item as Partial<SupervisorFieldConfig>;
    const fieldKey = String(candidate.fieldKey ?? '').trim();
    const displayName = String(candidate.displayName ?? '').trim();
    const role = String(candidate.role ?? '').trim();
    const sortOrder = index + 1;
    const isEnabled = candidate.isEnabled === true;
    const isSearchable = candidate.isSearchable === true;
    const gridVisible = candidate.gridVisible !== false;
    const gridFrozen = candidate.gridFrozen === true;
    const gridAlignment = ['left', 'center', 'right'].includes(String(candidate.gridAlignment))
      ? candidate.gridAlignment as 'left' | 'center' | 'right'
      : 'left';

    if (!FIELD_KEYS.includes(fieldKey as (typeof FIELD_KEYS)[number])) {
      throw new Error(`지원하지 않는 관리항목입니다: ${fieldKey}`);
    }

    if (!displayName) {
      throw new Error(`표시명은 비워둘 수 없습니다: ${fieldKey}`);
    }

    if (!isFieldRole(role)) {
      throw new Error(`역할 값이 올바르지 않습니다: ${fieldKey}`);
    }

    return {
      fieldKey,
      displayName,
      role,
      sortOrder,
      isEnabled,
      isSearchable,
      gridVisible,
      gridFrozen,
      gridAlignment,
    };
  });

  for (const key of FIELD_KEYS) {
    if (!normalized.some((item) => item.fieldKey === key)) {
      throw new Error(`관리항목이 누락되었습니다: ${key}`);
    }
  }

  if (normalized.filter((item) => item.gridFrozen).length > 1) {
    throw new Error('틀고정 컬럼은 하나만 선택할 수 있습니다.');
  }

  return normalized;
}

function fieldRoleMap(configs: SupervisorFieldConfig[]): Map<string, FieldRole> {
  const roleMap = new Map<string, FieldRole>();
  for (const config of configs) {
    if (config.isEnabled) {
      roleMap.set(config.fieldKey, config.role);
    }
  }
  return roleMap;
}

function createUploadMiddleware(uploadDir: string) {
  fs.mkdirSync(uploadDir, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => callback(null, uploadDir),
      filename: (_request, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase() || '.jpg';
        callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
      },
    }),
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (_request, file, callback) => {
      const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new Error('이미지는 jpg, png, webp, gif 파일만 업로드할 수 있습니다.'));
        return;
      }

      callback(null, true);
    },
  });
}

function renderLoginPage(errorMessage?: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Supervisor Login</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      height: 100vh;
      overflow: hidden;
      font-family: Inter, Pretendard, 'Apple SD Gothic Neo', sans-serif;
      background: #ffffff;
      color: #111111;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .panel {
      width: min(440px, 100%);
      background: #ffffff;
      border: 1px solid #e8e8e8;
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
    }
    h1 { margin: 0; font-size: 2rem; letter-spacing: -0.03em; }
    .label-area {
      display: inline-flex;
      align-items: center;
      margin-bottom: 14px;
      border-radius: 12px;
      background: #000000;
      color: #ffffff;
      padding: 8px 12px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    p { margin: 0 0 24px; color: #555555; line-height: 1.55; }
    label { display: block; margin-bottom: 8px; color: #1f1f1f; font-size: 0.95rem; }
    input[type='text'], input[type='password'] {
      width: 100%;
      border: 1px solid #d9d9d9;
      background: #ffffff;
      color: #111111;
      border-radius: 14px;
      padding: 14px 16px;
      font-size: 1rem;
      outline: none;
    }
    input:focus { border-color: #111111; box-shadow: 0 0 0 3px rgba(17, 17, 17, 0.12); }
    .field + .field { margin-top: 18px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; }
    .remember { display: flex; align-items: center; gap: 10px; font-size: 0.95rem; color: #2d2d2d; }
    button {
      border: 0;
      border-radius: 14px;
      padding: 14px 18px;
      background: #111111;
      color: #ffffff;
      font-weight: 700;
      cursor: pointer;
      min-width: 120px;
    }
    .error {
      margin-bottom: 18px;
      border: 1px solid #f0b7b7;
      background: #fff2f2;
      color: #7f1d1d;
      padding: 12px 14px;
      border-radius: 14px;
    }
    .hint { margin-top: 16px; font-size: 0.88rem; color: #7a7a7a; }
  </style>
</head>
<body>
  <main class="panel">
    <div class="label-area">최고관리자</div>
    <h1>로그인</h1>
    <p>지자체 기본사항을 관리하려면 로그인하세요.</p>
    ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
    <form method="post" action="/supervisor/login" id="loginForm">
      <div class="field">
        <label for="username">아이디</label>
        <input id="username" name="username" type="text" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="password">비밀번호</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
      </div>
      <div class="row">
        <label class="remember">
          <input id="rememberUsername" name="rememberUsername" type="checkbox" />
          아이디 저장
        </label>
        <button type="submit">로그인</button>
      </div>
    </form>
    <div class="hint">기본 색상은 black 테마로 구성되어 있습니다.</div>
  </main>
  <script>
    const usernameInput = document.getElementById('username');
    const rememberInput = document.getElementById('rememberUsername');
    const loginForm = document.getElementById('loginForm');
    const savedUsername = localStorage.getItem('supervisor_username');

    if (savedUsername) {
      usernameInput.value = savedUsername;
      rememberInput.checked = true;
    }

    loginForm.addEventListener('submit', () => {
      if (rememberInput.checked) {
        localStorage.setItem('supervisor_username', usernameInput.value);
      } else {
        localStorage.removeItem('supervisor_username');
      }
    });
  </script>
</body>
</html>`;
}

function renderDashboardPage(params: {
  districts: DistrictRow[];
  selectedDistrict: DistrictRow;
  setting: SupervisorSettingResponse | null;
  settingsGridRows: SupervisorSettingsGridRow[];
  fieldConfigs: SupervisorFieldConfig[];
  supervisorUsername: string;
}): string {
  const fieldConfigMap = new Map(params.fieldConfigs.map((config) => [config.fieldKey, config]));
  const labelFor = (fieldKey: string, fallback: string): string => {
    const item = fieldConfigMap.get(fieldKey);
    return item?.displayName ?? fallback;
  };
  const roleFor = (fieldKey: string): FieldRole => {
    return fieldConfigMap.get(fieldKey)?.role ?? 'optional';
  };

  const roleChip = (fieldKey: string): string => {
    return `<span class="role-chip" id="roleChip-${fieldKey}">${toRoleKorean(roleFor(fieldKey))}</span>`;
  };

  const districtOptions = params.districts
    .map((district) => {
      const selected = district.seq === params.selectedDistrict.seq ? 'selected' : '';
      return `<option value="${district.seq}" ${selected}>${escapeHtml(district.full_name)}</option>`;
    })
    .join('');

  const bankOptions = BANKS
    .map((bank) => {
      const selected = params.setting?.bankName === bank ? 'selected' : '';
      return `<option value="${escapeHtml(bank)}" ${selected}>${escapeHtml(bank)}</option>`;
    })
    .join('');

  const statusOptions = SUBSCRIPTION_STATUSES
    .map((status) => {
      const selected = params.setting?.subscriptionStatus === status ? 'selected' : '';
      return `<option value="${escapeHtml(status)}" ${selected}>${escapeHtml(status)}</option>`;
    })
    .join('');

  const billingOptions = BILLING_CYCLES
    .map((billingCycle) => {
      const selected = params.setting?.billingCycle === billingCycle ? 'selected' : '';
      return `<option value="${escapeHtml(billingCycle)}" ${selected}>${escapeHtml(billingCycle)}</option>`;
    })
    .join('');

  const imagePreview = params.setting?.imagePath
    ? `<img id="imagePreview" src="${escapeAttribute(params.setting.imagePath)}" alt="업로드 이미지" />`
    : `<div id="imagePreviewEmpty">이미지를 드래그하거나 클릭해서 업로드하세요.</div>`;

  const fieldConfigRows = params.fieldConfigs
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((config) => {
      return `
        <tr data-field-key="${escapeAttribute(config.fieldKey)}">
          <td>${escapeHtml(config.fieldKey)}</td>
          <td><input class="field-config-name" type="text" value="${escapeAttribute(config.displayName)}" /></td>
          <td><input class="field-config-enabled" type="checkbox" ${config.isEnabled ? 'checked' : ''} aria-label="${escapeAttribute(config.displayName)} 적용" /></td>
          <td>
            <div class="role-checkboxes">
              <label><input class="field-config-role" type="checkbox" value="required" ${config.role === 'required' ? 'checked' : ''} /> 필수</label>
              <label><input class="field-config-role" type="checkbox" value="optional" ${config.role === 'optional' ? 'checked' : ''} /> 선택</label>
            </div>
          </td>
          <td><input class="field-config-searchable" type="checkbox" ${config.isSearchable ? 'checked' : ''} aria-label="${escapeAttribute(config.displayName)} 조회조건 적용" /></td>
        </tr>
      `;
    })
    .join('');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Supervisor Console</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #eef3f9;
      --panel: #ffffff;
      --panel-2: #f5f8fd;
      --line: #d8e1ef;
      --text: #1e2a3a;
      --muted: #6a7b93;
      --accent: #2f66e0;
      --good: #0a7f3f;
      --bad: #bf1f1f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Noto Sans KR', Pretendard, 'Apple SD Gothic Neo', sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .shell {
      max-width: 1760px;
      height: 100vh;
      margin: 0 auto;
      padding: 14px 16px 24px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 12px;
      padding: 10px 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #ffffff;
    }
    .title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.3rem, 2vw, 1.75rem);
      letter-spacing: -0.02em;
      color: #1a2f55;
    }
    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 0 0 auto;
    }
    .logout {
      border: 1px solid #2f66e0;
      background: var(--accent);
      color: #ffffff;
      border-radius: 10px;
      padding: 8px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .view-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      align-items: end;
      gap: 12px;
      margin-bottom: 12px;
    }
    .view-buttons {
      display: flex;
      gap: 8px;
      flex: 0 0 auto;
      grid-column: 2;
      grid-row: 1;
      align-self: end;
    }
    .grid-toolbar-left { display: contents; }
    .grid-summary {
      margin-top: 8px;
      color: #172b4d;
      font-size: 0.96rem;
      font-weight: 800;
      grid-column: 1 / -1;
      grid-row: 2;
    }
    .panel-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }
    .panel-heading .card-title { margin: 0; }
    .tab {
      appearance: none;
      border: 0;
      border-bottom: 3px solid transparent;
      background: transparent;
      flex: 0 0 auto;
      color: #66758b;
      border-radius: 0;
      padding: 13px 20px 11px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
    }
    .tab:hover { color: var(--accent); background: #f6f8fb; }
    .tab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .tab.active {
      background: transparent;
      color: var(--accent);
      border-bottom-color: var(--accent);
      box-shadow: none;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(320px, 1fr) 1.2fr;
      gap: 18px;
    }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    #tab-basic.active {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
      flex-direction: column;
    }
    #tab-codes.active { display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; }
    #tab-codes > .card.full-span { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; }
    #tab-codes .code-sticky-head {
      position: relative;
      flex: 0 0 auto;
      z-index: 24;
      margin: -16px -16px 14px;
      padding: 16px 16px 0;
      background: #ffffff;
      border-bottom: 1px solid var(--line);
      box-shadow: 0 5px 12px rgba(27, 53, 89, 0.08);
    }
    .code-district-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: nowrap; }
    .code-district-toolbar > label { flex: 0 0 auto; font-weight: 800; white-space: nowrap; }
    .code-district-search { position: relative; flex: 0 0 min(420px, 42vw); }
    .code-district-results { display: none; position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #fff; border: 1px solid var(--line); border-radius: 9px; box-shadow: 0 12px 28px rgba(22,43,70,.16); }
    .code-district-results.open { display: block; }
    .code-district-results button { display: block; width: 100%; border: 0; border-bottom: 1px solid #edf1f5; border-radius: 0; padding: 10px 12px; background: #fff; color: var(--text); text-align: left; cursor: pointer; }
    .code-district-results button:hover { background: #eef4fb; color: var(--accent); }
    .code-district-empty { padding: 11px 12px; color: var(--muted); font-size: .85rem; }
    .code-district-toolbar .helper { flex: 1 1 auto; margin: 0; white-space: nowrap; }
    .code-subtabs { display: flex; gap: 0; margin-top: 16px; border-bottom: 1px solid var(--line); }
    .code-subtab { appearance: none; border: 0; border-bottom: 3px solid transparent; border-radius: 0; padding: 11px 22px; background: transparent; color: #66758b; font-weight: 800; cursor: pointer; }
    .code-subtab:hover { color: var(--accent); background: #f6f8fb; }
    .code-subtab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .code-subpanel { display: none; margin-top: 14px; }
    .code-subpanel.active { display: flex; flex: 1 1 auto; min-height: 0; }
    .code-subpanel > .card { display: flex; flex: 1 1 auto; min-height: 0; max-width: none; flex-direction: column; }
    .code-subpanel > .card > .card-title,
    .code-subpanel > .card > .code-form { flex: 0 0 auto; }
    .code-subpanel > .card > .grid-table-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; }
    .code-subpanel input:not([type="hidden"]),
    .code-subpanel select {
      width: 100%;
      height: 46px;
      min-height: 46px;
      padding: 10px 13px;
      font-size: 0.95rem;
      line-height: 1.4;
      border-radius: 9px;
    }
    .code-subpanel .code-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      gap: 7px 14px;
      align-items: end;
      margin-bottom: 12px;
    }
    .code-subpanel .code-form > .field,
    .code-subpanel .code-form > .field-grid { grid-column: 1; grid-row: 1; margin: 0; }
    .code-subpanel .code-form > .actions { grid-column: 2; grid-row: 1; align-self: end; flex-direction: row; align-items: center; margin: 0; }
    .code-subpanel .code-form > .actions button { height: 46px; min-width: 92px; }
    .code-subpanel .code-form > .helper { grid-column: 1 / -1; grid-row: 2; margin: 0; }
    @media (max-width: 760px) {
      .code-subpanel .code-form { grid-template-columns: 1fr; }
      .code-subpanel .code-form > .actions { grid-column: 1; grid-row: 2; justify-content: flex-end; }
      .code-subpanel .code-form > .helper { grid-row: 3; }
    }
    @media (max-width: 900px) { .code-district-toolbar { flex-wrap: wrap; }.code-district-search { flex: 1 1 320px; }.code-district-toolbar .helper { flex-basis: 100%; white-space: normal; } }
    #tab-basic > .grid {
      flex: 1 1 auto;
      min-height: 0;
      grid-template-rows: minmax(0, 1fr);
    }
    #tab-basic .card.full-span {
      min-height: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    #tab-basic .card.full-span > .grid-table-wrap {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 6px 18px rgba(27, 53, 89, 0.07);
    }
    .card.full-span { grid-column: 1 / -1; }
    .card-title {
      margin: 0 0 14px;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
      color: #ffffff;
      background: #000000;
      border-radius: 8px;
      padding: 9px 12px;
    }
    .selected-district {
      padding: 16px;
      border-radius: 18px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      margin-bottom: 16px;
    }
    .selected-district strong {
      display: block;
      margin-bottom: 6px;
      font-size: 1.02rem;
    }
    .selected-district span { color: var(--muted); }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .field { display: flex; flex-direction: column; gap: 8px; }
    .field[hidden] { display: none; }
    .field.full { grid-column: 1 / -1; }
    label { color: #222222; font-size: 0.95rem; }
    select, input[type='text'], input[type='date'], input[type='email'], input[type='tel'] {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #ffffff;
      color: #111111;
      padding: 10px 12px;
      font-size: 0.94rem;
      outline: none;
    }
    select:focus, input:focus {
      border-color: #2f66e0;
      box-shadow: 0 0 0 3px rgba(47, 102, 224, 0.12);
    }
    .dropzone {
      border: 1.5px dashed #c9c9c9;
      border-radius: 20px;
      background: #ffffff;
      min-height: 240px;
      display: grid;
      place-items: center;
      padding: 18px;
      cursor: pointer;
      transition: 0.2s ease;
      overflow: hidden;
    }
    .dropzone.dragging { border-color: #2f66e0; background: #f0f5ff; }
    .dropzone img {
      width: 100%;
      height: 100%;
      max-height: 240px;
      object-fit: cover;
      border-radius: 16px;
    }
    .dropzone .empty { color: var(--muted); text-align: center; line-height: 1.6; }
    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-top: 16px;
    }
    .save {
      border: 0;
      background: var(--accent);
      color: #ffffff;
      border-radius: 10px;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
      min-width: 140px;
    }
    .save:disabled { opacity: 0.6; cursor: not-allowed; }
    .message {
      min-height: 24px;
      color: var(--muted);
      font-size: 0.95rem;
    }
    .message.good { color: var(--good); }
    .message.bad { color: var(--bad); }
    .helper {
      margin-top: 10px;
      color: var(--muted);
      font-size: 0.9rem;
    }
    .role-chip {
      margin-left: 8px;
      font-size: 0.72rem;
      font-weight: 700;
      border-radius: 999px;
      padding: 3px 8px;
      background: #f1f1f1;
      color: #222;
      vertical-align: middle;
    }
    .search-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 0;
      align-items: flex-end;
      flex: 1 1 auto;
    }
    .search-controls .field {
      min-width: 180px;
      flex: 1;
    }
    .mini-button {
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #fff;
      color: #29466e;
      cursor: pointer;
      padding: 9px 12px;
      font-weight: 700;
    }
    .mini-button.primary {
      background: #000;
      color: #fff;
      border-color: #000;
    }
    .grid-table-wrap {
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: auto;
      background: #fff;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
      font-size: 0.92rem;
    }
    th, td {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 1px solid #efefef;
      vertical-align: middle;
    }
    th {
      background: #f6f9ff;
      color: #274778;
      position: sticky;
      top: 0;
      z-index: 1;
      border-bottom: 2px solid #d9e5fb;
    }
    tr:hover td {
      background: #f8fbff;
    }
    .columns-compact th, .columns-compact td { padding: 7px 8px; white-space: nowrap; }
    .align-left { text-align: left; }
    .align-center { text-align: center; }
    .align-right { text-align: right; }
    .grid-frozen { position: sticky; left: 0; z-index: 2; background: #fff; box-shadow: 2px 0 0 #d8e1ef; }
    th.grid-frozen { z-index: 5; background: #f6f9ff; }
    .pick-row {
      padding: 7px 10px;
      border-radius: 9px;
      border: 1px solid #7ea2ef;
      background: #fff;
      color: #2b5fd1;
      cursor: pointer;
      font-weight: 700;
    }
    .field-config-table {
      min-width: 680px;
    }
    .field-config-name {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px;
      font-size: 0.9rem;
      background: #fff;
      color: #111;
    }
    .role-checkboxes { display: flex; align-items: center; gap: 14px; white-space: nowrap; }
    .role-checkboxes label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
    .role-checkboxes .field-config-role { width: auto; padding: 0; }
    .main-tabs {
      display: flex;
      flex: 0 0 auto;
      gap: 4px;
      margin: 0 0 10px;
      padding: 0 12px;
      background: #fff;
      border-bottom: 1px solid var(--line);
    }
    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(15, 29, 50, 0.48);
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      width: min(980px, 100%);
      max-height: calc(100vh - 48px);
      height: min(720px, calc(100vh - 48px));
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
    }
    .modal-header {
      position: relative;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 6px 64px;
      background: #000;
      color: #fff;
    }
    .modal-header .card-title {
      margin: 0;
      padding: 0;
      background: transparent;
      color: #fff;
      text-align: center;
    }
    .modal-body {
      min-height: 0;
      flex: 1 1 auto;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      padding: 8px;
    }
    .modal-body > .grid-table-wrap {
      min-height: 0;
      flex: 1 1 auto;
      overflow: auto;
    }
    .modal-body > .grid-table-wrap th { top: 0; z-index: 3; }
    #editSettingModal .modal-body { display: block; overflow-y: auto; padding: 12px; }
    .modal-footer {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 6px 12px;
      border-top: 1px solid var(--line);
      background: #fff;
    }
    .modal-footer .save { background: #000; }
    .modal-footer .message { min-height: 18px; }
    #fieldConfigModal th, #fieldConfigModal td { padding: 6px 9px; }
    #fieldConfigModal .field-config-name { padding: 6px 8px; }
    #fieldConfigModal .save { padding: 8px 14px; }
    .column-order-table { min-width: 720px; }
    .column-order-row { cursor: grab; }
    .column-order-row.dragging { opacity: .45; }
    .drag-handle { color: #66758b; font-size: 1.15rem; user-select: none; }
    .alignment-options { display: flex; gap: 8px; }
    .alignment-options label { position: relative; cursor: pointer; }
    .alignment-options input { position: absolute; opacity: 0; pointer-events: none; }
    .alignment-icon { display: grid; place-items: center; width: 34px; height: 28px; border: 1px solid var(--line); border-radius: 6px; }
    .alignment-options input:checked + .alignment-icon { border-color: #000; background: #eef2f7; box-shadow: 0 0 0 2px #000; }
    .alignment-icon svg { width: 20px; height: 16px; }
    .modal-close {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      border: 1px solid var(--line);
      border-radius: 9px;
      background: #000;
      color: #fff;
      padding: 8px 12px;
      cursor: pointer;
      font-weight: 700;
    }
    @media (max-width: 980px) {
      .grid { grid-template-columns: 1fr; }
      .field-grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column; align-items: stretch; }
      .save { width: 100%; }
      .view-toolbar { grid-template-columns: 1fr; }
      .view-buttons { grid-column: 1; grid-row: 2; justify-content: flex-end; }
      .grid-summary { grid-row: 3; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="title">
        <h1>지자체 구독관리</h1>
      </div>
      <div class="topbar-actions">
        <p class="subtitle">로그인 사용자: ${escapeHtml(params.supervisorUsername)}</p>
        <form method="post" action="/supervisor/logout">
          <button type="submit" class="logout">로그아웃</button>
        </form>
      </div>
    </div>

    <nav class="main-tabs" aria-label="기본 메뉴">
      <button class="tab active" type="button" data-main-tab="basic">기본사항</button>
      <button class="tab" type="button" data-main-tab="codes">기본코드</button>
    </nav>

    <section class="tab-panel active" id="tab-basic">
      <div class="grid">
        <section class="card full-span">
          <div class="view-toolbar">
            <div class="grid-toolbar-left">
              <div class="search-controls" id="searchControls"></div>
              <div class="grid-summary" id="gridSummary" aria-live="polite"></div>
            </div>
            <div class="view-buttons">
              <button class="mini-button" type="button" id="openFieldConfig">관리항목 관리</button>
              <button class="mini-button" type="button" id="adjustColumns">컬럼조정</button>
            </div>
          </div>
          <div class="grid-table-wrap">
            <table aria-label="기본사항 Grid">
              <thead><tr id="settingsGridHead"></tr></thead>
              <tbody id="settingsGridBody"></tbody>
            </table>
          </div>
        </section>

        <div class="modal-overlay" id="editSettingModal" role="dialog" aria-modal="true" aria-labelledby="editSettingTitle">
          <div class="modal-box">
            <div class="modal-header">
              <h2 class="card-title" id="editSettingTitle">기본사항 관리</h2>
              <button class="modal-close" type="button" id="closeEditSetting">닫기</button>
            </div>
            <div class="modal-body">
              <div class="grid">
        <section class="card">
          <div class="field full">
            <label for="basicDistrictSearch">지자체</label>
            <div class="code-district-search" style="flex-basis:auto;width:100%">
              <input id="basicDistrictSearch" type="text" autocomplete="off" placeholder="3글자 이상 입력해 주세요" value="${escapeAttribute(params.selectedDistrict.full_name)}" />
              <div class="code-district-results" id="basicDistrictResults"></div>
            </div>
            <select id="districtSeq" name="districtSeq" hidden aria-hidden="true">${districtOptions}</select>
          </div>
          <div class="selected-district">
            <strong id="selectedDistrictTitle">${escapeHtml(params.selectedDistrict.full_name)}</strong>
            <span id="selectedDistrictMeta">${escapeHtml(`${params.selectedDistrict.metropolitan_city} · ${params.selectedDistrict.district_type}`)}</span>
          </div>
          <div class="helper">Grid에서 선택하거나 이 박스에서 지자체를 선택해 상세 내용을 수정하세요.</div>
        </section>

        <section class="card">
          <form id="basicForm">
            <div class="field-grid">
              <div class="field">
                <label for="districtUniqueNumber">${escapeHtml(labelFor('districtUniqueNumber', '지자체의 고유번호'))}${roleChip('districtUniqueNumber')}</label>
                <input id="districtUniqueNumber" name="districtUniqueNumber" type="text" inputmode="numeric" autocomplete="off" value="${escapeAttribute(params.setting?.districtUniqueNumber)}" />
              </div>
              <div class="field">
                <label for="districtUniqueNumberCopy">${escapeHtml(labelFor('districtUniqueNumberCopy', '고유번호사본'))}${roleChip('districtUniqueNumberCopy')}</label>
                <input id="districtUniqueNumberCopy" name="districtUniqueNumberCopy" type="text" inputmode="numeric" autocomplete="off" value="${escapeAttribute(params.setting?.districtUniqueNumberCopy)}" />
              </div>
              <div class="field">
                <label for="bankName">${escapeHtml(labelFor('bankName', '은행'))}${roleChip('bankName')}</label>
                <select id="bankName" name="bankName">
                  <option value="">선택하세요</option>
                  ${bankOptions}
                </select>
              </div>
              <div class="field">
                <label for="accountNumber">${escapeHtml(labelFor('accountNumber', '계좌번호'))}${roleChip('accountNumber')}</label>
                <input id="accountNumber" name="accountNumber" type="text" inputmode="numeric" autocomplete="off" value="${escapeAttribute(params.setting?.accountNumber)}" />
              </div>
              <div class="field">
                <label for="contractDate">${escapeHtml(labelFor('contractDate', '계약일'))}${roleChip('contractDate')}</label>
                <input id="contractDate" name="contractDate" type="date" value="${escapeAttribute(params.setting?.contractDate)}" />
              </div>
              <div class="field">
                <label for="contractFrom">${escapeHtml(labelFor('contractFrom', '계약기간 From'))}${roleChip('contractFrom')}</label>
                <input id="contractFrom" name="contractFrom" type="date" value="${escapeAttribute(params.setting?.contractFrom)}" />
              </div>
              <div class="field">
                <label for="contractTo">${escapeHtml(labelFor('contractTo', '계약기간 To'))}${roleChip('contractTo')}</label>
                <input id="contractTo" name="contractTo" type="date" value="${escapeAttribute(params.setting?.contractTo)}" />
              </div>
              <div class="field">
                <label for="contractStatus">${escapeHtml(labelFor('contractStatus', '계약상태'))}${roleChip('contractStatus')}</label>
                <select id="contractStatus" name="contractStatus">
                  <option value="계약" ${params.setting?.contractStatus === '계약' ? 'selected' : ''}>계약</option>
                  <option value="미계약" ${params.setting?.contractStatus !== '계약' ? 'selected' : ''}>미계약</option>
                </select>
              </div>
              <div class="field">
                <label for="managerName">${escapeHtml(labelFor('managerName', '담당자명'))}${roleChip('managerName')}</label>
                <input id="managerName" name="managerName" type="text" value="${escapeAttribute(params.setting?.managerName)}" />
              </div>
              <div class="field">
                <label for="managerEmail">${escapeHtml(labelFor('managerEmail', '담당자이메일'))}${roleChip('managerEmail')}</label>
                <input id="managerEmail" name="managerEmail" type="email" value="${escapeAttribute(params.setting?.managerEmail)}" />
              </div>
              <div class="field">
                <label for="managerPhone">${escapeHtml(labelFor('managerPhone', '담당자연락처'))}${roleChip('managerPhone')}</label>
                <input id="managerPhone" name="managerPhone" type="tel" value="${escapeAttribute(params.setting?.managerPhone)}" />
              </div>
              <div class="field">
                <label for="managerMobile">${escapeHtml(labelFor('managerMobile', '담당자모바일폰'))}${roleChip('managerMobile')}</label>
                <input id="managerMobile" name="managerMobile" type="tel" value="${escapeAttribute(params.setting?.managerMobile)}" />
              </div>
              <div class="field">
                <label for="subscriptionStatus">${escapeHtml(labelFor('subscriptionStatus', '구독상태'))}${roleChip('subscriptionStatus')}</label>
                <select id="subscriptionStatus" name="subscriptionStatus">
                  <option value="">선택하세요</option>
                  ${statusOptions}
                </select>
              </div>
              <div class="field">
                <label for="billingCycle">${escapeHtml(labelFor('billingCycle', '구독료청구방식'))}${roleChip('billingCycle')}</label>
                <select id="billingCycle" name="billingCycle">
                  <option value="">선택하세요</option>
                  ${billingOptions}
                </select>
              </div>
              <div class="field full">
                <label>이미지${roleChip('imagePath')}</label>
                <input id="imageFile" name="image" type="file" accept="image/*" hidden />
                <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="이미지 업로드 영역">
                  ${imagePreview}
                </div>
              </div>
            </div>

            <div class="actions">
              <div id="message" class="message"></div>
              <button type="submit" class="save" id="saveButton">저장</button>
            </div>
          </form>
        </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="tab-panel" id="tab-codes">
      <section class="card full-span">
        <div class="code-sticky-head">
        <div class="code-district-toolbar">
          <label for="codeDistrictSearch">지자체</label>
          <div class="code-district-search"><input id="codeDistrictSearch" type="text" autocomplete="off" placeholder="3글자 이상 입력해 주세요" value="${escapeAttribute(params.selectedDistrict.full_name)}"><input id="codeDistrictSeq" type="hidden" value="${params.selectedDistrict.seq}"><div class="code-district-results" id="codeDistrictResults"></div></div>
          <div class="helper">선택한 지자체에서 사용할 부서, 팀, 직위, 직책 기준정보를 관리합니다.</div>
        </div>
        <div id="codeMessage" class="message"></div>
        <nav class="code-subtabs" aria-label="기본코드 구분"><button type="button" class="code-subtab active" data-code-tab="department">부서</button><button type="button" class="code-subtab" data-code-tab="team">팀</button><button type="button" class="code-subtab" data-code-tab="jobPosition">직위</button><button type="button" class="code-subtab" data-code-tab="position">직책</button></nav>
        </div>
        <div class="code-subpanel active" data-code-panel="department"><section class="card"><h2 class="card-title">부서 관리</h2><form class="code-form" data-code-type="department"><input type="hidden" name="id"><div class="field"><label>부서명</label><input name="name" required maxlength="100"></div><div class="helper">코드는 저장 시 자동 생성됩니다.</div><div class="actions"><button class="mini-button code-cancel" type="button">초기화</button><button class="save">저장</button></div></form><div class="grid-table-wrap"><table><thead><tr><th>코드</th><th>부서명</th><th>상태</th><th>관리</th></tr></thead><tbody id="departmentCodeBody"></tbody></table></div></section></div>
        <div class="code-subpanel" data-code-panel="team"><section class="card"><h2 class="card-title">팀 관리</h2><form class="code-form" data-code-type="team"><input type="hidden" name="id"><div class="field-grid"><div class="field"><label>소속 부서</label><select name="departmentId" required></select></div><div class="field"><label>팀명</label><input name="name" required maxlength="100"></div></div><div class="helper">코드는 저장 시 자동 생성됩니다.</div><div class="actions"><button class="mini-button code-cancel" type="button">초기화</button><button class="save">저장</button></div></form><div class="grid-table-wrap"><table><thead><tr><th>부서</th><th>코드</th><th>팀명</th><th>상태</th><th>관리</th></tr></thead><tbody id="teamCodeBody"></tbody></table></div></section></div>
        <div class="code-subpanel" data-code-panel="jobPosition"><section class="card"><h2 class="card-title">직위 관리</h2><form class="code-form" data-code-type="jobPosition"><input type="hidden" name="id"><div class="field"><label>직위명</label><input name="name" required maxlength="100"></div><div class="helper">직위는 부서 및 팀과 무관한 독립 항목이며, 코드는 저장 시 자동 생성됩니다.</div><div class="actions"><button class="mini-button code-cancel" type="button">초기화</button><button class="save">저장</button></div></form><div class="grid-table-wrap"><table><thead><tr><th>코드</th><th>직위명</th><th>상태</th><th>관리</th></tr></thead><tbody id="jobPositionCodeBody"></tbody></table></div></section></div>
        <div class="code-subpanel" data-code-panel="position"><section class="card"><h2 class="card-title">직책 관리</h2><form class="code-form" data-code-type="position"><input type="hidden" name="id"><div class="field"><label>직책명</label><input name="name" required maxlength="100"></div><div class="helper">코드는 저장 시 자동 생성됩니다.</div><div class="actions"><button class="mini-button code-cancel" type="button">초기화</button><button class="save">저장</button></div></form><div class="grid-table-wrap"><table><thead><tr><th>코드</th><th>직책명</th><th>상태</th><th>관리</th></tr></thead><tbody id="positionCodeBody"></tbody></table></div></section></div>
      </section>
    </section>

    <div class="modal-overlay" id="fieldConfigModal" role="dialog" aria-modal="true" aria-labelledby="fieldConfigTitle">
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="card-title" id="fieldConfigTitle">관리항목 관리</h2>
          <button class="modal-close" type="button" id="closeFieldConfig">닫기</button>
        </div>
        <div class="modal-body">
          <div class="grid-table-wrap">
            <table class="field-config-table" aria-label="관리항목 설정">
              <thead>
                <tr>
                  <th>필드키</th>
                  <th>표시명</th>
                  <th>적용</th>
                  <th>입력 구분</th>
                  <th>조회조건 적용</th>
                </tr>
              </thead>
              <tbody id="fieldConfigBody">${fieldConfigRows}</tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <div id="fieldConfigMessage" class="message"></div>
          <button type="button" class="save" id="saveFieldConfigs">관리항목 저장</button>
        </div>
      </div>
    </div>

    <div class="modal-overlay" id="columnConfigModal" role="dialog" aria-modal="true" aria-labelledby="columnConfigTitle">
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="card-title" id="columnConfigTitle">컬럼조정</h2>
          <button class="modal-close" type="button" id="closeColumnConfig">닫기</button>
        </div>
        <div class="modal-body">
          <div class="grid-table-wrap">
            <table class="column-order-table" aria-label="Grid 컬럼 설정">
              <thead><tr><th>순서</th><th>컬럼명</th><th>Visible</th><th>틀고정</th><th>데이터 정렬</th></tr></thead>
              <tbody id="columnConfigBody"></tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <div id="columnConfigMessage" class="message"></div>
          <button type="button" class="save" id="saveColumnConfigs">컬럼 설정 저장</button>
        </div>
      </div>
    </div>

  </div>

  <script>
    const districtOptions = ${escapeScriptJson(params.districts)};
    const initialSetting = ${escapeScriptJson(params.setting)};
    const initialGridRows = ${escapeScriptJson(params.settingsGridRows)};
    let currentFieldConfigs = ${escapeScriptJson(params.fieldConfigs)};
    const bankValues = ${escapeScriptJson(BANKS)};
    const subscriptionStatusValues = ${escapeScriptJson(SUBSCRIPTION_STATUSES)};
    const billingCycleValues = ${escapeScriptJson(BILLING_CYCLES)};
    const contractStatusValues = ${escapeScriptJson(CONTRACT_STATUSES)};
    const districtSelect = document.getElementById('districtSeq');
    const basicDistrictSearch = document.getElementById('basicDistrictSearch');
    const basicDistrictResults = document.getElementById('basicDistrictResults');
    const selectedDistrictTitle = document.getElementById('selectedDistrictTitle');
    const selectedDistrictMeta = document.getElementById('selectedDistrictMeta');
    const basicForm = document.getElementById('basicForm');
    const message = document.getElementById('message');
    const saveButton = document.getElementById('saveButton');
    const searchControls = document.getElementById('searchControls');
    const settingsGridHead = document.getElementById('settingsGridHead');
    const settingsGridBody = document.getElementById('settingsGridBody');
    const gridSummary = document.getElementById('gridSummary');
    const gridTableWrap = settingsGridBody.closest('.grid-table-wrap');
    const fieldConfigBody = document.getElementById('fieldConfigBody');
    const fieldConfigMessage = document.getElementById('fieldConfigMessage');
    const saveFieldConfigsButton = document.getElementById('saveFieldConfigs');
    const imageFile = document.getElementById('imageFile');
    const dropzone = document.getElementById('dropzone');
    const fieldConfigModal = document.getElementById('fieldConfigModal');
    const openFieldConfigButton = document.getElementById('openFieldConfig');
    const closeFieldConfigButton = document.getElementById('closeFieldConfig');
    const adjustColumnsButton = document.getElementById('adjustColumns');
    const columnConfigModal = document.getElementById('columnConfigModal');
    const closeColumnConfigButton = document.getElementById('closeColumnConfig');
    const columnConfigBody = document.getElementById('columnConfigBody');
    const columnConfigMessage = document.getElementById('columnConfigMessage');
    const saveColumnConfigsButton = document.getElementById('saveColumnConfigs');
    const editSettingModal = document.getElementById('editSettingModal');
    const closeEditSettingButton = document.getElementById('closeEditSetting');

    const fieldInputMap = {
      districtUniqueNumber: document.getElementById('districtUniqueNumber'),
      districtUniqueNumberCopy: document.getElementById('districtUniqueNumberCopy'),
      bankName: document.getElementById('bankName'),
      accountNumber: document.getElementById('accountNumber'),
      contractDate: document.getElementById('contractDate'),
      contractFrom: document.getElementById('contractFrom'),
      contractTo: document.getElementById('contractTo'),
      contractStatus: document.getElementById('contractStatus'),
      managerName: document.getElementById('managerName'),
      managerEmail: document.getElementById('managerEmail'),
      managerPhone: document.getElementById('managerPhone'),
      managerMobile: document.getElementById('managerMobile'),
      subscriptionStatus: document.getElementById('subscriptionStatus'),
      billingCycle: document.getElementById('billingCycle'),
      imagePath: imageFile,
    };

    const roleLabel = {
      required: '필수',
      optional: '선택',
      search: '조회조건',
    };

    function escapeText(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function setFieldConfigMessage(text, tone) {
      fieldConfigMessage.textContent = text;
      fieldConfigMessage.className = tone ? 'message ' + tone : 'message';
    }

    function findDistrict(seq) {
      return districtOptions.find((district) => String(district.seq) === String(seq));
    }

    function renderBasicDistrictResults() {
      const query = basicDistrictSearch.value.trim().toLowerCase();
      districtSelect.value = '';
      if (query.length < 3) {
        basicDistrictResults.innerHTML = '';
        basicDistrictResults.classList.remove('open');
        return;
      }
      const matches = districtOptions
        .filter((district) => district.full_name.toLowerCase().includes(query))
        .slice(0, 30);
      basicDistrictResults.innerHTML = matches.length
        ? matches.map((district) => '<button type="button" data-seq="' + district.seq + '">' + escapeText(district.full_name) + '</button>').join('')
        : '<div class="code-district-empty">일치하는 지자체가 없습니다.</div>';
      basicDistrictResults.classList.add('open');
      basicDistrictResults.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          const selected = findDistrict(button.dataset.seq);
          if (!selected) return;
          basicDistrictSearch.value = selected.full_name;
          districtSelect.value = String(selected.seq);
          basicDistrictResults.classList.remove('open');
          districtSelect.dispatchEvent(new Event('change'));
        });
      });
    }

    basicDistrictSearch.addEventListener('input', renderBasicDistrictResults);
    basicDistrictSearch.addEventListener('focus', () => {
      basicDistrictSearch.select();
    });
    document.addEventListener('click', (event) => {
      if (!basicDistrictResults.parentElement.contains(event.target)) basicDistrictResults.classList.remove('open');
    });

    function setMessage(text, tone) {
      message.textContent = text;
      message.className = tone ? 'message ' + tone : 'message';
    }

    function getFieldConfigByKey(key) {
      return currentFieldConfigs.find((config) => config.fieldKey === key);
    }

    function isFieldRequired(key) {
      const config = getFieldConfigByKey(key);
      return config?.isEnabled === true && config.role === 'required';
    }

    function applyFieldRoleUI() {
      for (const [key, element] of Object.entries(fieldInputMap)) {
        if (!element) {
          continue;
        }

        if (isFieldRequired(key)) {
          element.setAttribute('required', 'required');
        } else {
          element.removeAttribute('required');
        }

        const chip = document.getElementById('roleChip-' + key);
        const config = getFieldConfigByKey(key);
        const role = config?.role ?? 'optional';
        element.closest('.field')?.toggleAttribute('hidden', config?.isEnabled === false);
        if (chip) {
          chip.textContent = roleLabel[role] ?? '선택';
        }
      }
    }

    function sortedFieldConfigs() {
      return currentFieldConfigs.slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }

    function renderSearchControls() {
      const searchFields = sortedFieldConfigs().filter((config) => config.isEnabled && config.isSearchable && config.fieldKey !== 'imagePath');

      const parts = searchFields.map((config) => {
        const id = 'filter-' + config.fieldKey;
        if (config.fieldKey === 'bankName') {
          const options = bankValues
            .map((item) => '<option value="' + escapeText(item) + '">' + escapeText(item) + '</option>')
            .join('');
          return '<div class="field"><label for="' + id + '">' + escapeText(config.displayName) + '</label><select id="' + id + '" data-filter-key="' + config.fieldKey + '"><option value="">전체</option>' + options + '</select></div>';
        }

        if (config.fieldKey === 'subscriptionStatus') {
          const options = subscriptionStatusValues
            .map((item) => '<option value="' + escapeText(item) + '">' + escapeText(item) + '</option>')
            .join('');
          return '<div class="field"><label for="' + id + '">' + escapeText(config.displayName) + '</label><select id="' + id + '" data-filter-key="' + config.fieldKey + '"><option value="">전체</option>' + options + '</select></div>';
        }

        if (config.fieldKey === 'billingCycle') {
          const options = billingCycleValues
            .map((item) => '<option value="' + escapeText(item) + '">' + escapeText(item) + '</option>')
            .join('');
          return '<div class="field"><label for="' + id + '">' + escapeText(config.displayName) + '</label><select id="' + id + '" data-filter-key="' + config.fieldKey + '"><option value="">전체</option>' + options + '</select></div>';
        }

        if (config.fieldKey === 'contractStatus') {
          const options = contractStatusValues
            .map((item) => '<option value="' + escapeText(item) + '">' + escapeText(item) + '</option>')
            .join('');
          return '<div class="field"><label for="' + id + '">' + escapeText(config.displayName) + '</label><select id="' + id + '" data-filter-key="' + config.fieldKey + '"><option value="">전체</option>' + options + '</select></div>';
        }

        const inputType = ['contractDate', 'contractFrom', 'contractTo'].includes(config.fieldKey) ? 'date' : 'text';
        return '<div class="field"><label for="' + id + '">' + escapeText(config.displayName) + '</label><input id="' + id + '" type="' + inputType + '" data-filter-key="' + config.fieldKey + '" /></div>';
      }).join('');

      searchControls.innerHTML = parts + '<button type="button" class="mini-button primary" id="applyFilters">조회</button><button type="button" class="mini-button" id="resetFilters">초기화</button>';

      const applyButton = document.getElementById('applyFilters');
      const resetButton = document.getElementById('resetFilters');

      applyButton?.addEventListener('click', () => loadGrid());
      resetButton?.addEventListener('click', () => {
        const controls = document.querySelectorAll('[data-filter-key]');
        controls.forEach((control) => {
          control.value = '';
        });
        loadGrid();
      });
    }

    function renderGridRows(rows) {
      const contractCount = rows.filter((row) => row.contractStatus === '계약').length;
      const monthlyCount = rows.filter((row) => row.subscriptionStatus === '구독중' && row.billingCycle === '월').length;
      const yearlyCount = rows.filter((row) => row.subscriptionStatus === '구독중' && row.billingCycle === '년').length;
      gridSummary.textContent = '계약: ' + contractCount + ' / ' + rows.length
        + ' , 구독 월/년: ' + monthlyCount + ' / ' + yearlyCount;

      const enabledFields = sortedFieldConfigs().filter((config) => config.isEnabled && config.gridVisible !== false);
      settingsGridHead.innerHTML = enabledFields.map((config) => {
        const classes = 'align-' + (config.gridAlignment ?? 'left') + (config.gridFrozen ? ' grid-frozen' : '');
        return '<th class="' + classes + '">' + escapeText(config.displayName) + '</th>';
      }).join('')
        + '<th>수정일</th><th>관리</th>';

      settingsGridBody.innerHTML = rows
        .map((row) => {
          const fieldCells = enabledFields.map((config) => {
            const value = row[config.fieldKey];
            const classes = 'align-' + (config.gridAlignment ?? 'left') + (config.gridFrozen ? ' grid-frozen' : '');
            if (config.fieldKey === 'imagePath' && value) {
              return '<td class="' + classes + '"><a href="' + escapeText(value) + '" target="_blank" rel="noopener">이미지 보기</a></td>';
            }
            return '<td class="' + classes + '">' + escapeText(value ?? '') + '</td>';
          }).join('');
          return '<tr>'
            + fieldCells
            + '<td>' + escapeText(row.updatedAt ?? '') + '</td>'
            + '<td><button type="button" class="pick-row" data-pick-district="' + row.districtSeq + '">관리</button></td>'
            + '</tr>';
        })
        .join('');

      settingsGridBody.querySelectorAll('[data-pick-district]').forEach((button) => {
        button.addEventListener('click', async () => {
          const seq = button.getAttribute('data-pick-district');
          districtSelect.value = String(seq);
          const selected = findDistrict(seq);
          if (selected) {
            basicDistrictSearch.value = selected.full_name;
            selectedDistrictTitle.textContent = selected.full_name;
            selectedDistrictMeta.textContent = selected.metropolitan_city + ' · ' + selected.district_type;
          }
          await loadSetting(seq);
          editSettingModal.classList.add('open');
          closeEditSettingButton.focus();
        });
      });
    }

    function buildGridQuery() {
      const params = new URLSearchParams();
      document.querySelectorAll('[data-filter-key]').forEach((element) => {
        const key = element.getAttribute('data-filter-key');
        const value = String(element.value ?? '').trim();
        if (key && value) {
          params.set(key, value);
        }
      });
      return params.toString();
    }

    async function loadGrid() {
      try {
        const query = buildGridQuery();
        const url = '/supervisor/api/settings-grid' + (query ? '?' + query : '');
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Grid 조회에 실패했습니다.');
        }
        renderGridRows(data.rows);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Grid 조회에 실패했습니다.', 'bad');
      }
    }

    function fillForm(setting) {
      document.getElementById('districtUniqueNumber').value = setting?.districtUniqueNumber ?? '';
      document.getElementById('districtUniqueNumberCopy').value = setting?.districtUniqueNumberCopy ?? '';
      document.getElementById('bankName').value = setting?.bankName ?? '';
      document.getElementById('accountNumber').value = setting?.accountNumber ?? '';
      document.getElementById('contractDate').value = setting?.contractDate ?? '';
      document.getElementById('contractFrom').value = setting?.contractFrom ?? '';
      document.getElementById('contractTo').value = setting?.contractTo ?? '';
      document.getElementById('contractStatus').value = setting?.contractStatus ?? '미계약';
      document.getElementById('managerName').value = setting?.managerName ?? '';
      document.getElementById('managerEmail').value = setting?.managerEmail ?? '';
      document.getElementById('managerPhone').value = setting?.managerPhone ?? '';
      document.getElementById('managerMobile').value = setting?.managerMobile ?? '';
      document.getElementById('subscriptionStatus').value = setting?.subscriptionStatus ?? '';
      document.getElementById('billingCycle').value = setting?.billingCycle ?? '';
      renderImage(setting?.imagePath ?? null);
    }

    function collectFieldConfigsFromTable() {
      const rows = Array.from(fieldConfigBody.querySelectorAll('tr[data-field-key]'));
      return rows.map((row) => {
        const fieldKey = row.getAttribute('data-field-key');
        const displayName = row.querySelector('.field-config-name')?.value ?? '';
        const role = row.querySelector('.field-config-role:checked')?.value ?? 'optional';
        const isEnabled = row.querySelector('.field-config-enabled')?.checked === true;
        const isSearchable = row.querySelector('.field-config-searchable')?.checked === true;
        const existing = getFieldConfigByKey(fieldKey);
        return {
          fieldKey,
          displayName,
          role,
          isEnabled,
          isSearchable,
          gridVisible: existing?.gridVisible !== false,
          gridFrozen: existing?.gridFrozen === true,
          gridAlignment: existing?.gridAlignment ?? 'left',
        };
      });
    }

    async function saveFieldConfigs() {
      setFieldConfigMessage('', '');
      saveFieldConfigsButton.disabled = true;

      try {
        const configs = collectFieldConfigsFromTable();
        const response = await fetch('/supervisor/api/field-configs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ configs }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || '관리항목 저장에 실패했습니다.');
        }

        currentFieldConfigs = data.configs;
        applyFieldRoleUI();
        renderSearchControls();
        await loadGrid();
        setFieldConfigMessage('관리항목이 저장되었습니다.', 'good');
      } catch (error) {
        setFieldConfigMessage(error instanceof Error ? error.message : '관리항목 저장에 실패했습니다.', 'bad');
      } finally {
        saveFieldConfigsButton.disabled = false;
      }
    }

    function renderImage(pathValue) {
      dropzone.innerHTML = '';
      if (pathValue) {
        const image = document.createElement('img');
        image.id = 'imagePreview';
        image.src = pathValue + '?v=' + Date.now();
        image.alt = '업로드 이미지';
        dropzone.appendChild(image);
        return;
      }

      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '이미지를 드래그하거나 클릭해서 업로드하세요.';
      dropzone.appendChild(empty);
    }

    function previewLocalFile(file) {
      const reader = new FileReader();
      reader.onload = () => renderImage(String(reader.result));
      reader.readAsDataURL(file);
    }

    function setFileOnInput(file) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      imageFile.files = dataTransfer.files;
      previewLocalFile(file);
    }

    async function loadSetting(seq) {
      const response = await fetch('/supervisor/api/settings?districtSeq=' + encodeURIComponent(seq));
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '불러오기에 실패했습니다.' }));
        setMessage(error.message || '불러오기에 실패했습니다.', 'bad');
        fillForm(null);
        return;
      }

      const data = await response.json();
      fillForm(data.setting);
      setMessage(data.setting ? '기존 값을 불러왔습니다.' : '저장된 값이 없습니다.', '');
    }

    districtSelect.addEventListener('change', () => {
      const selected = findDistrict(districtSelect.value);
      if (selected) {
        basicDistrictSearch.value = selected.full_name;
        selectedDistrictTitle.textContent = selected.full_name;
        selectedDistrictMeta.textContent = selected.metropolitan_city + ' · ' + selected.district_type;
      }
      loadSetting(districtSelect.value);
    });

    document.getElementById('contractFrom').addEventListener('change', (event) => {
      const value = event.target.value;
      if (!value) return;
      const [year, month, day] = value.split('-').map(Number);
      const endDate = new Date(Date.UTC(year + 1, month - 1, day));
      document.getElementById('contractTo').value = endDate.toISOString().slice(0, 10);
    });

    dropzone.addEventListener('click', () => imageFile.click());
    dropzone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
    dropzone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        setFileOnInput(file);
      }
    });
    imageFile.addEventListener('change', () => {
      const file = imageFile.files?.[0];
      if (file) {
        previewLocalFile(file);
      }
    });

    basicForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setMessage('', '');

      const formData = new FormData(basicForm);
      formData.set('districtSeq', districtSelect.value);

      saveButton.disabled = true;

      try {
        const response = await fetch('/supervisor/api/settings', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || '저장에 실패했습니다.');
        }

        fillForm(data.setting);
        setMessage('저장되었습니다.', 'good');
        await loadGrid();
        editSettingModal.classList.remove('open');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '저장에 실패했습니다.', 'bad');
      } finally {
        saveButton.disabled = false;
      }
    });

    function openFieldConfigModal() {
      setFieldConfigMessage('', '');
      fieldConfigModal.classList.add('open');
      closeFieldConfigButton.focus();
    }

    function closeFieldConfigModal() {
      fieldConfigModal.classList.remove('open');
      openFieldConfigButton.focus();
    }

    function closeEditSettingModal() {
      editSettingModal.classList.remove('open');
    }

    function alignmentIcon(alignment) {
      const positions = alignment === 'left' ? [2, 2, 2] : alignment === 'center' ? [5, 2, 5] : [8, 2, 8];
      return '<svg viewBox="0 0 24 18" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round">'
        + '<path d="M' + positions[0] + ' 3h14"/><path d="M' + positions[1] + ' 9h14"/><path d="M' + positions[2] + ' 15h14"/>'
        + '</g></svg>';
    }

    function renderColumnConfigs() {
      columnConfigBody.innerHTML = sortedFieldConfigs().map((config) => {
        const alignments = ['left', 'center', 'right'].map((alignment) =>
          '<label title="' + ({ left: '좌측 정렬', center: '중앙 정렬', right: '우측 정렬' })[alignment] + '">'
          + '<input class="column-alignment" type="checkbox" value="' + alignment + '" ' + ((config.gridAlignment ?? 'left') === alignment ? 'checked' : '') + ' />'
          + '<span class="alignment-icon">' + alignmentIcon(alignment) + '</span></label>'
        ).join('');
        return '<tr class="column-order-row" draggable="true" data-field-key="' + escapeText(config.fieldKey) + '">'
          + '<td><span class="drag-handle" title="드래그하여 순서 변경">☰</span></td>'
          + '<td>' + escapeText(config.displayName) + '</td>'
          + '<td><input class="column-visible" type="checkbox" ' + (config.gridVisible !== false ? 'checked' : '') + ' /></td>'
          + '<td><input class="column-frozen" type="checkbox" ' + (config.gridFrozen ? 'checked' : '') + ' /></td>'
          + '<td><div class="alignment-options">' + alignments + '</div></td></tr>';
      }).join('');

      let draggedRow = null;
      columnConfigBody.querySelectorAll('.column-order-row').forEach((row) => {
        row.addEventListener('dragstart', () => { draggedRow = row; row.classList.add('dragging'); });
        row.addEventListener('dragend', () => { row.classList.remove('dragging'); draggedRow = null; });
        row.addEventListener('dragover', (event) => {
          event.preventDefault();
          if (!draggedRow || draggedRow === row) return;
          const rect = row.getBoundingClientRect();
          columnConfigBody.insertBefore(draggedRow, event.clientY < rect.top + rect.height / 2 ? row : row.nextSibling);
        });
      });
    }

    function closeColumnConfigModal() { columnConfigModal.classList.remove('open'); }

    openFieldConfigButton.addEventListener('click', openFieldConfigModal);
    closeFieldConfigButton.addEventListener('click', closeFieldConfigModal);
    closeEditSettingButton.addEventListener('click', closeEditSettingModal);
    closeColumnConfigButton.addEventListener('click', closeColumnConfigModal);
    fieldConfigModal.addEventListener('click', (event) => {
      if (event.target === fieldConfigModal) closeFieldConfigModal();
    });
    editSettingModal.addEventListener('click', (event) => {
      if (event.target === editSettingModal) closeEditSettingModal();
    });
    columnConfigModal.addEventListener('click', (event) => {
      if (event.target === columnConfigModal) closeColumnConfigModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && fieldConfigModal.classList.contains('open')) closeFieldConfigModal();
      if (event.key === 'Escape' && editSettingModal.classList.contains('open')) closeEditSettingModal();
      if (event.key === 'Escape' && columnConfigModal.classList.contains('open')) closeColumnConfigModal();
    });
    adjustColumnsButton.addEventListener('click', () => {
      columnConfigMessage.textContent = '';
      renderColumnConfigs();
      columnConfigModal.classList.add('open');
      closeColumnConfigButton.focus();
    });

    columnConfigBody.addEventListener('change', (event) => {
      const checkbox = event.target;
      if (checkbox.classList.contains('column-frozen') && checkbox.checked) {
        columnConfigBody.querySelectorAll('.column-frozen').forEach((item) => { if (item !== checkbox) item.checked = false; });
      }
      if (checkbox.classList.contains('column-alignment')) {
        const options = checkbox.closest('.alignment-options').querySelectorAll('.column-alignment');
        if (checkbox.checked) options.forEach((item) => { if (item !== checkbox) item.checked = false; });
        else if (![...options].some((item) => item.checked)) checkbox.checked = true;
      }
    });

    saveColumnConfigsButton.addEventListener('click', async () => {
      saveColumnConfigsButton.disabled = true;
      try {
        const configs = Array.from(columnConfigBody.querySelectorAll('tr[data-field-key]')).map((row, index) => {
          const existing = getFieldConfigByKey(row.getAttribute('data-field-key'));
          return { ...existing, sortOrder: index + 1, gridVisible: row.querySelector('.column-visible').checked,
            gridFrozen: row.querySelector('.column-frozen').checked,
            gridAlignment: row.querySelector('.column-alignment:checked')?.value ?? 'left' };
        });
        const response = await fetch('/supervisor/api/field-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ configs }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || '컬럼 설정 저장에 실패했습니다.');
        currentFieldConfigs = data.configs;
        renderSearchControls();
        await loadGrid();
        closeColumnConfigModal();
      } catch (error) {
        columnConfigMessage.textContent = error instanceof Error ? error.message : '컬럼 설정 저장에 실패했습니다.';
        columnConfigMessage.className = 'message bad';
      } finally { saveColumnConfigsButton.disabled = false; }
    });

    saveFieldConfigsButton.addEventListener('click', () => {
      saveFieldConfigs();
    });

    fieldConfigBody.addEventListener('change', (event) => {
      const checkbox = event.target;
      if (!checkbox.classList.contains('field-config-role')) return;
      const row = checkbox.closest('tr[data-field-key]');
      const roleCheckboxes = Array.from(row.querySelectorAll('.field-config-role'));
      if (checkbox.checked) {
        roleCheckboxes.forEach((item) => {
          if (item !== checkbox) item.checked = false;
        });
      } else if (!roleCheckboxes.some((item) => item.checked)) {
        checkbox.checked = true;
      }
    });

    const codeDistrictSeq = document.getElementById('codeDistrictSeq');
    const codeDistrictSearch = document.getElementById('codeDistrictSearch');
    const codeDistrictResults = document.getElementById('codeDistrictResults');
    const codeMessage = document.getElementById('codeMessage');
    let codeState = { departments: [], teams: [], jobPositions: [], positions: [] };
    function safeText(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
    function codeButtons(type, item) { return '<button type="button" class="mini-button edit-code" data-type="'+type+'" data-id="'+item.id+'">수정</button> <button type="button" class="mini-button toggle-code" data-type="'+type+'" data-id="'+item.id+'">'+(item.isActive?'사용중지':'사용')+'</button> <button type="button" class="mini-button delete-code" data-type="'+type+'" data-id="'+item.id+'" style="border-color:#efb4b4;color:#c73535">삭제</button>'; }
    function renderBasicCodes() {
      const empty = (span) => '<tr><td colspan="'+span+'" style="text-align:center">등록된 항목이 없습니다.</td></tr>';
      departmentCodeBody.innerHTML = codeState.departments.map(x=>'<tr><td>'+safeText(x.code)+'</td><td>'+safeText(x.name)+'</td><td>'+(x.isActive?'사용':'중지')+'</td><td>'+codeButtons('department',x)+'</td></tr>').join('') || empty(4);
      teamCodeBody.innerHTML = codeState.teams.map(x=>'<tr><td>'+safeText(x.departmentName)+'</td><td>'+safeText(x.code)+'</td><td>'+safeText(x.name)+'</td><td>'+(x.isActive?'사용':'중지')+'</td><td>'+codeButtons('team',x)+'</td></tr>').join('') || empty(5);
      jobPositionCodeBody.innerHTML = codeState.jobPositions.map(x=>'<tr><td>'+safeText(x.code)+'</td><td>'+safeText(x.name)+'</td><td>'+(x.isActive?'사용':'중지')+'</td><td>'+codeButtons('jobPosition',x)+'</td></tr>').join('') || empty(4);
      positionCodeBody.innerHTML = codeState.positions.map(x=>'<tr><td>'+safeText(x.code)+'</td><td>'+safeText(x.name)+'</td><td>'+(x.isActive?'사용':'중지')+'</td><td>'+codeButtons('position',x)+'</td></tr>').join('') || empty(4);
      document.querySelectorAll('.code-form[data-code-type="team"] select[name="departmentId"]').forEach(select=>{const old=select.value;select.innerHTML='<option value="">선택하세요</option>'+codeState.departments.filter(x=>x.isActive).map(x=>'<option value="'+x.id+'">'+safeText(x.name)+'</option>').join('');select.value=old});
    }
    async function loadBasicCodes() {
      if (!codeDistrictSeq.value) throw new Error('검색 결과에서 지자체를 선택해 주세요.');
      const response = await fetch('/supervisor/api/basic-codes?districtSeq='+encodeURIComponent(codeDistrictSeq.value));
      const data = await response.json(); if(!response.ok) throw new Error(data.message || '기본코드를 조회하지 못했습니다.'); codeState=data; renderBasicCodes();
    }
    function renderCodeDistrictResults() {
      const query=codeDistrictSearch.value.trim().toLowerCase(); codeDistrictSeq.value='';
      if(query.length<3){codeDistrictResults.classList.remove('open');codeDistrictResults.innerHTML='';return}
      const matches=districtOptions.filter(item=>item.full_name.toLowerCase().includes(query)).slice(0,30);
      codeDistrictResults.innerHTML=matches.length?matches.map(item=>'<button type="button" data-seq="'+item.seq+'">'+safeText(item.full_name)+'</button>').join(''):'<div class="code-district-empty">일치하는 지자체가 없습니다.</div>';
      codeDistrictResults.classList.add('open');
      codeDistrictResults.querySelectorAll('button').forEach(button=>button.onclick=async()=>{const item=districtOptions.find(x=>String(x.seq)===button.dataset.seq);codeDistrictSearch.value=item.full_name;codeDistrictSeq.value=String(item.seq);codeDistrictResults.classList.remove('open');try{await loadBasicCodes()}catch(error){codeMessage.textContent=error.message;codeMessage.className='message bad'}});
    }
    codeDistrictSearch.addEventListener('input',renderCodeDistrictResults);
    codeDistrictSearch.addEventListener('focus',()=>{codeDistrictSearch.value='';codeDistrictSeq.value='';codeDistrictResults.innerHTML='';codeDistrictResults.classList.remove('open')});
    document.addEventListener('click',event=>{if(!codeDistrictResults.parentElement.contains(event.target))codeDistrictResults.classList.remove('open')});
    function activateCodeTab(type) { document.querySelectorAll('.code-subtab').forEach(x=>x.classList.toggle('active',x.dataset.codeTab===type));document.querySelectorAll('.code-subpanel').forEach(x=>x.classList.toggle('active',x.dataset.codePanel===type)); }
    document.querySelectorAll('.code-subtab').forEach(button=>button.addEventListener('click',()=>activateCodeTab(button.dataset.codeTab)));
    document.querySelectorAll('[data-main-tab]').forEach(button=>button.addEventListener('click',async()=>{document.querySelectorAll('[data-main-tab]').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.tab-panel').forEach(x=>x.classList.remove('active'));document.getElementById('tab-'+button.dataset.mainTab).classList.add('active');if(button.dataset.mainTab==='codes'){try{await loadBasicCodes()}catch(error){codeMessage.textContent=error.message;codeMessage.className='message bad'}}}));
    document.querySelectorAll('.code-form').forEach(form=>{form.addEventListener('submit',async event=>{event.preventDefault();const savedDepartmentId=form.dataset.codeType==='team'?form.elements.departmentId.value:'';const payload=Object.fromEntries(new FormData(form));payload.type=form.dataset.codeType;payload.districtSeq=codeDistrictSeq.value;const response=await fetch('/supervisor/api/basic-codes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();codeMessage.textContent=data.message;codeMessage.className='message '+(response.ok?'good':'bad');if(response.ok){form.reset();form.elements.id.value='';await loadBasicCodes();if(savedDepartmentId&&form.dataset.codeType==='team')form.elements.departmentId.value=savedDepartmentId}});form.querySelector('.code-cancel').onclick=()=>{form.reset();form.elements.id.value=''}});
    document.getElementById('tab-codes').addEventListener('click',async event=>{const button=event.target.closest('.edit-code,.toggle-code,.delete-code');if(!button)return;const type=button.dataset.type;const list=type==='department'?codeState.departments:type==='team'?codeState.teams:type==='jobPosition'?codeState.jobPositions:codeState.positions;const item=list.find(x=>String(x.id)===button.dataset.id);if(!item)return;if(button.classList.contains('edit-code')){activateCodeTab(type);const form=document.querySelector('.code-form[data-code-type="'+type+'"]');form.elements.id.value=item.id;form.elements.name.value=item.name;if(type==='team')form.elements.departmentId.value=item.departmentId;form.scrollIntoView({behavior:'smooth',block:'center'});return}const deleting=button.classList.contains('delete-code');if(deleting&&!confirm('선택한 기본코드 '+item.name+'을(를) 삭제하시겠습니까?'))return;const response=await fetch('/supervisor/api/basic-codes/'+type+'/'+item.id+'/'+(deleting?'delete':'toggle'),{method:'POST'});const data=await response.json();codeMessage.textContent=data.message;codeMessage.className='message '+(response.ok?'good':'bad');if(response.ok)await loadBasicCodes()});

    applyFieldRoleUI();
    renderSearchControls();
    renderGridRows(initialGridRows);

    if (initialSetting) {
      fillForm(initialSetting);
    } else {
      renderImage(null);
    }
  </script>
</body>
</html>`;
}

function toSettingResponse(row: BasicSettingRow | null): SupervisorSettingResponse | null {
  if (!row) {
    return null;
  }

  return {
    districtSeq: row.district_seq,
    districtUniqueNumber: row.district_unique_number,
    districtUniqueNumberCopy: row.district_unique_number_copy,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    contractDate: row.contract_date,
    contractFrom: row.contract_from,
    contractTo: row.contract_to,
    contractStatus: row.contract_status || '미계약',
    managerName: row.manager_name,
    managerEmail: row.manager_email,
    managerPhone: row.manager_phone,
    managerMobile: row.manager_mobile,
    subscriptionStatus: row.subscription_status,
    billingCycle: row.billing_cycle,
    imagePath: row.image_path,
    updatedAt: row.updated_at,
  };
}

async function loadDistricts(db: Pool): Promise<DistrictRow[]> {
  const [rows] = await db.query(
    'SELECT seq, metropolitan_city, upper_city, district_name, district_type, full_name FROM korean_administrative_districts ORDER BY seq',
  );

  return rows as DistrictRow[];
}

async function loadSetting(db: Pool, districtSeq: number): Promise<SupervisorSettingResponse | null> {
  const [rows] = await db.query(
    'SELECT district_seq, district_unique_number, district_unique_number_copy, bank_name, account_number, contract_date, contract_from, contract_to, contract_status, manager_name, manager_email, manager_phone, manager_mobile, subscription_status, billing_cycle, image_path, updated_at FROM supervisor_basic_settings WHERE district_seq = ? LIMIT 1',
    [districtSeq],
  );

  const settings = rows as BasicSettingRow[];
  return settings[0] ? toSettingResponse(settings[0]) : null;
}

async function loadFieldConfigs(db: Pool): Promise<SupervisorFieldConfig[]> {
  const [rows] = await db.query(
    'SELECT field_key AS fieldKey, display_name AS displayName, role, sort_order AS sortOrder, is_enabled AS isEnabled, is_searchable AS isSearchable, grid_visible AS gridVisible, grid_frozen AS gridFrozen, grid_alignment AS gridAlignment FROM supervisor_field_configs ORDER BY sort_order, field_key',
  );

  const typedRows = rows as Array<{
    fieldKey: string;
    displayName: string;
    role: string;
    sortOrder: number;
    isEnabled: number | boolean;
    isSearchable: number | boolean;
    gridVisible: number | boolean;
    gridFrozen: number | boolean;
    gridAlignment: string;
  }>;

  return typedRows
    .filter((item) => FIELD_KEYS.includes(item.fieldKey as (typeof FIELD_KEYS)[number]) && isFieldRole(item.role))
    .map((item) => ({
      fieldKey: item.fieldKey,
      displayName: item.displayName,
      role: item.role as FieldRole,
      sortOrder: Number(item.sortOrder),
      isEnabled: Boolean(item.isEnabled),
      isSearchable: Boolean(item.isSearchable),
      gridVisible: Boolean(item.gridVisible),
      gridFrozen: Boolean(item.gridFrozen),
      gridAlignment: ['left', 'center', 'right'].includes(item.gridAlignment) ? item.gridAlignment as 'left' | 'center' | 'right' : 'left',
    }));
}

async function saveFieldConfigs(db: Pool, configs: SupervisorFieldConfig[]): Promise<void> {
  const sorted = configs.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const values = sorted.flatMap((item) => [item.fieldKey, item.displayName, item.role, item.sortOrder, item.isEnabled, item.isSearchable, item.gridVisible !== false, item.gridFrozen === true, item.gridAlignment ?? 'left']);
  const placeholders = sorted.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');

  await db.query(
    `
      INSERT INTO supervisor_field_configs (field_key, display_name, role, sort_order, is_enabled, is_searchable, grid_visible, grid_frozen, grid_alignment)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        display_name = VALUES(display_name),
        role = VALUES(role),
        sort_order = VALUES(sort_order),
        is_enabled = VALUES(is_enabled),
        is_searchable = VALUES(is_searchable),
        grid_visible = VALUES(grid_visible),
        grid_frozen = VALUES(grid_frozen),
        grid_alignment = VALUES(grid_alignment)
    `,
    values,
  );
}

async function loadSettingsGrid(
  db: Pool,
  searchFilters: Record<string, string>,
  fieldConfigs: SupervisorFieldConfig[],
): Promise<SupervisorSettingsGridRow[]> {
  const searchableKeys = new Set(
    fieldConfigs.filter((config) => config.isEnabled && config.isSearchable).map((config) => config.fieldKey),
  );

  const whereClauses: string[] = [];
  const values: string[] = [];

  const addLikeFilter = (column: string, key: string) => {
    const value = searchFilters[key]?.trim();
    if (value && searchableKeys.has(key)) {
      whereClauses.push(`${column} LIKE ?`);
      values.push(`%${value}%`);
    }
  };

  addLikeFilter('s.district_unique_number', 'districtUniqueNumber');
  addLikeFilter('d.full_name', 'districtName');
  addLikeFilter('s.district_unique_number_copy', 'districtUniqueNumberCopy');
  addLikeFilter('s.bank_name', 'bankName');
  addLikeFilter('s.account_number', 'accountNumber');
  addLikeFilter('s.subscription_status', 'subscriptionStatus');
  addLikeFilter('s.billing_cycle', 'billingCycle');
  addLikeFilter('s.manager_name', 'managerName');
  addLikeFilter('s.manager_email', 'managerEmail');
  addLikeFilter('s.manager_phone', 'managerPhone');
  addLikeFilter('s.manager_mobile', 'managerMobile');

  const contractStatusFilter = searchFilters.contractStatus?.trim();
  if (contractStatusFilter && searchableKeys.has('contractStatus')) {
    whereClauses.push("COALESCE(NULLIF(TRIM(s.contract_status), ''), '미계약') = ?");
    values.push(contractStatusFilter);
  }

  if (searchFilters.contractDate?.trim() && searchableKeys.has('contractDate')) {
    whereClauses.push('DATE_FORMAT(s.contract_date, "%Y-%m-%d") = ?');
    values.push(searchFilters.contractDate.trim());
  }

  for (const [key, column] of [['contractFrom', 's.contract_from'], ['contractTo', 's.contract_to']] as const) {
    if (searchFilters[key]?.trim() && searchableKeys.has(key)) {
      whereClauses.push(`DATE_FORMAT(${column}, "%Y-%m-%d") = ?`);
      values.push(searchFilters[key].trim());
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await db.query(
    `
      SELECT
        d.seq AS districtSeq,
        d.full_name AS districtName,
        s.district_unique_number AS districtUniqueNumber,
        s.district_unique_number_copy AS districtUniqueNumberCopy,
        s.bank_name AS bankName,
        s.account_number AS accountNumber,
        DATE_FORMAT(s.contract_date, '%Y-%m-%d') AS contractDate,
        DATE_FORMAT(s.contract_from, '%Y-%m-%d') AS contractFrom,
        DATE_FORMAT(s.contract_to, '%Y-%m-%d') AS contractTo,
        COALESCE(s.contract_status, '미계약') AS contractStatus,
        s.manager_name AS managerName,
        s.manager_email AS managerEmail,
        s.manager_phone AS managerPhone,
        s.manager_mobile AS managerMobile,
        s.subscription_status AS subscriptionStatus,
        s.billing_cycle AS billingCycle,
        s.image_path AS imagePath,
        DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM korean_administrative_districts d
      LEFT JOIN supervisor_basic_settings s ON s.district_seq = d.seq
      ${whereSql}
      ORDER BY d.seq
    `,
    values,
  );

  return rows as SupervisorSettingsGridRow[];
}

function validateSupervisorForm(data: {
  districtSeq: string;
  districtUniqueNumber: string;
  districtUniqueNumberCopy: string;
  bankName: string;
  accountNumber: string;
  contractDate: string;
  contractFrom: string;
  contractTo: string;
  contractStatus: string;
  managerName: string;
  managerEmail: string;
  managerPhone: string;
  managerMobile: string;
  subscriptionStatus: string;
  billingCycle: string;
  imagePath: string | null;
}, fieldConfigs: SupervisorFieldConfig[]): {
  districtSeq: number;
  districtUniqueNumber: string | null;
  districtUniqueNumberCopy: string | null;
  bankName: string | null;
  accountNumber: string | null;
  contractDate: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  contractStatus: (typeof CONTRACT_STATUSES)[number];
  managerName: string | null;
  managerEmail: string | null;
  managerPhone: string | null;
  managerMobile: string | null;
  subscriptionStatus: (typeof SUBSCRIPTION_STATUSES)[number] | null;
  billingCycle: (typeof BILLING_CYCLES)[number] | null;
  imagePath: string | null;
} {
  const roles = fieldRoleMap(fieldConfigs);
  const isRequired = (fieldKey: string): boolean => roles.get(fieldKey) === 'required';
  const districtSeq = Number(data.districtSeq);
  if (!Number.isInteger(districtSeq) || districtSeq <= 0) {
    throw new Error('지자체를 선택해 주세요.');
  }

  const districtUniqueNumberRaw = data.districtUniqueNumber.trim();
  const districtUniqueNumberCopyRaw = data.districtUniqueNumberCopy.trim();
  const accountNumberRaw = data.accountNumber.trim();
  const bankNameRaw = data.bankName.trim();
  const contractDateRaw = data.contractDate.trim();
  const contractFromRaw = data.contractFrom.trim();
  const contractToRaw = data.contractTo.trim();
  const contractStatusRaw = data.contractStatus.trim() || '미계약';
  const managerNameRaw = data.managerName.trim();
  const managerEmailRaw = data.managerEmail.trim();
  const managerPhoneRaw = data.managerPhone.trim();
  const managerMobileRaw = data.managerMobile.trim();
  const subscriptionStatusRaw = data.subscriptionStatus.trim();
  const billingCycleRaw = data.billingCycle.trim();

  if (isRequired('districtUniqueNumber') && !districtUniqueNumberRaw) {
    throw new Error('지자체의 고유번호는 필수 입력입니다.');
  }
  if (isRequired('districtUniqueNumberCopy') && !districtUniqueNumberCopyRaw) {
    throw new Error('고유번호사본은 필수 입력입니다.');
  }
  if (isRequired('bankName') && !bankNameRaw) {
    throw new Error('은행은 필수 입력입니다.');
  }
  if (isRequired('accountNumber') && !accountNumberRaw) {
    throw new Error('계좌번호는 필수 입력입니다.');
  }
  if (isRequired('contractDate') && !contractDateRaw) {
    throw new Error('계약일은 필수 입력입니다.');
  }
  if (isRequired('contractFrom') && !contractFromRaw) throw new Error('계약기간 From은 필수 입력입니다.');
  if (isRequired('contractTo') && !contractToRaw) throw new Error('계약기간 To는 필수 입력입니다.');
  if (isRequired('managerName') && !managerNameRaw) throw new Error('담당자명은 필수 입력입니다.');
  if (isRequired('managerEmail') && !managerEmailRaw) throw new Error('담당자이메일은 필수 입력입니다.');
  if (isRequired('managerPhone') && !managerPhoneRaw) throw new Error('담당자연락처는 필수 입력입니다.');
  if (isRequired('managerMobile') && !managerMobileRaw) throw new Error('담당자모바일폰은 필수 입력입니다.');
  if (isRequired('subscriptionStatus') && !subscriptionStatusRaw) {
    throw new Error('구독상태는 필수 입력입니다.');
  }
  if (isRequired('billingCycle') && !billingCycleRaw) {
    throw new Error('구독료청구방식은 필수 입력입니다.');
  }
  if (isRequired('imagePath') && !data.imagePath) {
    throw new Error('이미지는 필수 입력입니다.');
  }

  const districtUniqueNumber = districtUniqueNumberRaw
    ? ensureDigitsOnly(districtUniqueNumberRaw, '지자체의 고유번호')
    : null;
  const districtUniqueNumberCopy = districtUniqueNumberCopyRaw
    ? ensureDigitsOnly(districtUniqueNumberCopyRaw, '고유번호사본')
    : null;
  const accountNumber = accountNumberRaw
    ? ensureDigitsOnly(accountNumberRaw, '계좌번호')
    : null;
  const bankName = bankNameRaw || null;
  const contractDate = contractDateRaw || null;
  const contractFrom = contractFromRaw || null;
  const contractTo = contractToRaw || null;
  const managerName = managerNameRaw || null;
  const managerEmail = managerEmailRaw || null;
  const managerPhone = managerPhoneRaw || null;
  const managerMobile = managerMobileRaw || null;
  const subscriptionStatus = subscriptionStatusRaw || null;
  const billingCycle = billingCycleRaw || null;

  if (bankName && !BANKS.includes(bankName)) {
    throw new Error('은행을 선택해 주세요.');
  }

  if (contractDate && !isValidDate(contractDate)) {
    throw new Error('계약일 형식이 올바르지 않습니다.');
  }
  if ((contractFrom && !contractTo) || (!contractFrom && contractTo)) {
    throw new Error('계약기간 From과 To를 모두 입력해 주세요.');
  }
  if (contractFrom && contractTo && !isWholeYearPeriod(contractFrom, contractTo)) {
    throw new Error('계약기간은 1년 단위로만 지정할 수 있습니다.');
  }
  if (!CONTRACT_STATUSES.includes(contractStatusRaw as (typeof CONTRACT_STATUSES)[number])) {
    throw new Error('계약상태를 선택해 주세요.');
  }
  if (managerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) {
    throw new Error('담당자이메일 형식이 올바르지 않습니다.');
  }

  if (
    subscriptionStatus
    && !SUBSCRIPTION_STATUSES.includes(subscriptionStatus as (typeof SUBSCRIPTION_STATUSES)[number])
  ) {
    throw new Error('구독상태를 선택해 주세요.');
  }

  if (billingCycle && !BILLING_CYCLES.includes(billingCycle as (typeof BILLING_CYCLES)[number])) {
    throw new Error('구독료청구방식을 선택해 주세요.');
  }

  return {
    districtSeq,
    districtUniqueNumber,
    districtUniqueNumberCopy,
    bankName,
    accountNumber,
    contractDate,
    contractFrom,
    contractTo,
    contractStatus: contractStatusRaw as (typeof CONTRACT_STATUSES)[number],
    managerName,
    managerEmail,
    managerPhone,
    managerMobile,
    subscriptionStatus: subscriptionStatus as (typeof SUBSCRIPTION_STATUSES)[number] | null,
    billingCycle: billingCycle as (typeof BILLING_CYCLES)[number] | null,
    imagePath: data.imagePath,
  };
}

async function ensureDistrictExists(db: Pool, districtSeq: number): Promise<DistrictRow> {
  const [rows] = await db.query(
    'SELECT seq, metropolitan_city, upper_city, district_name, district_type, full_name FROM korean_administrative_districts WHERE seq = ? LIMIT 1',
    [districtSeq],
  );

  const districts = rows as DistrictRow[];
  if (!districts[0]) {
    throw new Error('선택한 지자체를 찾을 수 없습니다.');
  }

  return districts[0];
}

export async function ensureSupervisorSchema(db: Pool): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS supervisor_basic_code_sequences (
    code_date DATE NOT NULL, last_number INT NOT NULL DEFAULT 0, PRIMARY KEY(code_date)
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS organization_departments (
    id INT NOT NULL AUTO_INCREMENT, district_seq INT NOT NULL, code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL, sort_order INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id), UNIQUE KEY uq_department_code(district_seq,code), UNIQUE KEY uq_department_name(district_seq,name),
    CONSTRAINT fk_department_district FOREIGN KEY(district_seq) REFERENCES korean_administrative_districts(seq) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS organization_teams (
    id INT NOT NULL AUTO_INCREMENT, department_id INT NOT NULL, code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL, sort_order INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id), UNIQUE KEY uq_team_code(department_id,code), UNIQUE KEY uq_team_name(department_id,name),
    CONSTRAINT fk_team_department FOREIGN KEY(department_id) REFERENCES organization_departments(id) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS organization_positions (
    id INT NOT NULL AUTO_INCREMENT, district_seq INT NOT NULL, code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL, sort_order INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id), UNIQUE KEY uq_position_code(district_seq,code), UNIQUE KEY uq_position_name(district_seq,name),
    CONSTRAINT fk_position_district FOREIGN KEY(district_seq) REFERENCES korean_administrative_districts(seq) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS organization_job_positions (
    id INT NOT NULL AUTO_INCREMENT, district_seq INT NOT NULL, code VARCHAR(30) NOT NULL,
    name VARCHAR(100) NOT NULL, sort_order INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(id), UNIQUE KEY uq_job_position_code(district_seq,code), UNIQUE KEY uq_job_position_name(district_seq,name),
    CONSTRAINT fk_job_position_district FOREIGN KEY(district_seq) REFERENCES korean_administrative_districts(seq) ON DELETE CASCADE
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS supervisor_basic_settings (
      district_seq INT NOT NULL,
      district_unique_number VARCHAR(50) NULL,
      district_unique_number_copy VARCHAR(50) NULL,
      bank_name VARCHAR(50) NULL,
      account_number VARCHAR(50) NULL,
      contract_date DATE NULL,
      contract_from DATE NULL,
      contract_to DATE NULL,
      contract_status VARCHAR(20) NOT NULL DEFAULT '미계약',
      manager_name VARCHAR(100) NULL,
      manager_email VARCHAR(255) NULL,
      manager_phone VARCHAR(50) NULL,
      manager_mobile VARCHAR(50) NULL,
      subscription_status VARCHAR(20) NULL,
      billing_cycle VARCHAR(10) NULL,
      image_path VARCHAR(255) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (district_seq),
      CONSTRAINT fk_supervisor_basic_settings_district_seq
        FOREIGN KEY (district_seq) REFERENCES korean_administrative_districts(seq)
        ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS supervisor_field_configs (
      field_key VARCHAR(64) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      role ENUM('required', 'optional', 'search') NOT NULL,
      sort_order INT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      is_searchable BOOLEAN NOT NULL DEFAULT FALSE,
      grid_visible BOOLEAN NOT NULL DEFAULT TRUE,
      grid_frozen BOOLEAN NOT NULL DEFAULT FALSE,
      grid_alignment VARCHAR(10) NOT NULL DEFAULT 'left',
      PRIMARY KEY (field_key)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);

  const [enabledColumns] = await db.query(
    "SHOW COLUMNS FROM supervisor_field_configs LIKE 'is_enabled'",
  );
  if (Array.isArray(enabledColumns) && enabledColumns.length === 0) {
    await db.query(`
      ALTER TABLE supervisor_field_configs
        ADD COLUMN is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
    `);
  }

  for (const column of [
    { name: 'contract_from', definition: 'DATE NULL' },
    { name: 'contract_to', definition: 'DATE NULL' },
    { name: 'contract_status', definition: "VARCHAR(20) NOT NULL DEFAULT '미계약'" },
    { name: 'manager_name', definition: 'VARCHAR(100) NULL' },
    { name: 'manager_email', definition: 'VARCHAR(255) NULL' },
    { name: 'manager_phone', definition: 'VARCHAR(50) NULL' },
    { name: 'manager_mobile', definition: 'VARCHAR(50) NULL' },
  ]) {
    const [columns] = await db.query(`SHOW COLUMNS FROM supervisor_basic_settings LIKE '${column.name}'`);
    if (Array.isArray(columns) && columns.length === 0) {
      await db.query(`ALTER TABLE supervisor_basic_settings ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await db.query(`
    UPDATE supervisor_basic_settings
    SET contract_status = '미계약'
    WHERE contract_status IS NULL OR TRIM(contract_status) = '';
  `);

  const [searchableColumns] = await db.query(
    "SHOW COLUMNS FROM supervisor_field_configs LIKE 'is_searchable'",
  );
  if (Array.isArray(searchableColumns) && searchableColumns.length === 0) {
    await db.query(`
      ALTER TABLE supervisor_field_configs
        ADD COLUMN is_searchable BOOLEAN NOT NULL DEFAULT FALSE;
    `);
  }

  for (const column of [
    { name: 'grid_visible', definition: 'BOOLEAN NOT NULL DEFAULT TRUE' },
    { name: 'grid_frozen', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
    { name: 'grid_alignment', definition: "VARCHAR(10) NOT NULL DEFAULT 'left'" },
  ]) {
    const [columns] = await db.query(`SHOW COLUMNS FROM supervisor_field_configs LIKE '${column.name}'`);
    if (Array.isArray(columns) && columns.length === 0) {
      await db.query(`ALTER TABLE supervisor_field_configs ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await db.query(`
    UPDATE supervisor_field_configs
    SET is_searchable = TRUE, role = 'optional'
    WHERE role = 'search';
  `);

  await db.query(`
    ALTER TABLE supervisor_field_configs
      MODIFY role ENUM('required', 'optional') NOT NULL;
  `);

  await db.query(`
    ALTER TABLE supervisor_basic_settings
      MODIFY district_unique_number VARCHAR(50) NULL,
      MODIFY district_unique_number_copy VARCHAR(50) NULL,
      MODIFY bank_name VARCHAR(50) NULL,
      MODIFY account_number VARCHAR(50) NULL,
      MODIFY contract_date DATE NULL,
      MODIFY subscription_status VARCHAR(20) NULL,
      MODIFY billing_cycle VARCHAR(10) NULL;
  `);

  const placeholders = DEFAULT_FIELD_CONFIGS.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
  const values = DEFAULT_FIELD_CONFIGS.flatMap((item) => [
    item.fieldKey,
    item.displayName,
    item.role,
    item.sortOrder,
    item.isEnabled,
    item.isSearchable,
  ]);

  await db.query(
    `
      INSERT INTO supervisor_field_configs (field_key, display_name, role, sort_order, is_enabled, is_searchable)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
        display_name = VALUES(display_name),
        sort_order = VALUES(sort_order),
        role = role,
        is_enabled = is_enabled,
        is_searchable = is_searchable
    `,
    values,
  );
}

async function nextBasicCode(connection: PoolConnection): Promise<string> {
  await connection.query('INSERT IGNORE INTO supervisor_basic_code_sequences(code_date,last_number) VALUES(CURDATE(),0)');
  const [rows] = await connection.query("SELECT DATE_FORMAT(code_date,'%Y%m%d') AS codeDate,last_number AS lastNumber FROM supervisor_basic_code_sequences WHERE code_date=CURDATE() FOR UPDATE");
  const current = (rows as Array<{codeDate:string;lastNumber:number}>)[0];
  const next = Number(current.lastNumber) + 1;
  await connection.query('UPDATE supervisor_basic_code_sequences SET last_number=? WHERE code_date=CURDATE()', [next]);
  return `${current.codeDate}_${String(next).padStart(4, '0')}`;
}

export function registerSupervisorRoutes(app: express.Express, db: Pool): void {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const upload = createUploadMiddleware(uploadsDir);

  app.use('/uploads', express.static(uploadsDir));

  app.get('/supervisor', async (request, response) => {
    if (!getSupervisorAuth(request)) {
      response.send(renderLoginPage());
      return;
    }

    const districts = await loadDistricts(db);
    if (districts.length === 0) {
      response.status(500).send(renderLoginPage('지자체 데이터가 없습니다.'));
      return;
    }

    const selectedDistrictSeq = Number(request.query.districtSeq ?? districts[0].seq);
    const selectedDistrict = districts.find((district) => district.seq === selectedDistrictSeq) ?? districts[0];
    const setting = await loadSetting(db, selectedDistrict.seq);
    const fieldConfigs = await loadFieldConfigs(db);
    const settingsGridRows = await loadSettingsGrid(db, {}, fieldConfigs);

    response.send(
      renderDashboardPage({
        districts,
        selectedDistrict,
        setting,
        settingsGridRows,
        fieldConfigs,
        supervisorUsername: requiredEnv('SUPERVISOR_USERNAME', 'supervisor'),
      }),
    );
  });

  app.post('/supervisor/login', async (request, response) => {
    const supervisorUsername = requiredEnv('SUPERVISOR_USERNAME', 'supervisor');
    const supervisorPassword = requiredEnv('SUPERVISOR_PASSWORD');
    const username = String(request.body.username ?? '').trim();
    const password = String(request.body.password ?? '');

    if (username !== supervisorUsername || password !== supervisorPassword) {
      response.status(401).send(renderLoginPage('아이디 또는 비밀번호가 올바르지 않습니다.'));
      return;
    }

    setSupervisorCookie(response, supervisorUsername);
    response.redirect('/supervisor');
  });

  app.post('/supervisor/logout', (_request, response) => {
    clearSupervisorCookie(response);
    response.redirect('/supervisor');
  });

  app.get('/supervisor/api/basic-codes', async (request, response) => {
    if (!getSupervisorAuth(request)) { response.status(401).json({ message: '로그인이 필요합니다.' }); return; }
    const districtSeq = Number(request.query.districtSeq);
    if (!Number.isInteger(districtSeq) || districtSeq <= 0) { response.status(400).json({ message: '지자체를 선택해 주세요.' }); return; }
    const [departments] = await db.query('SELECT id,code,name,is_active AS isActive FROM organization_departments WHERE district_seq=? ORDER BY sort_order,name', [districtSeq]);
    const [teams] = await db.query(`SELECT t.id,t.department_id AS departmentId,d.name AS departmentName,t.code,t.name,t.is_active AS isActive
      FROM organization_teams t JOIN organization_departments d ON d.id=t.department_id WHERE d.district_seq=? ORDER BY d.sort_order,d.name,t.sort_order,t.name`, [districtSeq]);
    const [positions] = await db.query('SELECT id,code,name,is_active AS isActive FROM organization_positions WHERE district_seq=? ORDER BY sort_order,name', [districtSeq]);
    const [jobPositions] = await db.query('SELECT id,code,name,is_active AS isActive FROM organization_job_positions WHERE district_seq=? ORDER BY sort_order,name', [districtSeq]);
    response.json({ departments, teams, jobPositions, positions });
  });

  app.post('/supervisor/api/basic-codes', async (request, response) => {
    if (!getSupervisorAuth(request)) { response.status(401).json({ message: '로그인이 필요합니다.' }); return; }
    const type = String(request.body.type ?? '');
    const districtSeq = Number(request.body.districtSeq), id = Number(request.body.id || 0);
    const name = String(request.body.name ?? '').trim();
    if (!['department','team','jobPosition','position'].includes(type) || !Number.isInteger(districtSeq) || districtSeq <= 0 || !name) {
      response.status(400).json({ message: '지자체와 명칭을 올바르게 입력해 주세요.' }); return;
    }
    try {
      await ensureDistrictExists(db, districtSeq);
      if (type === 'team') {
        const departmentId = Number(request.body.departmentId);
        const [parents] = await db.query('SELECT id FROM organization_departments WHERE id=? AND district_seq=? LIMIT 1', [departmentId,districtSeq]);
        if (!(parents as unknown[]).length) { response.status(400).json({ message: '소속 부서를 선택해 주세요.' }); return; }
        if (id) await db.query(`UPDATE organization_teams t JOIN organization_departments d ON d.id=t.department_id SET t.department_id=?,t.name=? WHERE t.id=? AND d.district_seq=?`, [departmentId,name,id,districtSeq]);
        else {
          const connection = await db.getConnection();
          try { await connection.beginTransaction(); const code = await nextBasicCode(connection); await connection.query('INSERT INTO organization_teams(department_id,code,name) VALUES(?,?,?)', [departmentId,code,name]); await connection.commit(); }
          catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
        }
      } else {
        const table = type === 'department' ? 'organization_departments' : type === 'jobPosition' ? 'organization_job_positions' : 'organization_positions';
        if (id) await db.query(`UPDATE ${table} SET name=? WHERE id=? AND district_seq=?`, [name,id,districtSeq]);
        else {
          const connection = await db.getConnection();
          try { await connection.beginTransaction(); const code = await nextBasicCode(connection); await connection.query(`INSERT INTO ${table}(district_seq,code,name) VALUES(?,?,?)`, [districtSeq,code,name]); await connection.commit(); }
          catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
        }
      }
      response.json({ message: '기본코드를 저장했습니다.' });
    } catch (error) {
      const duplicate = (error as {code?:string}).code === 'ER_DUP_ENTRY';
      response.status(400).json({ message: duplicate ? '같은 지자체 또는 부서에 중복된 코드나 명칭이 있습니다.' : '기본코드를 저장하지 못했습니다.' });
    }
  });

  app.post('/supervisor/api/basic-codes/:type/:id/toggle', async (request, response) => {
    if (!getSupervisorAuth(request)) { response.status(401).json({ message: '로그인이 필요합니다.' }); return; }
    const type = String(request.params.type), id = Number(request.params.id);
    const table = type === 'department' ? 'organization_departments' : type === 'team' ? 'organization_teams' : type === 'jobPosition' ? 'organization_job_positions' : type === 'position' ? 'organization_positions' : '';
    if (!table || !Number.isInteger(id) || id <= 0) { response.status(400).json({ message: '잘못된 기본코드입니다.' }); return; }
    await db.query(`UPDATE ${table} SET is_active=NOT is_active WHERE id=?`, [id]);
    response.json({ message: '사용 상태를 변경했습니다.' });
  });

  app.post('/supervisor/api/basic-codes/:type/:id/delete', async (request, response) => {
    if (!getSupervisorAuth(request)) { response.status(401).json({ message: '로그인이 필요합니다.' }); return; }
    const type=String(request.params.type),id=Number(request.params.id);
    const table=type==='department'?'organization_departments':type==='team'?'organization_teams':type==='jobPosition'?'organization_job_positions':type==='position'?'organization_positions':'';
    if(!table||!Number.isInteger(id)||id<=0){response.status(400).json({message:'잘못된 기본코드입니다.'});return}
    try{
      let districtSeq=0,name='';
      if(type==='team'){const [rows]=await db.query(`SELECT t.name,d.district_seq AS districtSeq FROM organization_teams t JOIN organization_departments d ON d.id=t.department_id WHERE t.id=? LIMIT 1`,[id]);const item=(rows as Array<{name:string;districtSeq:number}>)[0];if(item){name=item.name;districtSeq=item.districtSeq}}
      else{const [rows]=await db.query(`SELECT name,district_seq AS districtSeq FROM ${table} WHERE id=? LIMIT 1`,[id]);const item=(rows as Array<{name:string;districtSeq:number}>)[0];if(item){name=item.name;districtSeq=item.districtSeq}}
      if(!name){response.status(404).json({message:'삭제할 기본코드를 찾을 수 없습니다.'});return}
      let referenceCount=0;
      if(type==='department'){const [teamRows]=await db.query('SELECT COUNT(*) AS count FROM organization_teams WHERE department_id=?',[id]);const [profileRows]=await db.query(`SELECT COUNT(*) AS count FROM app_user_profiles p JOIN app_users u ON u.id=p.user_id WHERE u.district_seq=? AND p.department=?`,[districtSeq,name]);referenceCount=Number((teamRows as Array<{count:number}>)[0].count)+Number((profileRows as Array<{count:number}>)[0].count)}
      if(type==='team'){const [rows]=await db.query(`SELECT COUNT(*) AS count FROM app_user_profiles p JOIN app_users u ON u.id=p.user_id WHERE u.district_seq=? AND p.team=?`,[districtSeq,name]);referenceCount=Number((rows as Array<{count:number}>)[0].count)}
      if(type==='jobPosition'){const [rows]=await db.query(`SELECT COUNT(*) AS count FROM app_user_profiles p JOIN app_users u ON u.id=p.user_id WHERE u.district_seq=? AND p.job_position=?`,[districtSeq,name]);referenceCount=Number((rows as Array<{count:number}>)[0].count)}
      if(type==='position'){const [rows]=await db.query(`SELECT COUNT(*) AS count FROM app_user_profiles p JOIN app_users u ON u.id=p.user_id WHERE u.district_seq=? AND p.position_title=?`,[districtSeq,name]);referenceCount=Number((rows as Array<{count:number}>)[0].count)}
      if(referenceCount>0){response.status(409).json({message:`${referenceCount}개의 조직 또는 계정에서 사용 중이므로 삭제할 수 없습니다. 먼저 사용중지해 주세요.`});return}
      await db.query(`DELETE FROM ${table} WHERE id=?`,[id]);
      response.json({message:'기본코드를 삭제했습니다.'});
    }catch(error){response.status(409).json({message:(error as {code?:string}).code==='ER_ROW_IS_REFERENCED_2'?'다른 데이터에서 사용 중이므로 삭제할 수 없습니다.':'기본코드를 삭제하지 못했습니다.'})}
  });

  app.get('/supervisor/api/districts', async (request, response) => {
    if (!getSupervisorAuth(request)) {
      response.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    const districts = await loadDistricts(db);
    response.json({ districts });
  });

  app.get('/supervisor/api/settings', async (request, response) => {
    if (!getSupervisorAuth(request)) {
      response.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    const districtSeq = Number(request.query.districtSeq);
    if (!Number.isInteger(districtSeq) || districtSeq <= 0) {
      response.status(400).json({ message: '지자체를 선택해 주세요.' });
      return;
    }

    try {
      const district = await ensureDistrictExists(db, districtSeq);
      const setting = await loadSetting(db, districtSeq);
      response.json({ district, setting });
    } catch (error) {
      response.status(404).json({ message: error instanceof Error ? error.message : '조회에 실패했습니다.' });
    }
  });

  app.get('/supervisor/api/settings-grid', async (request, response) => {
    if (!getSupervisorAuth(request)) {
      response.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    try {
      const fieldConfigs = await loadFieldConfigs(db);
      const filters: Record<string, string> = {};
      for (const key of FIELD_KEYS) {
        const value = String(request.query[key] ?? '').trim();
        if (value) {
          filters[key] = value;
        }
      }

      const rows = await loadSettingsGrid(db, filters, fieldConfigs);
      response.json({ rows });
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : 'Grid 조회에 실패했습니다.' });
    }
  });

  app.get('/supervisor/api/field-configs', async (request, response) => {
    if (!getSupervisorAuth(request)) {
      response.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    const configs = await loadFieldConfigs(db);
    response.json({ configs });
  });

  app.post('/supervisor/api/field-configs', async (request, response) => {
    if (!getSupervisorAuth(request)) {
      response.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    try {
      const configs = normalizeFieldConfigs(request.body.configs);
      await saveFieldConfigs(db, configs);
      const updated = await loadFieldConfigs(db);
      response.json({ message: '관리항목이 저장되었습니다.', configs: updated });
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : '관리항목 저장에 실패했습니다.' });
    }
  });

  app.post('/supervisor/api/settings', async (request, response, next) => {
    if (!getSupervisorAuth(request)) {
      response.status(401).json({ message: '로그인이 필요합니다.' });
      return;
    }

    upload.single('image')(request, response, async (uploadError) => {
      if (uploadError) {
        next(uploadError);
        return;
      }

      try {
        const fieldConfigs = await loadFieldConfigs(db);
        const districtSeq = String(request.body.districtSeq ?? '');
        const existingSeq = Number(districtSeq);
        const existingSetting = Number.isInteger(existingSeq) && existingSeq > 0
          ? await loadSetting(db, existingSeq)
          : null;
        const imagePath = request.file ? `/uploads/${request.file.filename}` : existingSetting?.imagePath ?? null;

        const payload = validateSupervisorForm({
          districtSeq,
          districtUniqueNumber: String(request.body.districtUniqueNumber ?? ''),
          districtUniqueNumberCopy: String(request.body.districtUniqueNumberCopy ?? ''),
          bankName: String(request.body.bankName ?? ''),
          accountNumber: String(request.body.accountNumber ?? ''),
          contractDate: String(request.body.contractDate ?? ''),
          contractFrom: String(request.body.contractFrom ?? ''),
          contractTo: String(request.body.contractTo ?? ''),
          contractStatus: String(request.body.contractStatus ?? '미계약'),
          managerName: String(request.body.managerName ?? ''),
          managerEmail: String(request.body.managerEmail ?? ''),
          managerPhone: String(request.body.managerPhone ?? ''),
          managerMobile: String(request.body.managerMobile ?? ''),
          subscriptionStatus: String(request.body.subscriptionStatus ?? ''),
          billingCycle: String(request.body.billingCycle ?? ''),
          imagePath,
        }, fieldConfigs);

        await ensureDistrictExists(db, payload.districtSeq);

        await db.query(
          `
            INSERT INTO supervisor_basic_settings (
              district_seq,
              district_unique_number,
              district_unique_number_copy,
              bank_name,
              account_number,
              contract_date,
              contract_from,
              contract_to,
              contract_status,
              manager_name,
              manager_email,
              manager_phone,
              manager_mobile,
              subscription_status,
              billing_cycle,
              image_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              district_unique_number = VALUES(district_unique_number),
              district_unique_number_copy = VALUES(district_unique_number_copy),
              bank_name = VALUES(bank_name),
              account_number = VALUES(account_number),
              contract_date = VALUES(contract_date),
              contract_from = VALUES(contract_from),
              contract_to = VALUES(contract_to),
              contract_status = VALUES(contract_status),
              manager_name = VALUES(manager_name),
              manager_email = VALUES(manager_email),
              manager_phone = VALUES(manager_phone),
              manager_mobile = VALUES(manager_mobile),
              subscription_status = VALUES(subscription_status),
              billing_cycle = VALUES(billing_cycle),
              image_path = VALUES(image_path)
          `,
          [
            payload.districtSeq,
            payload.districtUniqueNumber,
            payload.districtUniqueNumberCopy,
            payload.bankName,
            payload.accountNumber,
            payload.contractDate,
            payload.contractFrom,
            payload.contractTo,
            payload.contractStatus,
            payload.managerName,
            payload.managerEmail,
            payload.managerPhone,
            payload.managerMobile,
            payload.subscriptionStatus,
            payload.billingCycle,
            payload.imagePath,
          ],
        );

        const setting = await loadSetting(db, payload.districtSeq);
        response.json({ message: '저장되었습니다.', setting });
      } catch (error) {
        response.status(400).json({ message: error instanceof Error ? error.message : '저장에 실패했습니다.' });
      }
    });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      response.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof Error && error.message) {
      response.status(400).json({ message: error.message });
      return;
    }

    response.status(500).json({ message: '알 수 없는 오류가 발생했습니다.' });
  });
}
