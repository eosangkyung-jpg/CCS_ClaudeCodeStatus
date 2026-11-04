const fs = require('fs');
const path = require('path');
const os = require('os');

function getCredentialsPath() {
  return path.join(os.homedir(), '.claude', '.credentials.json');
}

// macOS: Claude Code는 로그인 정보를 키체인 항목 'Claude Code-credentials'에 저장한다 (읽기만 함).
// 처음 읽을 때 macOS가 '키체인 접근 허용' 창을 한 번 띄운다.
function readMacKeychainCredentials() {
  const { execFileSync } = require('child_process');
  try {
    const out = execFileSync('security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], {
      encoding: 'utf8',
      timeout: 10000,
    }).trim();
    return out ? JSON.parse(out) : null;
  } catch (err) {
    return null;
  }
}

function readCredentials() {
  if (process.platform === 'darwin') {
    const fromKeychain = readMacKeychainCredentials();
    if (fromKeychain) return fromKeychain;
  }
  // Windows(및 키체인에 없을 때의 macOS): ~/.claude/.credentials.json
  const credPath = getCredentialsPath();
  if (!fs.existsSync(credPath)) {
    throw new Error(process.platform === 'darwin'
      ? 'Claude Code 로그인 정보를 키체인에서 찾을 수 없습니다.'
      : 'Claude Code 자격 증명 파일을 찾을 수 없습니다 (%USERPROFILE%\\.claude\\.credentials.json).');
  }
  return JSON.parse(fs.readFileSync(credPath, 'utf8').replace(/^\uFEFF/, ''));
}

function readAccessToken() {
  const credentials = readCredentials();

  if (credentials.claudeAiOauth && credentials.claudeAiOauth.accessToken) {
    return credentials.claudeAiOauth.accessToken;
  }
  if (credentials.claudeAiOauthToken) {
    return credentials.claudeAiOauthToken;
  }
  if (credentials.accessToken) {
    return credentials.accessToken;
  }
  throw new Error('자격 증명 파일에 유효한 accessToken이 없습니다.');
}

// 참고: image/iconFile은 대비용 기본값. 실제 사진은 위젯이 무작위 배정한 값(settings.tierCatMap)을 main.js가 우선 사용함.
function resolveState(sessionPercent) {
  const p = Math.round(sessionPercent);

  if (p < 30) {
    return {
      id: 'state_0_30',
      label: '여유',
      badgeColor: '#10b981', // 초록
      image: '../assets/images/cat4.jpg',
      iconFile: 'cat4.jpg',
      quote: '토큰 넉넉해요! 뭐든 시켜주세요.',
      isOverLimit: false,
    };
  } else if (p < 60) {
    return {
      id: 'state_30_60',
      label: '안정',
      badgeColor: '#3b82f6', // 파랑
      image: '../assets/images/cat5.jpg',
      iconFile: 'cat5.jpg',
      quote: '순항 중입니다. 페이스 적당해요.',
      isOverLimit: false,
    };
  } else if (p < 80) {
    return {
      id: 'state_60_80',
      label: '조금 빠름',
      badgeColor: '#f59e0b', // 주황
      image: '../assets/images/cat11.jpg',
      iconFile: 'cat11.jpg',
      quote: '절반을 훌쩍 넘었어요. 긴 프롬프트 주의!',
      isOverLimit: false,
    };
  } else if (p < 90) {
    return {
      id: 'state_80_90',
      label: '빠름',
      badgeColor: '#f97316', // 진한 주황
      image: '../assets/images/cat6.jpg',
      iconFile: 'cat6.jpg',
      quote: '간당간당합니다... 제발 리셋까지 버텨줘',
      isOverLimit: false,
    };
  } else if (p < 95) {
    return {
      id: 'state_90_94',
      label: '멈춰!',
      badgeColor: '#ef4444', // 빨강
      image: '../assets/images/cat9.jpg',
      iconFile: 'cat9.jpg',
      quote: '진짜 마지막 경고! 지금 쏘면 끝장납니다!',
      isOverLimit: false,
    };
  } else {
    // 95% ~ 100%
    const isOver = p >= 100;
    return {
      id: 'state_95_100',
      label: isOver ? '소진' : '위기',
      badgeColor: '#8b5cf6', // 보라 / 위험
      image: '../assets/images/cat1.jpg',
      iconFile: 'cat1.jpg',
      quote: isOver ? '한도가 소진되었습니다. 쿨다운 대기 중...' : '95% 도달! 곧 뻗습니다!',
      isOverLimit: isOver,
    };
  }
}

