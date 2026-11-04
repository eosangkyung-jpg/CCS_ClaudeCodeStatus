const characterImg = document.getElementById('characterImg');
const characterCard = document.getElementById('characterCard');
const statusBadge = document.getElementById('statusBadge');
const sessionVal = document.getElementById('sessionVal');
const sessionBar = document.getElementById('sessionBar');
const resetTime = document.getElementById('resetTime');
const weeklyVal = document.getElementById('weeklyVal');
const quoteText = document.getElementById('quoteText');
const percentChip = document.getElementById('percentChip');
const badgeGaugeFill = document.getElementById('badgeGaugeFill');
const characterWrapperEl = document.getElementById('characterWrapper');
const badgeResetTime = document.getElementById('badgeResetTime');
const refreshBtn = document.getElementById('refreshBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingOpenAtLogin = document.getElementById('settingOpenAtLogin');
const paceRow = document.getElementById('paceRow');
const paceBadge = document.getElementById('paceBadge');
const normalBubbleBody = document.getElementById('normalBubbleBody');
const errorCard = document.getElementById('errorCard');
const errorTitle = document.getElementById('errorTitle');
const errorDesc = document.getElementById('errorDesc');
const errorRetryBtn = document.getElementById('errorRetryBtn');

const weeklyBar = document.getElementById('weeklyBar');
const weeklyResetTime = document.getElementById('weeklyResetTime');
const weeklyStatus = document.getElementById('weeklyStatus');

// 주간 한도 상태 문구: 세션 구간(CLAUDE.md 2.2)과 같은 경계값을 사용
function getWeeklyStatusText(percent) {
  if (percent >= 100) return '주간 한도 소진';
  if (percent >= 95) return '주간 한도 임박';
  if (percent >= 80) return '주간 위험 구간';
  if (percent >= 60) return '주간 주의 구간';
  if (percent >= 30) return '주간 누적 안정';
  return '주간 누적 여유';
}

let lastUsagePayload = null;
let currentResetTimestamp = null;
let countdownInterval = null;
let lastUsageFailed = false;

// 막대(role=progressbar)의 현재 값을 화면 낭독기에 전달
function setBarValue(bar, percent) {
  const track = bar && bar.parentElement;
  if (!track || track.getAttribute('role') !== 'progressbar') return;
  track.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, Math.round(percent)))));
}

function isSettingsOpen() {
  return !!settingsPanel && settingsPanel.style.display !== 'none';
}

// 말풍선 본문 영역은 [설정 패널 | 사용량 본문 | 에러 카드] 중 하나만 보인다.
// 창 높이가 고정이라 둘 이상 동시에 보이면 말풍선 상단이 창 밖으로 잘린다.
function syncBubbleBodyVisibility() {
  const settingsOpen = isSettingsOpen();
  if (normalBubbleBody) normalBubbleBody.style.display = settingsOpen || lastUsageFailed ? 'none' : 'block';
  if (errorCard) errorCard.style.display = !settingsOpen && lastUsageFailed ? 'flex' : 'none';
}

function setSettingsOpen(open) {
  if (!settingsPanel) return;
  const wasOpen = isSettingsOpen();
  settingsPanel.style.display = open ? 'block' : 'none';
  // 설정을 열면 위젯을 활성화해 바로 휠 스크롤 가능, 닫으면 포커스를 놓아 원래 창으로
  if (open !== wasOpen && window.widgetAPI && window.widgetAPI.setWindowFocus) {
    window.widgetAPI.setWindowFocus(open);
  }
  if (settingsBtn) settingsBtn.setAttribute('aria-expanded', String(open));
  syncBubbleBodyVisibility();
}

function formatRemainingTime(isoString) {
  if (!isoString) return '리셋 시각 정보 없음';
  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return '곧 리셋됨';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}시간 ${minutes}분 후 초기화`;
  }
  return `${minutes}분 ${seconds}초 후 초기화`;
}

function formatWeeklyResetTime(isoString) {
  if (!isoString) return '주간 리셋 정보 없음';
  const target = new Date(isoString).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return '주간 한도 리셋됨';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}일 ${hours}시간 후 리셋`;
  }
  return `${hours}시간 후 리셋`;
}

// 사원증 오른쪽 아래: 5시간 세션 리셋까지 남은 시간 (01:23:45, 1초마다 갱신)
function updateCountdownText() {
  if (!currentResetTimestamp) {
    badgeResetTime.textContent = '--:--:--';
    return;
  }
  const target = new Date(currentResetTimestamp).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
  const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
  const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');

  badgeResetTime.textContent = `${hours}:${minutes}:${seconds}`;
}

