import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const credPath = path.join(os.homedir(), '.claude', '.credentials.json');

console.log(`[1] 자격 증명 파일 경로 확인: ${credPath}`);

if (!fs.existsSync(credPath)) {
  console.error('[오류] 자격 증명 파일이 존재하지 않습니다. Claude Code에 로그인되어 있는지 확인해주세요.');
  process.exit(1);
}

let credentials;
try {
  const raw = fs.readFileSync(credPath, 'utf8');
  credentials = JSON.parse(raw);
} catch (err) {
  console.error('[오류] 자격 증명 파일 파싱 실패:', err.message);
  process.exit(1);
}

// 키 구조 탐색 (토큰 값은 절대 출력하지 않음)
const topKeys = Object.keys(credentials);
console.log('[2] 발견된 키 목록:', topKeys);

// Claude Code의 자격 증명 구조 파악 (일반적으로 claudeAiOauthToken 또는 oauthAccessToken 등)
let accessToken = null;

if (credentials.claudeAiOauthToken) {
  accessToken = credentials.claudeAiOauthToken;
  console.log('[3] 토큰 발견: claudeAiOauthToken 키 사용');
} else if (credentials.accessToken) {
  accessToken = credentials.accessToken;
  console.log('[3] 토큰 발견: accessToken 키 사용');
} else if (credentials.oauthAccessToken) {
  accessToken = credentials.oauthAccessToken;
  console.log('[3] 토큰 발견: oauthAccessToken 키 사용');
} else {
  // 중첩 구조 탐색
  for (const k of topKeys) {
    if (typeof credentials[k] === 'object' && credentials[k] !== null) {
      console.log(` - 중첩 객체 [${k}] 하위 키:`, Object.keys(credentials[k]));
      if (credentials[k].accessToken) {
        accessToken = credentials[k].accessToken;
        console.log(`[3] 토큰 발견: ${k}.accessToken 사용`);
        break;
      }
    }
  }
}

if (!accessToken) {
  console.error('[오류] 유효한 액세스 토큰 필드를 찾을 수 없습니다.');
  process.exit(1);
}

console.log('[4] API 호출 시도 (GET https://api.anthropic.com/api/oauth/usage)...');

try {
  const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'User-Agent': 'sideproj-status-widget/0.1.0'
    }
  });

  console.log(`[5] HTTP 응답 상태: ${res.status} ${res.statusText}`);

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    console.log('[6] 응답 JSON 구조:');
    console.log(JSON.stringify(json, (key, value) => {
      // 민감할 수 있는 ID/이메일 마스킹
      if (typeof value === 'string' && (key.includes('token') || key.includes('secret') || key.includes('email'))) {
        return '***MASKED***';
      }
      return value;
    }, 2));
  } catch {
    console.log('[6] 응답 본문 (텍스트):', text.slice(0, 500));
  }
} catch (err) {
  console.error('[오류] API 호출 중 예외 발생:', err.message);
}