function calculatePace(sessionPercent, resetsAt) {
  if (!resetsAt || typeof sessionPercent !== 'number') {
    return null;
  }

  const resetTarget = new Date(resetsAt).getTime();
  const now = Date.now();
  const diffMs = resetTarget - now;

  // 5시간 세션 = 300분 = 18,000,000ms
  const TOTAL_SESSION_MS = 5 * 60 * 60 * 1000;
  
  // 리셋 시각이 비정상이거나 이미 리셋 시간을 초과한 경우
  if (diffMs <= 0 || diffMs > TOTAL_SESSION_MS) {
    return null;
  }

  const elapsedMs = TOTAL_SESSION_MS - diffMs;
  const elapsedMinutes = elapsedMs / (1000 * 60);

  // 세션 시작 15분 미만인 경우 초기 표본 부족으로 '측정 중' 반환
  if (elapsedMinutes < 15) {
    return {
      ratio: 1.0,
      tier: 'measuring',
      badge: '⏱️ 페이스 측정 중',
      badgeColor: '#64748b',
      text: '세션 초반(15분 미만)이라 페이스를 계산 중입니다.',
    };
  }

  const timeElapsedRatio = elapsedMs / TOTAL_SESSION_MS; // 0.0 ~ 1.0
  const timeElapsedPercent = Math.max(1, timeElapsedRatio * 100);

  // 페이스 비율 = 사용률 / 시간경과율
  const paceRatio = sessionPercent / timeElapsedPercent;

  if (paceRatio < 0.8) {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'relaxed',
      badge: '🌱 여유로운 페이스',
      badgeColor: '#10b981', // 초록
      text: '시간 대비 사용량이 적어 여유로워요.',
    };
  } else if (paceRatio <= 1.2) {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'optimal',
      badge: '🟢 적정 페이스',
      badgeColor: '#3b82f6', // 파랑
      text: '리셋 주기와 딱 맞는 안정적인 템포입니다.',
    };
  } else if (paceRatio <= 1.6) {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'fast',
      badge: '🟡 조금 빠른 편',
      badgeColor: '#f59e0b', // 주황
      text: '소모 속도가 조금 빨라요. 긴 프롬프트 주의!',
    };
  } else {
    return {
      ratio: Math.round(paceRatio * 100) / 100,
      tier: 'overdrive',
      badge: '⚡ 매우 빠름 (주의)',
      badgeColor: '#ef4444', // 빨강
      text: '소모가 너무 급격해요! 곧 한도에 걸릴 위험이 있습니다!',
    };
  }
}

async function fetchUsageData() {
  let token;
  try {
    token = readAccessToken();
  } catch (err) {
    return {
      success: false,
      errorCode: 'NO_CREDENTIALS',
      errorMessage: 'Claude Code 로그인이 필요합니다.',
      errorGuide: process.platform === 'darwin'
        ? '터미널에서 `claude`를 실행해 로그인한 뒤, 키체인 접근을 허용해 주세요.'
        : '터미널(PowerShell/CMD)에서 `claude`를 실행하여 로그인한 후 다시 시도해주세요.',
    };
  }

  let response;
  try {
    response = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': `CCS-ClaudeCodeStatus/${require('../../package.json').version}`,
      },
    });
  } catch (err) {
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage: '네트워크 연결 또는 API 응답 오류',
      errorGuide: '인터넷 연결 상태를 확인하거나 잠시 후 다시 시도해주세요.',
    };
  }

  if (response.status === 401) {
    return {
      success: false,
      errorCode: 'AUTH_EXPIRED',
      errorMessage: 'Claude Code 로그인 인증이 만료되었습니다.',
      errorGuide: '터미널에서 `claude`를 실행하여 다시 로그인해주세요.',
    };
  }

  if (!response.ok) {
    return {
      success: false,
      errorCode: 'API_ERROR',
      errorMessage: `사용량 API 호출 실패 (${response.status})`,
      errorGuide: 'Anthropic 서비스 상태를 확인하거나 잠시 후 새로고침해주세요.',
    };
  }

  const data = await response.json();

  const sessionPercent = data.five_hour?.utilization ?? 0;
  const sessionResetsAt = data.five_hour?.resets_at ?? null;

  const weeklyPercent = data.seven_day?.utilization ?? 0;
  const weeklyResetsAt = data.seven_day?.resets_at ?? null;

  const stateInfo = resolveState(sessionPercent);
  const paceInfo = calculatePace(sessionPercent, sessionResetsAt);

  return {
    success: true,
    session: {
      percent: sessionPercent,
      resetsAt: sessionResetsAt,
    },
    weekly: {
      percent: weeklyPercent,
      resetsAt: weeklyResetsAt,
    },
    state: stateInfo,
    pace: paceInfo,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchUsageData,
  resolveState,
  calculatePace,
};