function interpolatePinkRed(percent) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));

  if (p < 50) {
    return {
      textColor: '#ffffff',
      dotColor: '#ffffff',
      barGradient: '#ffffff',
      glow: 'none',
      borderColor: '#1c1f2a',
    };
  } else if (p < 80) {
    return {
      textColor: '#fb7185',
      dotColor: '#fb7185',
      barGradient: 'linear-gradient(90deg, #ffffff 0%, #fda4af 40%, #fb7185 100%)',
      glow: '0 0 8px rgba(251, 113, 133, 0.4)',
      borderColor: '#3b1c28',
    };
  } else {
    return {
      textColor: '#f43f5e',
      dotColor: '#f43f5e',
      barGradient: 'linear-gradient(90deg, #ffffff 0%, #fda4af 20%, #fb7185 55%, #e11d48 100%)',
      glow: '0 0 10px rgba(225, 29, 72, 0.6)',
      borderColor: '#4c1322',
    };
  }
}

const TIER_KEYS = [
  'state_0_30',
  'state_30_60',
  'state_60_80',
  'state_80_90',
  'state_90_94',
  'state_95_100',
];

// 단계별 고양이 사진 풀 (2026-11-05 확정, CLAUDE.md 2.2). 각 단계는 자기 풀 안에서만 무작위 배정.
// 95~100%는 한 묶음: 100%가 되면 같은 사진이 흑백 + 영정 띠 + 카운트다운으로 바뀐다.
const TIER_POOLS = {
  state_0_30: [4, 10, 19, 23, 37, 38, 39, 52], // 여유
  state_30_60: [5, 15, 18, 31, 32, 33, 54], // 안정
  state_60_80: [11, 12, 24, 27, 28, 50, 51], // 조금 빠름
  state_80_90: [6, 29, 30, 43, 46, 48, 55, 60], // 빠름
  state_90_94: [9, 14, 17, 21, 22, 49], // 멈춰!
  state_95_100: [1, 2, 7, 8, 20, 25, 36, 40, 44, 45, 47, 57, 61], // 위기·소진
};
// Claude Code 작업 중에만 나오는 사진 (단계 풀에는 넣지 않음)
const WORKING_POOL = [3, 13, 16, 26, 35, 41, 42, 53, 56, 58, 59];

const catFile = (n) => `cat${n}.jpg`;

// 풀에서 무작위 1장. 직전 사진(avoid)은 가능하면 피한다.
function pickFrom(pool, avoid) {
  const files = pool.map(catFile);
  const candidates = files.length > 1 ? files.filter((f) => f !== avoid) : files;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function buildTierCatMap(previous) {
  const map = {};
  TIER_KEYS.forEach((tier) => {
    map[tier] = pickFrom(TIER_POOLS[tier], previous && previous[tier]);
  });
  return map;
}

function initializeTierCatMap() {
  const STORAGE_KEY = 'sideproj_tier_cat_map';
  let map = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      map = JSON.parse(saved);
      // 저장된 배정이 지금 풀 규칙에 맞는지 확인 (예전 완전 랜덤 배정이면 새로 뽑음)
      const valid = TIER_KEYS.every((k) => map && TIER_POOLS[k].map(catFile).includes(map[k]));
      if (!valid) map = null;
    }
  } catch (e) {
    map = null;
  }

  if (!map) {
    map = buildTierCatMap(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {}
  }
  return map;
}

// 시스템 알림(main 프로세스)도 같은 사진을 쓰도록 배정 정보를 본체에 전달
function syncTierCatMapToMain(map) {
  if (window.widgetAPI && window.widgetAPI.syncTierCatMap) {
    window.widgetAPI.syncTierCatMap(map);
  }
}

let currentTierCatMap = initializeTierCatMap();
syncTierCatMapToMain(currentTierCatMap);

// Claude Code 작업 상태와 작업 중 사진 (작업 한 번에 1장 고정)
let currentActivity = 'idle';
let currentWorkingCat = null;

function setWorkingActivity(state) {
  const wasActive = currentActivity === 'working' || currentActivity === 'waiting';
  const isActive = state === 'working' || state === 'waiting';
  if (isActive && !wasActive) currentWorkingCat = pickFrom(WORKING_POOL, currentWorkingCat);
  currentActivity = state;
  applyUsageState(lastUsagePayload || { claude: null });
}

function shuffleCatMap() {
  const STORAGE_KEY = 'sideproj_tier_cat_map';
  const map = buildTierCatMap(currentTierCatMap);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
  currentTierCatMap = map;
  syncTierCatMapToMain(map);
  // 작업 중이면 작업 중 사진도 새로 뽑음
  if (currentWorkingCat) currentWorkingCat = pickFrom(WORKING_POOL, currentWorkingCat);

  applyUsageState(lastUsagePayload || { claude: null });
}

function getCatImageForTier(tierId) {
  return currentTierCatMap[tierId] || catFile(TIER_POOLS[tierId][0]);
}

function getImageDataUri(fileKey) {
  if (window.STATE_IMAGES && window.STATE_IMAGES[fileKey]) {
    return window.STATE_IMAGES[fileKey];
  }
  return `../assets/images/${fileKey}`;
}

