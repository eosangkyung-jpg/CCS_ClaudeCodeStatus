const characterImg = document.getElementById('characterImg');
const characterCard = document.getElementById('characterCard');
const statusBadge = document.getElementById('statusBadge');
const sessionVal = document.getElementById('sessionVal');
const sessionBar = document.getElementById('sessionBar');
const resetTime = document.getElementById('resetTime');
const weeklyVal = document.getElementById('weeklyVal');
const quoteText = document.getElementById('quoteText');
const percentChip = document.getElementById('percentChip');
const countdownBadge = document.getElementById('countdownBadge');
const countdownTimer = document.getElementById('countdownTimer');
const refreshBtn = document.getElementById('refreshBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const settingNotifyBubble = document.getElementById('settingNotifyBubble');
const settingNotifyToast = document.getElementById('settingNotifyToast');
const settingOpenAtLogin = document.getElementById('settingOpenAtLogin');
const paceRow = document.getElementById('paceRow');
const paceBadge = document.getElementById('paceBadge');
const normalBubbleBody = document.getElementById('normalBubbleBody');
const errorCard = document.getElementById('errorCard');
const errorTitle = document.getElementById('errorTitle');
const errorDesc = document.getElementById('errorDesc');
const errorRetryBtn = document.getElementById('errorRetryBtn');

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

function updateCountdownText() {
  if (!currentResetTimestamp) return;
  const target = new Date(currentResetTimestamp).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const hours = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
  const minutes = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
  const seconds = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');

  countdownTimer.textContent = `${hours}:${minutes}:${seconds}`;
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

const ALL_CAT_IMAGES = Array.from({ length: 38 }, (_, i) => `cat${i + 1}.jpg`);

function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function initializeTierCatMap() {
  const STORAGE_KEY = 'sideproj_tier_cat_map';
  let map = null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      map = JSON.parse(saved);
      const isComplete = TIER_KEYS.every(k => map && map[k]);
      if (!isComplete) map = null;
    }
  } catch (e) {
    map = null;
  }

  if (!map) {
    const shuffled = shuffleArray(ALL_CAT_IMAGES);
    map = {};
    TIER_KEYS.forEach((tier, index) => {
      map[tier] = shuffled[index % shuffled.length];
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {}
  }
  return map;
}

let currentTierCatMap = initializeTierCatMap();

function shuffleCatMap() {
  const STORAGE_KEY = 'sideproj_tier_cat_map';
  const shuffled = shuffleArray(ALL_CAT_IMAGES);
  const map = {};
  TIER_KEYS.forEach((tier, index) => {
    map[tier] = shuffled[index % shuffled.length];
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
  currentTierCatMap = map;

  if (lastUsagePayload) {
    applyActiveProviderState(lastUsagePayload);
  } else {
    applyActiveProviderState({ primaryPercent: 0 });
  }
}

function getCatImageForTier(tierId) {
  return currentTierCatMap[tierId] || 'cat1.jpg';
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
      image: getImageDataUri(getCatImageForTier('state_0_30')),
      quote: activeProvider === 'gemini' ? '크레딧 넉넉해요! 마음껏 질문하세요 💸' : '토큰 넉넉해요! 뭐든 시켜주세요.',
    };
  } else if (p < 60) {
    return {
      id: 'state_30_60',
      label: '안정',
      image: getImageDataUri(getCatImageForTier('state_30_60')),
      quote: activeProvider === 'gemini' ? '순항 중입니다. 크레딧 소진 페이스 적당해요.' : '순항 중입니다. 페이스 아주 좋아요.',
    };
  } else if (p < 80) {
    return {
      id: 'state_60_80',
      label: '고민',
      image: getImageDataUri(getCatImageForTier('state_60_80')),
      quote: activeProvider === 'gemini' ? '절반을 넘었어요. 긴 프롬프트/대용량 토큰 주의!' : '절반을 훌쩍 넘었어요. 긴 프롬프트 주의!',
    };
  } else if (p < 90) {
    return {
      id: 'state_80_90',
      label: '기도',
      image: getImageDataUri(getCatImageForTier('state_80_90')),
      quote: activeProvider === 'gemini' ? '간당간당합니다... 제발 체험 크레딧 버텨줘 🙏' : '간당간당합니다... 제발 리셋까지 버텨줘 🙏',
    };
  } else if (p < 95) {
    return {
      id: 'state_90_94',
      label: '멈춰!',
      image: getImageDataUri(getCatImageForTier('state_90_94')),
      quote: activeProvider === 'gemini' ? '크레딧 소진 임박! 곧 유료 과금 전환 위험!' : '진짜 마지막 경고! 지금 쏘면 끝장납니다!',
    };
  } else {
    const isOver = p >= 100;
    return {
      id: 'state_95_100',
      label: isOver ? '소진 완료' : '멘붕/위기',
      image: getImageDataUri(getCatImageForTier('state_95_100')),
      quote: isOver ? '한도가 모두 소진되었습니다! 🚨' : '95% 도달! 손 떼세요! 멘붕 직전!',
    };
  }
}

function applyActiveProviderState(data) {
  let p = 0;

  if (activeProvider === 'claude' && data.claude && data.claude.success) {
    p = Math.round(data.claude.session.percent);
  } else if (activeProvider === 'gemini' && data.gemini && data.gemini.success) {
    p = Math.round(data.gemini.billing.consumedPercent);
  } else {
    p = Math.round(data.primaryPercent || 0);
  }

  percentChip.textContent = `${p}%`;

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

  const imgElem = document.getElementById('characterImg');
  if (state && imgElem) {
    statusBadge.textContent = state.label;
    quoteText.textContent = `"${state.quote}"`;
    // file:// 프로토콜에서는 쿼리스트링(?t=)이 들어가면 윈도우 파일명을 찾지 못하므로 순수 경로 대입
    imgElem.src = state.image;
    imgElem.setAttribute('src', state.image);
    console.log(`[위젯] 상태 전환 성공: ${state.label} (${p}%) -> ${state.image}`);
  }

  if (p >= 95 && p < 100) {
    characterCard.classList.add('shake');
  } else {
    characterCard.classList.remove('shake');
  }

  if (p >= 100) {
    characterCard.classList.add('exhausted');
    countdownBadge.style.display = 'block';
    if (!countdownInterval) {
      updateCountdownText();
      countdownInterval = setInterval(updateCountdownText, 1000);
    }
  } else {
    characterCard.classList.remove('exhausted');
    countdownBadge.style.display = 'none';
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }
}

function renderUsage(data) {
  lastUsagePayload = data;

  if (!data.success) {
    statusBadge.textContent = '인증/연결 필요';
    statusBadge.style.background = '#ef4444';
    percentChip.textContent = '⚠️';

    normalBubbleBody.style.display = 'none';
    errorCard.style.display = 'flex';

    errorTitle.textContent = data.errorMessage || '데이터를 불러오지 못했습니다.';
    errorDesc.textContent = data.errorGuide || 'Claude 및 Google Cloud 인증 상태를 확인해주세요.';

    characterCard.classList.remove('shake', 'exhausted');
    countdownBadge.style.display = 'none';
    return;
  }

  normalBubbleBody.style.display = 'block';
  errorCard.style.display = 'none';

  // 1. Claude 플랜 섹션 렌더링
  const paceBadge = document.getElementById('paceBadge');
  if (data.claude && data.claude.success) {
    const c = data.claude;
    const sessionP = Math.round(c.session.percent);
    currentResetTimestamp = c.session.resetsAt;

    sessionVal.textContent = `${sessionP}%`;
    sessionBar.style.width = `${Math.min(100, sessionP)}%`;

    const theme = interpolatePinkRed(sessionP);
    sessionVal.style.color = theme.textColor;
    sessionBar.style.background = theme.barGradient;
    sessionBar.style.boxShadow = theme.glow;

    resetTime.textContent = formatRemainingTime(c.session.resetsAt);

    const weeklyP = Math.round(c.weekly.percent);
    weeklyVal.textContent = `${weeklyP}%`;
    weeklyBar.style.width = `${Math.min(100, weeklyP)}%`;
    weeklyBar.style.background = 'linear-gradient(90deg, #f8fafc, #fda4af)';
    weeklyResetTime.textContent = formatWeeklyResetTime(c.weekly.resetsAt);

    if (c.pace && paceBadge) {
      paceBadge.textContent = c.pace.badge;
    }
  } else {
    sessionVal.textContent = '미로그인';
    sessionBar.style.width = '0%';
    resetTime.textContent = '터미널에서 `claude` 로그인 필요';
    weeklyVal.textContent = '--%';
    weeklyBar.style.width = '0%';
    weeklyResetTime.textContent = '주간 한도 조회 대기';
  }

  // 2. Gemini 크레딧 섹션 렌더링
  const geminiPaceBadge = document.getElementById('geminiPaceBadge');
  const geminiPercentVal = document.getElementById('geminiPercentVal');
  const geminiBar = document.getElementById('geminiBar');
  const geminiSpendDetail = document.getElementById('geminiSpendDetail');
  const geminiRemainingVal = document.getElementById('geminiRemainingVal');

  if (data.gemini && data.gemini.success) {
    const g = data.gemini.billing;
    const gPercent = g.consumedPercent;

    if (geminiPercentVal) {
      geminiPercentVal.textContent = `${gPercent}%`;
      const gTheme = interpolatePinkRed(gPercent);
      geminiPercentVal.style.color = gTheme.textColor;
      if (geminiBar) {
        geminiBar.style.width = `${Math.min(100, gPercent)}%`;
        geminiBar.style.background = gTheme.barGradient;
        geminiBar.style.boxShadow = gTheme.glow;
      }
    }
    if (geminiSpendDetail) {
      geminiSpendDetail.textContent = `사용한 금액: ₩ ${Math.round(g.spentKrw).toLocaleString('ko-KR')} 소진`;
    }
    if (geminiRemainingVal) {
      geminiRemainingVal.textContent = `₩ ${Math.round(g.remainingKrw).toLocaleString('ko-KR')}`;
    }

    if (data.gemini.pace && geminiPaceBadge) {
      geminiPaceBadge.textContent = data.gemini.pace.badge;
    }
  }

  // 활성 탭 상태 및 표정 갱신
  updateProviderTabs();
}

// 이벤트 리스너 등록
if (window.widgetAPI) {
  window.widgetAPI.onUsageUpdated((data) => {
    renderUsage(data);
  });

  // 상단 프로바이더 모드 탭 클릭 이벤트
  if (tabClaude && tabGemini) {
    tabClaude.addEventListener('click', () => {
      activeProvider = 'claude';
      localStorage.setItem('sideproj_active_provider', 'claude');
      updateProviderTabs();
    });

    tabGemini.addEventListener('click', () => {
      activeProvider = 'gemini';
      localStorage.setItem('sideproj_active_provider', 'gemini');
      updateProviderTabs();
    });
  }

  refreshBtn.addEventListener('click', () => {
    statusBadge.textContent = '갱신 중...';
    window.widgetAPI.requestRefresh();
  });

  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) {
    shuffleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      shuffleCatMap();
    });
  }

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.widgetAPI.hideWindow();
    });
  }

  const settingsDoneBtn = document.getElementById('settingsDoneBtn');
  const matrixRows = document.getElementById('matrixRows');
  const presetAll = document.getElementById('presetAll');
  const presetDanger = document.getElementById('presetDanger');
  const presetNone = document.getElementById('presetNone');

  const TIERS = [
    { id: 'state_0_30', label: '0~30% 여유' },
    { id: 'state_30_60', label: '30~60% 안정' },
    { id: 'state_60_80', label: '60~80% 고민' },
    { id: 'state_80_90', label: '80~90% 기도' },
    { id: 'state_90_94', label: '90~94% 멈춰!' },
    { id: 'state_95_99', label: '95~99% 위기' },
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
        <input type="checkbox" data-tier="${tier.id}" data-type="bubble" ${rule.bubble ? 'checked' : ''}>
        <input type="checkbox" data-tier="${tier.id}" data-type="toast" ${rule.toast ? 'checked' : ''}>
      `;
      matrixRows.appendChild(row);
    });

    matrixRows.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const tier = cb.getAttribute('data-tier');
        const type = cb.getAttribute('data-type');
        if (!currentAlertRules[tier]) currentAlertRules[tier] = { bubble: true, toast: true };
        currentAlertRules[tier][type] = cb.checked;
        window.widgetAPI.updateSettings({ alertRules: currentAlertRules });
      });
    });
  }

  function applyPreset(presetType) {
    TIERS.forEach((tier) => {
      if (!currentAlertRules[tier.id]) currentAlertRules[tier.id] = { bubble: true, toast: true };
      if (presetType === 'all') {
        currentAlertRules[tier.id] = { bubble: true, toast: true };
      } else if (presetType === 'none') {
        currentAlertRules[tier.id] = { bubble: false, toast: false };
      } else if (presetType === 'danger') {
        const isDanger = ['state_80_90', 'state_90_94', 'state_95_99', 'state_100', 'state_reset'].includes(tier.id);
        currentAlertRules[tier.id] = { bubble: isDanger, toast: isDanger };
      }
    });
    renderMatrix(currentAlertRules);
    window.widgetAPI.updateSettings({ alertRules: currentAlertRules });
  }

  if (presetAll) presetAll.addEventListener('click', () => applyPreset('all'));
  if (presetDanger) presetDanger.addEventListener('click', () => applyPreset('danger'));
  if (presetNone) presetNone.addEventListener('click', () => applyPreset('none'));
  if (settingsDoneBtn && settingsPanel) {
    settingsDoneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsPanel.style.display = 'none';
      if (normalBubbleBody) normalBubbleBody.style.display = 'block';
    });
  }

  // 알림 설정 패널 토글 및 본문 배타적 스위칭 (상단 잘림 원천 차단)
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = settingsPanel.style.display === 'none';
      if (isHidden) {
        settingsPanel.style.display = 'block';
        if (normalBubbleBody) normalBubbleBody.style.display = 'none';
      } else {
        settingsPanel.style.display = 'none';
        if (normalBubbleBody) normalBubbleBody.style.display = 'block';
      }
    });
  }

  if (settingNotifyBubble) {
    settingNotifyBubble.addEventListener('change', () => {
      window.widgetAPI.updateSettings({ notifyBubble: settingNotifyBubble.checked });
    });
  }

  if (settingNotifyToast) {
    settingNotifyToast.addEventListener('change', () => {
      window.widgetAPI.updateSettings({ notifyToast: settingNotifyToast.checked });
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

  if (window.widgetAPI.onSettingsUpdated) {
    window.widgetAPI.onSettingsUpdated((settings) => {
      if (settingNotifyBubble) settingNotifyBubble.checked = settings.notifyBubble;
      if (settingNotifyToast) settingNotifyToast.checked = settings.notifyToast;
      if (settingOpenAtLogin) settingOpenAtLogin.checked = !!settings.openAtLogin;

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

      autoPopupTimer = setTimeout(() => {
        speechBubble.classList.remove('auto-popup');
        if (!isHoveringCharacter && !isHoveringBubble) {
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
        primaryPercent: p,
        claude: {
          success: true,
          session: { percent: p, resetsAt: new Date(Date.now() + 1000 * 60 * 90).toISOString() },
          weekly: { percent: Math.min(100, p + 10), resetsAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString() },
        },
        gemini: {
          success: true,
          billing: {
            totalCreditKrw: 402977,
            spentKrw: Math.round((402977 * p) / 100),
            remainingKrw: Math.max(0, 402977 - Math.round((402977 * p) / 100)),
            consumedPercent: p,
          },
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

  characterWrapper.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 좌클릭만 반응
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
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

  // 정밀 마우스 호버 감지 (캐릭터 본체 및 말풍선에 닿았을 때만 활성화)
  const speechBubble = document.getElementById('speechBubble');
  let isHoveringCharacter = false;
  let isHoveringBubble = false;
  let hoverTimeout = null;

  function updateBubbleState() {
    if (isHoveringCharacter || isHoveringBubble) {
      if (hoverTimeout) clearTimeout(hoverTimeout);
      speechBubble.classList.add('active');
    } else {
      hoverTimeout = setTimeout(() => {
        speechBubble.classList.remove('active');
      }, 150);
    }
  }

  characterCard.addEventListener('mouseenter', () => {
    isHoveringCharacter = true;
    updateBubbleState();
  });

  characterCard.addEventListener('mouseleave', () => {
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

  // 빈 투명 영역 클릭 관통 (Click-through) 처리
  window.addEventListener('mousemove', (e) => {
    if (!window.widgetAPI) return;
    const isInteractive =
      e.target.closest('#characterCard') ||
      e.target.closest('#characterWrapper') ||
      e.target.closest('#shuffleBtn') ||
      e.target.closest('#minimizeBtn') ||
      e.target.closest('#speechBubble') ||
      e.target.closest('.simulation-bar') ||
      e.target.closest('.sim-btn') ||
      e.target.closest('.action-btn') ||
      e.target.closest('.provider-tab-btn');

    if (isInteractive) {
      window.widgetAPI.setIgnoreMouseEvents(false);
    } else {
      window.widgetAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  });
}
