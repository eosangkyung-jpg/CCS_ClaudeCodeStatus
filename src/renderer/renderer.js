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

function getGradientForPercent(percent) {
  if (percent < 50) return 'linear-gradient(90deg, #10b981, #3b82f6)';
  if (percent < 80) return 'linear-gradient(90deg, #3b82f6, #f59e0b)';
  if (percent < 95) return 'linear-gradient(90deg, #f59e0b, #ef4444)';
  return 'linear-gradient(90deg, #ef4444, #8b5cf6)';
}

function renderUsage(data) {
  if (!data.success) {
    // 에러 발생 시 친절한 가이드 화면 노출
    statusBadge.textContent = '오류 안내';
    statusBadge.style.background = '#ef4444';
    percentChip.textContent = '⚠️';

    normalBubbleBody.style.display = 'none';
    errorCard.style.display = 'flex';

    errorTitle.textContent = data.errorMessage || '데이터를 불러오지 못했습니다.';
    errorDesc.textContent = data.errorGuide || '설정 및 상태를 확인해주세요.';

    characterCard.classList.remove('shake', 'exhausted');
    countdownBadge.style.display = 'none';
    return;
  }

  // 정상 데이터인 경우 에러 카드 숨기고 일반 바디 노출
  normalBubbleBody.style.display = 'block';
  errorCard.style.display = 'none';

  // 구독 세션 모드 렌더링
  const p = Math.round(data.session.percent);
  currentResetTimestamp = data.session.resetsAt;

  sessionVal.textContent = `${p}%`;
  percentChip.textContent = `${p}%`;
  sessionBar.style.width = `${Math.min(100, p)}%`;
  sessionBar.style.background = getGradientForPercent(p);

  const sessionLabel = document.getElementById('sessionLabel');
  if (sessionLabel) sessionLabel.textContent = '5시간 세션';

  resetTime.textContent = formatRemainingTime(data.session.resetsAt);

  // 7일 주간 한도 프로그레스 바 렌더링
  const weeklyP = Math.round(data.weekly.percent);
  const weeklyVal = document.getElementById('weeklyVal');
  const weeklyBar = document.getElementById('weeklyBar');
  const weeklyResetTime = document.getElementById('weeklyResetTime');
  const weeklySection = document.getElementById('weeklySection');

  if (weeklySection) weeklySection.style.display = 'flex';
  if (weeklyVal) weeklyVal.textContent = `${weeklyP}%`;
  if (weeklyBar) {
    weeklyBar.style.width = `${Math.min(100, weeklyP)}%`;
    weeklyBar.style.background = getGradientForPercent(weeklyP);
  }
  if (weeklyResetTime) {
    weeklyResetTime.textContent = formatWeeklyResetTime(data.weekly.resetsAt);
  }

  // 소모 속도(Pace) 뱃지 렌더링
  if (data.pace) {
    paceRow.style.display = 'flex';
    paceBadge.textContent = data.pace.badge;
    paceBadge.style.background = `${data.pace.badgeColor}25`;
    paceBadge.style.color = data.pace.badgeColor;
    paceBadge.style.borderColor = `${data.pace.badgeColor}60`;
    paceBadge.title = data.pace.text;
  } else {
    paceRow.style.display = 'none';
  }

  // 상태 뱃지 및 인용구
  statusBadge.textContent = data.state.label;
  statusBadge.style.background = data.state.badgeColor;
  quoteText.textContent = data.state.quote;

  // 캐릭터 이미지 및 특수 효과
  characterImg.src = data.state.image;

  const currentPercent = Math.round(data.session.percent);

  // 95% 이상 긴급 흔들림
  if (currentPercent >= 95 && currentPercent < 100) {
    characterCard.classList.add('shake');
  } else {
    characterCard.classList.remove('shake');
  }

  // 100% 완전 소진 시 흑백 + 타이머
  if (currentPercent >= 100) {
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
    settingsDoneBtn.addEventListener('click', () => {
      settingsPanel.style.display = 'none';
    });
  }

  // 알림 설정 패널 토글 및 저장
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = settingsPanel.style.display === 'none';
      settingsPanel.style.display = isHidden ? 'block' : 'none';
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

  // 시뮬레이션 버튼들
  document.querySelectorAll('.sim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.getAttribute('data-percent'), 10);
      window.widgetAPI.setSimulation(p);
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
      e.target.closest('#minimizeBtn') ||
      e.target.closest('#speechBubble.active');

    if (isInteractive) {
      window.widgetAPI.setIgnoreMouseEvents(false);
    } else {
      window.widgetAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  });
}