function getLocalStateForPercent(percent) {
  const p = Math.round(percent);
  if (p < 30) {
    return {
      id: 'state_0_30',
      label: '여유',
      quote: '토큰 넉넉해요! 뭐든 시켜주세요.',
    };
  } else if (p < 60) {
    return {
      id: 'state_30_60',
      label: '안정',
      quote: '순항 중입니다. 페이스 아주 좋아요.',
    };
  } else if (p < 80) {
    return {
      id: 'state_60_80',
      label: '조금 빠름',
      quote: '절반을 훌쩍 넘었어요. 긴 프롬프트 주의!',
    };
  } else if (p < 90) {
    return {
      id: 'state_80_90',
      label: '빠름',
      quote: '간당간당합니다... 제발 리셋까지 버텨줘 🙏',
    };
  } else if (p < 95) {
    return {
      id: 'state_90_94',
      label: '멈춰!',
      quote: '진짜 마지막 경고! 지금 쏘면 끝장납니다!',
    };
  } else {
    const isOver = p >= 100;
    return {
      id: 'state_95_100',
      label: isOver ? '소진' : '위기',
      quote: isOver ? '한도가 모두 소진되었습니다! 🚨' : '95% 도달! 손 떼세요! 멘붕 직전!',
    };
  }
}

function applyUsageState(data) {
  const p = data && data.claude && data.claude.success ? Math.round(data.claude.session.percent) : 0;

  const hasData = !!(data && data.claude && data.claude.success);
  percentChip.textContent = hasData ? String(p) : '--';
  if (badgeGaugeFill) {
    badgeGaugeFill.style.width = hasData ? `${Math.min(100, Math.max(0, p))}%` : '0%';
  }

  // 퍼센트에 따른 상태 및 이미지 즉시 산출 및 적용
  const state = getLocalStateForPercent(p);

  // 모노크롬 ➔ 로즈 핑크 ➔ 크림슨 레드 동적 테마 적용
  const theme = interpolatePinkRed(p);
  const speechBubble = document.getElementById('speechBubble');
  const statusDot = document.getElementById('statusDot');

  if (speechBubble) speechBubble.style.borderColor = theme.borderColor;
  if (statusDot) {
    statusDot.style.backgroundColor = theme.dotColor;
    statusDot.style.boxShadow = theme.glow;
  }

  // 작업 중(허락 대기 포함)이고 100% 미만이면 작업 중 전용 사진, 아니면 단계 사진
  // 100% 소진은 Claude Code가 사실상 일할 수 없으므로 소진 연출(흑백·영정 띠)을 우선
  const isWorking = (currentActivity === 'working' || currentActivity === 'waiting') && !!currentWorkingCat;
  const showWorking = isWorking && p < 100;
  const imageKey = showWorking ? currentWorkingCat : getCatImageForTier(state.id);
  const imageSrc = getImageDataUri(imageKey);

  const imgElem = document.getElementById('characterImg');
  if (state && imgElem) {
    statusBadge.textContent = state.label;
    quoteText.textContent = `"${state.quote}"`;
    // file:// 프로토콜에서는 쿼리스트링(?t=)이 들어가면 윈도우 파일명을 찾지 못하므로 순수 경로 대입
    if (imgElem.getAttribute('src') !== imageSrc) imgElem.setAttribute('src', imageSrc);
  }

  characterCard.classList.toggle('shake', p >= 95 && p < 100);
  characterCard.classList.toggle('exhausted', p >= 100);
  // 작업 중인데 사용량이 높으면 사진을 붉게: 90~94% 옅게, 95~99% 진하게
  characterCard.classList.toggle('tint-light', showWorking && p >= 90 && p < 95);
  characterCard.classList.toggle('tint-strong', showWorking && p >= 95 && p < 100);
  // 사원증 숫자: 90% 이상이면 빨갛게
  characterWrapperEl.classList.toggle('danger', hasData && p >= 90 && p < 100);
  characterWrapperEl.classList.toggle('exhausted', hasData && p >= 100);

  // 리셋까지 남은 시간은 사용량과 관계없이 항상 표시
  updateCountdownText();
  if (!countdownInterval) countdownInterval = setInterval(updateCountdownText, 1000);
}

function renderUsage(data) {
  lastUsagePayload = data;

  if (!data.success) {
    statusBadge.textContent = '인증/연결 필요';
    statusBadge.style.background = '#ef4444';
    percentChip.textContent = '--';
    currentResetTimestamp = null;
    updateCountdownText();
    characterWrapperEl.classList.remove('danger', 'exhausted');

    lastUsageFailed = true;
    syncBubbleBodyVisibility();

    errorTitle.textContent = data.errorMessage || '데이터를 불러오지 못했습니다.';
    errorDesc.textContent = data.errorGuide || 'Claude Code 로그인 상태를 확인해 주세요.';

    characterCard.classList.remove('shake', 'exhausted', 'tint-light', 'tint-strong');
    return;
  }

  lastUsageFailed = false;
  syncBubbleBodyVisibility();

  // Claude 플랜 사용량 렌더링
  const paceBadge = document.getElementById('paceBadge');
  if (data.claude && data.claude.success) {
    const c = data.claude;
    const sessionP = Math.round(c.session.percent);
    currentResetTimestamp = c.session.resetsAt;

    sessionVal.textContent = `${sessionP}%`;
    sessionBar.style.width = `${Math.min(100, sessionP)}%`;
    setBarValue(sessionBar, sessionP);

    const theme = interpolatePinkRed(sessionP);
    sessionVal.style.color = theme.textColor;
    sessionBar.style.background = theme.barGradient;
    sessionBar.style.boxShadow = theme.glow;

    resetTime.textContent = formatRemainingTime(c.session.resetsAt);

    const weeklyP = Math.round(c.weekly.percent);
    weeklyVal.textContent = `${weeklyP}%`;
    weeklyBar.style.width = `${Math.min(100, weeklyP)}%`;
    setBarValue(weeklyBar, weeklyP);
    weeklyBar.style.background = 'linear-gradient(90deg, #f8fafc, #fda4af)';
    weeklyResetTime.textContent = formatWeeklyResetTime(c.weekly.resetsAt);
    if (weeklyStatus) weeklyStatus.textContent = getWeeklyStatusText(weeklyP);

    if (c.pace && paceBadge) {
      paceBadge.textContent = c.pace.badge;
    }
  } else {
    currentResetTimestamp = null;
    sessionVal.textContent = '미로그인';
    sessionBar.style.width = '0%';
    setBarValue(sessionBar, 0);
    resetTime.textContent = '터미널에서 `claude` 로그인 필요';
    weeklyVal.textContent = '--%';
    weeklyBar.style.width = '0%';
    setBarValue(weeklyBar, 0);
    weeklyResetTime.textContent = '주간 한도 조회 대기';
    if (weeklyStatus) weeklyStatus.textContent = '주간 한도 정보 없음';
  }

  // 고양이 사진·상태 문구·연출 갱신
  applyUsageState(data);
}

// 이벤트 리스너 등록
if (window.widgetAPI) {
  window.widgetAPI.onUsageUpdated((data) => {
    renderUsage(data);
  });

  refreshBtn.addEventListener('click', () => {
    statusBadge.textContent = '갱신 중...';
    window.widgetAPI.requestRefresh();
  });

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.widgetAPI.hideWindow();
    });
  }

  const settingsDoneBtn = document.getElementById('settingsDoneBtn');
  const matrixRows = document.getElementById('matrixRows');
  const presetDanger = document.getElementById('presetDanger');
  const colBubble = document.getElementById('colBubble');
  const colToast = document.getElementById('colToast');

  const TIERS = [
    { id: 'state_0_30', label: '0~30%' },
    { id: 'state_30_60', label: '30~60%' },
    { id: 'state_60_80', label: '60~80%' },
    { id: 'state_80_90', label: '80~90%' },
    { id: 'state_90_94', label: '90~94%' },
    { id: 'state_95_99', label: '95~99%' },
    { id: 'state_100', label: '100% 소진' },
    { id: 'state_reset', label: '리셋 완료' },
  ];

  let currentAlertRules = {};

  function renderMatrix(rules) {
    if (!matrixRows) return;
    currentAlertRules = rules || {};
    matrixRows.innerHTML = '';

    TIERS.forEach((tier) => {
      const rule = currentAlertRules[tier.id] || { bubble: true, toast: true };
      const row = document.createElement('div');
      row.className = 'matrix-row';

      row.innerHTML = `
        <span class="tier-name">${tier.label}</span>
        <label class="matrix-cell"><input type="checkbox" data-tier="${tier.id}" data-type="bubble" aria-label="${tier.label} 말풍선 알림" ${rule.bubble ? 'checked' : ''}></label>
        <label class="matrix-cell"><input type="checkbox" data-tier="${tier.id}" data-type="toast" aria-label="${tier.label} 시스템 알림" ${rule.toast ? 'checked' : ''}></label>
      `;
      matrixRows.appendChild(row);
    });
    syncColumnToggles();

    matrixRows.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const tier = cb.getAttribute('data-tier');
        const type = cb.getAttribute('data-type');
        if (!currentAlertRules[tier]) currentAlertRules[tier] = { bubble: true, toast: true };
        currentAlertRules[tier][type] = cb.checked;
        syncColumnToggles();
        window.widgetAPI.updateSettings({ alertRules: currentAlertRules });
      });
    });
  }

  // 열 제목 체크박스: 열 전체 켜기/끄기. 일부만 켜져 있으면 '일부 선택(–)' 표시
  function syncColumnToggles() {
    [[colBubble, 'bubble'], [colToast, 'toast']].forEach(([box, type]) => {
      if (!box) return;
      const onCount = TIERS.filter((t) => (currentAlertRules[t.id] || { [type]: true })[type]).length;
      box.checked = onCount === TIERS.length;
      box.indeterminate = onCount > 0 && onCount < TIERS.length;
    });
  }

  function setColumn(type, on) {
    TIERS.forEach((tier) => {
      const prev = currentAlertRules[tier.id] || { bubble: true, toast: true };
      currentAlertRules[tier.id] = { ...prev, [type]: on };
    });
    renderMatrix(currentAlertRules);
    window.widgetAPI.updateSettings({ alertRules: currentAlertRules });
  }

  if (colBubble) colBubble.addEventListener('change', () => setColumn('bubble', colBubble.checked));
  if (colToast) colToast.addEventListener('change', () => setColumn('toast', colToast.checked));

  function applyPreset(presetType) {
    TIERS.forEach((tier) => {
      if (!currentAlertRules[tier.id]) currentAlertRules[tier.id] = { bubble: true, toast: true };
      if (presetType === 'danger') {
        const isDanger = ['state_80_90', 'state_90_94', 'state_95_99', 'state_100', 'state_reset'].includes(tier.id);
        currentAlertRules[tier.id] = { bubble: isDanger, toast: isDanger };
      }
    });
    renderMatrix(currentAlertRules);
    window.widgetAPI.updateSettings({ alertRules: currentAlertRules });
  }

  if (presetDanger) presetDanger.addEventListener('click', () => applyPreset('danger'));
  if (settingsDoneBtn && settingsPanel) {
    settingsDoneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setSettingsOpen(false);
    });
  }

  // 알림 설정 패널 토글 및 본문 배타적 스위칭 (상단 잘림 원천 차단)
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setSettingsOpen(!isSettingsOpen());
    });
  }

  if (settingOpenAtLogin) {
    settingOpenAtLogin.addEventListener('change', () => {
      window.widgetAPI.updateSettings({ openAtLogin: settingOpenAtLogin.checked });
    });
  }

  if (errorRetryBtn) {
    errorRetryBtn.addEventListener('click', () => {
      statusBadge.textContent = '확인 중...';
      window.widgetAPI.requestRefresh();
    });
  }

  // Claude Code 작업 중 스피너 배지
  const activityBadge = document.getElementById('activityBadge');
  const activitySpinner = document.getElementById('activitySpinner');
  const activityText = document.getElementById('activityText');
  const srActivity = document.getElementById('srActivity');
  const SPINNER_FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let effectsOff = false; // 설정 '경고 효과: 끄기'
  let spinnerTimer = null;
  let spinnerIndex = 0;
  let lastActivity = 'idle';

  function setActivity(state) {
    if (!activityBadge) return;
    const active = state === 'working' || state === 'waiting';
    activityBadge.hidden = !active;
    activityBadge.classList.toggle('waiting', state === 'waiting');
    if (activityText) activityText.textContent = state === 'waiting' ? '허락 기다리는 중🐾' : '작업 중…';

    if (active && !reduceMotion && !effectsOff && state === 'working') {
      if (!spinnerTimer) {
        spinnerTimer = setInterval(() => {
          spinnerIndex = (spinnerIndex + 1) % SPINNER_FRAMES.length;
          activitySpinner.textContent = SPINNER_FRAMES[spinnerIndex];
        }, 120);
      }
    } else {
      if (spinnerTimer) clearInterval(spinnerTimer);
      spinnerTimer = null;
      if (activitySpinner) activitySpinner.textContent = state === 'waiting' ? '✋' : '✶';
    }

    // 화면 낭독기에는 상태가 바뀔 때만 알림 (프레임마다 읽지 않음)
    if (srActivity && state !== lastActivity) {
      srActivity.textContent = state === 'working' ? 'Claude Code 작업 중' : state === 'waiting' ? 'Claude Code가 허락을 기다리는 중' : 'Claude Code 작업 끝';
    }
    lastActivity = state;
    setWorkingActivity(state);
  }
  if (window.widgetAPI.onActivityUpdated) window.widgetAPI.onActivityUpdated(setActivity);

  // 설정: Claude Code 작업 표시(훅) 켜기/끄기
  const claudeHooksButtons = [...document.querySelectorAll('.hooks-btn')];
  let claudeHooksInstalled = false;
  function renderClaudeHooks(installed) {
    claudeHooksInstalled = installed;
    claudeHooksButtons.forEach((btn) => {
      const selected = btn.dataset.hooks === (installed ? 'on' : 'off');
      btn.setAttribute('aria-checked', String(selected));
      btn.tabIndex = selected ? 0 : -1;
    });
  }
  claudeHooksButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const wantInstall = btn.dataset.hooks === 'on';
      if (wantInstall === claudeHooksInstalled) return;

      claudeHooksButtons.forEach(b => b.disabled = true);
      const result = await window.widgetAPI.setClaudeHooks(wantInstall);
      claudeHooksButtons.forEach(b => b.disabled = false);

      if (result && !result.ok) {
        const srAnnounce = document.getElementById('srAnnounce');
        if (srAnnounce) srAnnounce.textContent = result.error;
        btn.title = result.error;
      } else {
        renderClaudeHooks(wantInstall);
      }
    });
  });
  const hooksGroup = document.getElementById('claudeHooksOptions');
  if (hooksGroup) {
    hooksGroup.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = claudeHooksButtons.find((b) => b.getAttribute('aria-checked') !== 'true');
      if (next) { next.focus(); next.click(); }
    });
  }

  // 경고 효과: 기본 / 끄기
  const effectsButtons = [...document.querySelectorAll('.effects-btn')];
  function renderEffects(mode) {
    effectsOff = mode === 'off';
    document.body.classList.toggle('effects-off', effectsOff);
    effectsButtons.forEach((btn) => {
      const selected = btn.dataset.effects === (effectsOff ? 'off' : 'default');
      btn.setAttribute('aria-checked', String(selected));
      btn.tabIndex = selected ? 0 : -1;
    });
    setActivity(lastActivity); // 스피너 회전 여부 다시 적용
  }
  effectsButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderEffects(btn.dataset.effects);
      window.widgetAPI.updateSettings({ warningEffects: btn.dataset.effects });
    });
  });
  const effectsGroup = document.getElementById('effectsOptions');
  if (effectsGroup) {
    effectsGroup.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = effectsButtons.find((b) => b.getAttribute('aria-checked') !== 'true');
      if (next) { next.focus(); next.click(); }
    });
  }

  // 글자 크기: 화면 확대 + 창 크기를 같은 비율로 변경 (main 프로세스가 처리)
  const scaleButtons = [...document.querySelectorAll('.scale-btn[data-scale]')];
  function renderUiScale(scale, maxScale) {
    scaleButtons.forEach((btn) => {
      const value = Number(btn.dataset.scale);
      const selected = value === scale;
      btn.setAttribute('aria-checked', String(selected));
      btn.tabIndex = selected ? 0 : -1;
      btn.disabled = value > maxScale;
      btn.title = btn.disabled ? '이 화면에서는 창이 다 들어가지 않아 선택할 수 없어요' : '';
    });
  }
  scaleButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.widgetAPI.setUiScale(Number(btn.dataset.scale));
    });
  });
  // 라디오 그룹: 좌우 방향키로 이동·선택
  const scaleGroup = document.querySelector('.scale-options');
  if (scaleGroup) {
    scaleGroup.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const enabled = scaleButtons.filter((b) => !b.disabled);
      const i = enabled.indexOf(document.activeElement);
      const next = enabled[(i + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
      if (next) { next.focus(); next.click(); }
    });
  }

  if (window.widgetAPI.onSettingsUpdated) {
    window.widgetAPI.onSettingsUpdated((settings) => {
      if (settingOpenAtLogin) settingOpenAtLogin.checked = !!settings.openAtLogin;
      renderUiScale(settings.uiScale || 1, settings.maxUiScale || 1.5);
      renderClaudeHooks(!!settings.claudeHooksInstalled);
      renderEffects(settings.warningEffects === 'off' ? 'off' : 'default');

      renderMatrix(settings.alertRules);
    });
  }

  // 캐릭터 위 일시적 말풍선 팝업 알림 트리거
  let autoPopupTimer = null;
  if (window.widgetAPI.onTriggerBubbleAlert) {
    window.widgetAPI.onTriggerBubbleAlert((info) => {
      if (autoPopupTimer) clearTimeout(autoPopupTimer);
      speechBubble.classList.add('auto-popup');
      speechBubble.classList.add('active');
      const srAnnounce = document.getElementById('srAnnounce');
      if (srAnnounce) srAnnounce.textContent = [info.title, info.body].filter(Boolean).join('. ');

      autoPopupTimer = setTimeout(() => {
        speechBubble.classList.remove('auto-popup');
        if (!isHoveringCharacter && !isHoveringBubble && !isFocusInside) {
          speechBubble.classList.remove('active');
        }
      }, info.duration || 3500);
    });
  }

  // 시뮬레이션 버튼들: 누르는 즉시 캐릭터 이미지와 게이지를 0.01초 만에 직접 강제 교체!
  document.querySelectorAll('.sim-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = parseInt(btn.getAttribute('data-percent'), 10);
      console.log('[시뮬레이션 클릭] 퍼센트:', p);

      // 1. 메인 프로세스로 IPC 알림
      if (window.widgetAPI && window.widgetAPI.setSimulation) {
        window.widgetAPI.setSimulation(p);
      }

      // 2. 렌더러에서 즉시 로컬 강제 갱신 (지연 및 씹힘 원천 방지)
      const mockData = {
        success: true,
        claude: {
          success: true,
          session: { percent: p, resetsAt: new Date(Date.now() + 1000 * 60 * 90).toISOString() },
          weekly: { percent: Math.min(100, p + 10), resetsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString() },
        },
      };

      renderUsage(mockData);
    });
  });

  // 캐릭터 마우스 드래그 창 이동 로직
  const characterWrapper = document.getElementById('characterWrapper');
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  // 클릭과 끌기 구분: 누른 뒤 총 이동 거리가 CLICK_MOVE_LIMIT px 미만이면 클릭(사진 다시 뽑기)
  const CLICK_MOVE_LIMIT = 4;
  let pressX = 0;
  let pressY = 0;
  let movedTooFar = false;

  characterWrapper.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 좌클릭만 반응
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
    pressX = e.screenX;
    pressY = e.screenY;
    movedTooFar = false;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    if (Math.abs(e.screenX - pressX) >= CLICK_MOVE_LIMIT || Math.abs(e.screenY - pressY) >= CLICK_MOVE_LIMIT) {
      movedTooFar = true;
    }
    const deltaX = e.screenX - startX;
    const deltaY = e.screenY - startY;
    startX = e.screenX;
    startY = e.screenY;
    if (deltaX !== 0 || deltaY !== 0) {
      window.widgetAPI.dragWindow(deltaX, deltaY);
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // 사진 클릭(끌지 않았을 때)·Enter·Space: 각 단계 풀 안에서 사진 다시 뽑기
  // 마우스로 누를 때는 포커스를 옮기지 않음 (포커스가 남으면 말풍선이 계속 열려 있음)
  characterCard.addEventListener('mousedown', (e) => e.preventDefault());
  characterCard.addEventListener('click', (e) => {
    if (e.button !== 0 || movedTooFar) return;
    shuffleCatMap();
  });
  characterCard.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    shuffleCatMap();
  });

  // 정밀 마우스 호버 감지 (캐릭터 본체 및 말풍선에 닿았을 때만 활성화)
  const speechBubble = document.getElementById('speechBubble');
  let isHoveringCharacter = false;
  let isHoveringBubble = false;
  let isFocusInside = false;
  let hoverTimeout = null;

  function updateBubbleState() {
    if (isHoveringCharacter || isHoveringBubble || isFocusInside) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      speechBubble.classList.add('active');
    } else {
      hoverTimeout = setTimeout(() => {
        speechBubble.classList.remove('active');
      }, 150);
    }
  }

  // 사원증 어디에 마우스를 올려도 말풍선 열기 (사진·사용률·리셋 시간 포함)
  characterWrapperEl.addEventListener('mouseenter', () => {
    isHoveringCharacter = true;
    updateBubbleState();
  });

  characterWrapperEl.addEventListener('mouseleave', () => {
    isHoveringCharacter = false;
    updateBubbleState();
  });

  speechBubble.addEventListener('mouseenter', () => {
    isHoveringBubble = true;
    updateBubbleState();
  });

  speechBubble.addEventListener('mouseleave', () => {
    isHoveringBubble = false;
    updateBubbleState();
  });

  // 키보드 접근: 위젯 안 요소에 포커스가 들어오면 말풍선 열기, 나가면 닫기
  const widgetContainer = document.querySelector('.widget-container');
  widgetContainer.addEventListener('focusin', () => {
    isFocusInside = true;
    updateBubbleState();
  });
  widgetContainer.addEventListener('focusout', (e) => {
    if (e.relatedTarget && widgetContainer.contains(e.relatedTarget)) return;
    isFocusInside = false;
    updateBubbleState();
  });

  // Esc: 설정 화면이 열려 있으면 설정만 닫고, 아니면 말풍선을 닫음
  window.addEventListener('keydown', (e) => {
    // 텍스트 입력 중일 때는 데모 단축키 무시
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

    if (e.key === 'Escape') {
      if (isSettingsOpen()) {
        setSettingsOpen(false);
        if (settingsBtn) settingsBtn.focus();
        return;
      }
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      isFocusInside = false;
      isHoveringBubble = false;
      isHoveringCharacter = false;
      updateBubbleState();
      return;
    }

    // [시연 영상 촬영용 데모 단축키]
    const key = e.key.toUpperCase();

    // 1~6: 소진율 단계 즉시 전환
    const percentMap = {
      '1': 15,  // 0~30% 여유
      '2': 45,  // 30~60% 안정
      '3': 70,  // 60~80% 조금 빠름
      '4': 85,  // 80~90% 빠름
      '5': 96,  // 95~99% 위기 (화면 진동 연출)
      '6': 100, // 100% 한도 소진 (흑백 영정 모드)
    };

    if (percentMap[key] !== undefined) {
      const p = percentMap[key];
      if (window.widgetAPI && window.widgetAPI.setSimulation) {
        window.widgetAPI.setSimulation(p);
      }
      renderUsage({
        success: true,
        claude: {
          success: true,
          session: { percent: p, resetsAt: new Date(Date.now() + 1000 * 60 * 90).toISOString() },
          weekly: { percent: Math.min(100, p + 10), resetsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString() },
        },
      });
      return;
    }

    // W: 작업 중 (코딩/타자 모드)
    if (key === 'W') {
      setActivity('working');
      return;
    }

    // E: 허락 대기 중 (Waiting)
    if (key === 'E') {
      setActivity('waiting');
      return;
    }

    // I: 일반/대기 상태로 복귀 (Idle)
    if (key === 'I') {
      setActivity('idle');
      return;
    }

    // R: 고양이 사진 셔플
    if (key === 'R') {
      shuffleCatMap();
      return;
    }

    // B: 말풍선 카드 수동 토글 (게이지 보여주기용)
    if (key === 'B') {
      const isCurrentlyActive = speechBubble.classList.contains('active');
      if (isCurrentlyActive) {
        isHoveringCharacter = false;
        isHoveringBubble = false;
        isFocusInside = false;
        speechBubble.classList.remove('active');
      } else {
        speechBubble.classList.add('active');
      }
      return;
    }

    // A: 시연용 자동 쇼케이스 재생 (Auto-Demo Mode)
    if (key === 'A') {
      runAutoDemoShowcase();
      return;
    }
  });

  // [시연 영상 전용] 자동 쇼케이스 시나리오 실행 함수 (15초 숏폼 완벽 최적화)
  let autoDemoTimer = null;
  function runAutoDemoShowcase() {
    if (autoDemoTimer) {
      clearTimeout(autoDemoTimer);
      autoDemoTimer = null;
    }

    const triggerClickPulse = () => {
      characterCard.classList.remove('click-pulse');
      void characterCard.offsetWidth; // 리플로우 강제 트리거
      characterCard.classList.add('click-pulse');
      shuffleCatMap();
    };

    const setSim = (percent) => {
      if (window.widgetAPI && window.widgetAPI.setSimulation) {
        window.widgetAPI.setSimulation(percent);
      }
      renderUsage({
        success: true,
        claude: {
          success: true,
          session: { percent, resetsAt: new Date(Date.now() + 1000 * 60 * 90).toISOString() },
          weekly: { percent: Math.min(100, percent + 10), resetsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString() },
        },
      });
    };

    const steps = [
      // 0초: [평화로운 등장] 15% 여유 상태 (식빵 고양이 1)
      {
        delay: 0,
        run: () => {
          setActivity('idle');
          setSim(15);
          speechBubble.classList.remove('active');
        },
      },
      // 1.5초: [클릭 1회차] 톡! 튀면서 다른 고양이 2로 전환
      {
        delay: 1500,
        run: () => {
          triggerClickPulse();
        },
      },
      // 2.2초: [클릭 2회차] 톡! 튀면서 다른 고양이 3으로 연속 전환
      {
        delay: 2200,
        run: () => {
          triggerClickPulse();
        },
      },
      // 2.9초: [클릭 3회차] 톡! 튀면서 다른 고양이 4로 연속 전환 (사진 변경 확실히 각인!)
      {
        delay: 2900,
        run: () => {
          triggerClickPulse();
        },
      },
      // 4.2초: [코딩 작업 개시] 작업 모드 ON (열일 타자 고양이 + 회전 스피너)
      {
        delay: 4200,
        run: () => {
          setActivity('working');
        },
      },
      // 6.5초: [게이지 오픈] 말풍선 카드 오픈 (세션 소진율 및 페이스 노출)
      {
        delay: 6500,
        run: () => {
          speechBubble.classList.add('active');
        },
      },
      // 8.5초: [코딩 완료 후 순항] 50% 안정
      {
        delay: 8500,
        run: () => {
          setActivity('idle');
          setSim(50);
        },
      },
      // 10.5초: [과부하/위기 🔥] 96% 도달 (부들부들 shake 진동 + 멘붕 고양이)
      {
        delay: 10500,
        run: () => {
          setSim(96);
        },
      },
      // 13.0초: [소진/영정 모드 🪦] 100% 도달 (흑백 + 영정 리본 + 리셋 카운트다운 타이머)
      {
        delay: 13000,
        run: () => {
          setSim(100);
        },
      },
      // 15.5초: [15초 컷 종료 후 원복] 평화로운 20% 상태로 복귀
      {
        delay: 15500,
        run: () => {
          setSim(20);
          speechBubble.classList.remove('active');
        },
      },
    ];

    steps.forEach((step) => {
      setTimeout(step.run, step.delay);
    });
  }

  // 빈 투명 영역 클릭 관통 (Click-through) 처리
  window.addEventListener('mousemove', (e) => {
    if (!window.widgetAPI) return;
    const isInteractive =
      e.target.closest('#characterCard') ||
      e.target.closest('#characterWrapper') ||
      e.target.closest('#minimizeBtn') ||
      e.target.closest('#speechBubble') ||
      e.target.closest('.simulation-bar') ||
      e.target.closest('.sim-btn') ||
      e.target.closest('.action-btn');

    if (isInteractive) {
      window.widgetAPI.setIgnoreMouseEvents(false);
    } else {
      window.widgetAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  });
}
