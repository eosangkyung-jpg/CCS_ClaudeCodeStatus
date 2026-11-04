const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { fetchUsageData, resolveState, calculatePace } = require('./services/usageService');
const { createActivityMonitor, areHooksInstalled, setHooksInstalled } = require('./services/activityService');

let mainWindow = null;
let tray = null;
let pollInterval = null;
let lastStateId = null;
let isSimulationActive = false;

const DEFAULT_ALERT_RULES = {
  state_0_30: { bubble: true, toast: true },
  state_30_60: { bubble: true, toast: true },
  state_60_80: { bubble: true, toast: true },
  state_80_90: { bubble: true, toast: true },
  state_90_94: { bubble: true, toast: true },
  state_95_99: { bubble: true, toast: true },
  state_100: { bubble: true, toast: true },
  state_reset: { bubble: true, toast: true },
};

// 기본 창 크기(DIP). 글자 크기 옵션은 화면 확대와 창 크기를 같은 비율로 키운다.
// 높이 = 말풍선 공간(기존 540 - 캐릭터 170) + 사원증 325
const BASE_WIDTH = 340;
const BASE_HEIGHT = 695;
const UI_SCALES = [1, 1.25, 1.5];

const DEFAULT_SETTINGS = {
  notificationsPaused: false,
  uiScale: 1,
  warningEffects: 'default', // 'default' | 'off' (흔들림·붉은 막·튀는 움직임·스피너 회전 끄기)
  tierCatMap: null, // 위젯이 배정한 구간별 고양이 사진 (renderer에서 동기화)
  openAtLogin: false,
  bubbleDuration: 3500,
  alertRules: DEFAULT_ALERT_RULES,
};

let currentSettings = { ...DEFAULT_SETTINGS };

const SETTINGS_FILE = path.join(app.getPath('userData'), 'sideproj-widget-settings.json');

// 구버전 설정 호환: 마스터 스위치가 꺼져 있던 열은 모든 구간을 끈 상태로 옮겨
// 사용자가 체감하는 동작(알림이 오지 않음)을 그대로 유지한다.
function migrateAlertRules(saved) {
  const rules = {};
  Object.keys(DEFAULT_ALERT_RULES).forEach((key) => {
    rules[key] = { ...DEFAULT_ALERT_RULES[key], ...((saved.alertRules || {})[key] || {}) };
    if (saved.notifyBubble === false) rules[key].bubble = false;
    if (saved.notifyToast === false) rules[key].toast = false;
  });
  return rules;
}

// 현재 모니터 작업 영역에 창이 다 들어가는 최대 글자 크기
function getMaxUiScale() {
  const display = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const { workArea } = display;
  const fits = UI_SCALES.filter((s) => BASE_WIDTH * s <= workArea.width && BASE_HEIGHT * s <= workArea.height);
  return fits.length ? fits[fits.length - 1] : 1;
}

function settingsPayload() {
  return { ...currentSettings, maxUiScale: getMaxUiScale(), claudeHooksInstalled: areHooksInstalled() };
}

// Claude Code 작업 상태 (working / waiting / idle) → 위젯 스피너 배지
const activityMonitor = createActivityMonitor((state) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('activity-updated', state);
  }
});

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      // 메모장 등이 붙이는 UTF-8 BOM 제거 (없으면 JSON.parse가 실패해 설정이 기본값으로 덮어써짐)
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^﻿/, ''));
      currentSettings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        alertRules: migrateAlertRules(saved),
      };
      // 구버전 마스터 스위치(notifyBubble/notifyToast)는 구간별 규칙으로 흡수되었으므로 제거
      delete currentSettings.notifyBubble;
      delete currentSettings.notifyToast;
      return currentSettings;
    }
  } catch (err) {
    console.error('설정 로드 실패:', err.message);
  }
  currentSettings = { ...DEFAULT_SETTINGS };
  return currentSettings;
}

function saveSettings(settings) {
  try {
    currentSettings = {
      ...currentSettings,
      ...settings,
      alertRules: {
        ...(currentSettings.alertRules || DEFAULT_ALERT_RULES),
        ...(settings.alertRules || {}),
      },
    };

    // Windows 시작 시 자동 실행 연동
    if (typeof settings.openAtLogin === 'boolean') {
      try {
        app.setLoginItemSettings(process.platform === 'win32'
          ? { openAtLogin: settings.openAtLogin, path: app.getPath('exe') }
          : { openAtLogin: settings.openAtLogin });
      } catch (e) {
        console.warn('openAtLogin 설정 실패:', e.message);
      }
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), 'utf8');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-updated', settingsPayload());
    }
    updateTrayMenu();
  } catch (err) {
    console.error('설정 저장 실패:', err.message);
  }
}

function notifyStateChange(stateInfo, percent, isSimulation = false) {
  if (!isSimulation && lastStateId === stateInfo.id) return;

  const wasHigh = lastStateId && ['state_80_90', 'state_90_94', 'state_95_100'].includes(lastStateId);
  const isReset = wasHigh && stateInfo.id === 'state_0_30';

  let ruleKey = stateInfo.id;
  if (isReset) {
    ruleKey = 'state_reset';
  } else if (stateInfo.id === 'state_95_100') {
    ruleKey = percent >= 100 ? 'state_100' : 'state_95_99';
  }

  const rule = currentSettings.alertRules?.[ruleKey] ?? { bubble: true, toast: true };
  const paused = !!currentSettings.notificationsPaused;

  let title = `[Claude] ${stateInfo.label} (${percent}% 사용)`;
  let body = stateInfo.quote;
  // 위젯과 같은 사진을 쓰기 위해 위젯이 동기화한 배정을 우선 사용 (없으면 서비스 기본값)
  let iconFile = currentSettings.tierCatMap?.[stateInfo.id] || stateInfo.iconFile || (stateInfo.id + '.jpg');

  if (isReset) {
    title = '🎉 [Claude] 세션 리셋 완료!';
    body = '새 5시간 세션이 시작되었습니다. 다시 달려 볼까요?';
  } else if (stateInfo.id === 'state_95_100') {
    title = percent >= 100 ? '⛔ [Claude] 5시간 한도 소진!' : `🚨 [Claude] 한도 임박 (${percent}%)`;
  } else if (stateInfo.id === 'state_90_94') {
    title = `⚠️ [Claude] 멈춰! (${percent}%)`;
  }

  // 1. 캐릭터 위 일시적 말풍선 팝업
  if (!paused && rule.bubble && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('trigger-bubble-alert', {
      duration: currentSettings.bubbleDuration || 3500,
      title,
      body,
      isReset,
    });
  }

  // 2. Windows 네이티브 토스트 알림
  if (!paused && rule.toast && Notification.isSupported()) {
    const iconPath = path.join(__dirname, 'assets', 'images', iconFile);
    const notification = new Notification({
      title,
      body,
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
      silent: false,
    });
    notification.show();
  }

  lastStateId = stateInfo.id;
}

function getWindowSize(scale) {
  return { width: Math.round(BASE_WIDTH * scale), height: Math.round(BASE_HEIGHT * scale) };
}

// 글자 크기 변경: 창 아래쪽 가운데를 기준으로 크기를 바꾸고(캐릭터 위치 유지), 화면 밖으로 나가지 않게 보정
let scaleAnchor = null;      // 글자 크기 변경의 기준점 (사용자가 옮길 때만 갱신)
let isApplyingScale = false; // 크기 변경으로 생긴 'moved'는 기준점 갱신에서 제외

function applyUiScale(requested) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  let scale = UI_SCALES.includes(requested) ? requested : 1;
  scale = Math.min(scale, getMaxUiScale());

  const old = mainWindow.getBounds();
  // 기준점: 사용자가 마지막으로 옮긴 위치의 '아래쪽 가운데'. 화면 밖 보정으로 밀린 위치가 아니라
  // 원래 기준점에서 계산하므로 150% → 100%로 돌아오면 원래 자리로 돌아온다.
  if (!scaleAnchor) scaleAnchor = { cx: old.x + old.width / 2, bottom: old.y + old.height };
  const { width, height } = getWindowSize(scale);
  const { workArea } = screen.getDisplayMatching(old);
  let x = Math.round(scaleAnchor.cx - width / 2);
  let y = Math.round(scaleAnchor.bottom - height);
  x = Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width);
  y = Math.min(Math.max(y, workArea.y), workArea.y + workArea.height - height);

  isApplyingScale = true;
  mainWindow.setBounds({ x, y, width, height });
  mainWindow.webContents.setZoomFactor(scale);
  saveSettings({ uiScale: scale, x, y });
  setTimeout(() => { isApplyingScale = false; }, 300);
}

// 기본 위치: 사원증 중심이 주 모니터 작업 영역의 이 비율 지점에 오도록 (2026-11-05 사용자가 지정)
// 해상도·배율이 달라도 같은 비율 위치에 놓이고, 사원증이 화면 밖으로 나가지 않게 보정한다.
const DEFAULT_CARD_CENTER = { fx: 0.9066, fy: 0.8312 };
// 창 안에서 사원증 중심의 위치(배율 1 기준): 가로는 창 가운데, 세로는 아래 여백 16 + 사원증 높이 325의 절반
const CARD_CENTER_FROM_BOTTOM = 16 + 325 / 2;
const CARD_HALF_W = 226 / 2;
const CARD_HALF_H = 325 / 2;

function getDefaultPosition(width, height) {
  const { workArea } = screen.getPrimaryDisplay();
  const scale = width / BASE_WIDTH;
  const halfW = CARD_HALF_W * scale;
  const halfH = CARD_HALF_H * scale;
  let cx = workArea.x + workArea.width * DEFAULT_CARD_CENTER.fx;
  let cy = workArea.y + workArea.height * DEFAULT_CARD_CENTER.fy;
  cx = Math.min(Math.max(cx, workArea.x + halfW), workArea.x + workArea.width - halfW);
  cy = Math.min(Math.max(cy, workArea.y + halfH), workArea.y + workArea.height - halfH);
  return {
    x: Math.round(cx - width / 2),
    y: Math.round(cy - (height - CARD_CENTER_FROM_BOTTOM * scale)),
  };
}

function createWindow() {
  const savedSettings = loadSettings();
  const initialScale = UI_SCALES.includes(savedSettings.uiScale) ? savedSettings.uiScale : 1;
  const { width: windowWidth, height: windowHeight } = getWindowSize(initialScale);
  const defaultPos = getDefaultPosition(windowWidth, windowHeight);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    // 켤 때마다 항상 기본 위치에서 시작 (저장된 마지막 위치는 쓰지 않음)
    x: defaultPos.x,
    y: defaultPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 저장된 글자 크기를 화면 확대에 반영 (새로고침 때마다 다시 적용)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(currentSettings.uiScale || 1);
  });

  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    if (!isApplyingScale) scaleAnchor = null; // 사용자가 직접 옮기면 다음 크기 변경은 새 위치 기준
    saveSettings({ x, y });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 저장된 글자 크기가 이 모니터에 안 들어가면 맞는 크기로 낮춤
    if ((currentSettings.uiScale || 1) > getMaxUiScale()) applyUiScale(getMaxUiScale());
    mainWindow.webContents.send('settings-updated', settingsPayload());
    mainWindow.webContents.send('activity-updated', activityMonitor.state);
    updateUsage();
  });
}

async function updateUsage() {
  if (!mainWindow || isSimulationActive) return;
  try {
    const claudeData = await fetchUsageData().catch((err) => ({ success: false, errorMessage: err.message }));

    if (!claudeData.success) {
      // Claude 조회 실패: 원인과 해결 방법을 그대로 위젯 오류 카드에 전달
      mainWindow.webContents.send('usage-updated', {
        success: false,
        errorMessage: claudeData.errorMessage,
        errorGuide: claudeData.errorGuide,
      });
      return;
    }

    const percent = Math.round(claudeData.session.percent);
    mainWindow.webContents.send('usage-updated', {
      success: true,
      claude: claudeData,
      state: claudeData.state,
      fetchedAt: new Date().toISOString(),
    });

    notifyStateChange(claudeData.state, percent, false);
  } catch (err) {
    console.error('사용량 갱신 오류:', err.message);
    mainWindow.webContents.send('usage-updated', {
      success: false,
      errorMessage: '사용량 조회 실패',
      errorGuide: err.message,
    });
  }
}

function simulateUsage(percent) {
  if (!mainWindow) return;
  isSimulationActive = true;
  const stateInfo = resolveState(percent);
  const now = new Date();
  const resetTime = new Date(now.getTime() + 1000 * 60 * 85);
  const paceInfo = calculatePace(percent, resetTime.toISOString());

  mainWindow.webContents.send('usage-updated', {
    success: true,
    isSimulation: true,
    claude: {
      success: true,
      session: {
        percent: percent,
        resetsAt: resetTime.toISOString(),
      },
      weekly: {
        percent: Math.min(100, percent + 10),
        resetsAt: new Date(now.getTime() + 1000 * 60 * 60 * 48).toISOString(),
      },
      state: stateInfo,
      pace: paceInfo,
    },
    state: stateInfo,
    fetchedAt: now.toISOString(),
  });

  notifyStateChange(stateInfo, Math.round(percent), true);
}

function simulateError(errorCode = 'NO_CREDENTIALS') {
  if (!mainWindow) return;
  const errorMap = {
    NO_CREDENTIALS: {
      errorCode: 'NO_CREDENTIALS',
      errorMessage: 'Claude Code 로그인이 필요합니다.',
      errorGuide: '터미널(PowerShell/CMD)에서 `claude`를 실행하여 로그인한 후 다시 시도해주세요.',
    },
    AUTH_EXPIRED: {
      errorCode: 'AUTH_EXPIRED',
      errorMessage: 'Claude Code 로그인 세션이 만료되었습니다.',
      errorGuide: '터미널에서 `claude`를 실행하여 다시 로그인해주세요.',
    },
    NETWORK_ERROR: {
      errorCode: 'NETWORK_ERROR',
      errorMessage: '네트워크 연결 오류',
      errorGuide: '인터넷 연결 상태를 확인하거나 잠시 후 다시 시도해주세요.',
    },
  };

  const errData = errorMap[errorCode] || errorMap.NO_CREDENTIALS;
  mainWindow.webContents.send('usage-updated', {
    success: false,
    ...errData,
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🔄 즉시 새로고침',
      click: () => updateUsage(),
    },
    {
      label: '📍 위치 초기화',
      click: () => {
        if (mainWindow) {
          const defaultPos = getDefaultPosition(...mainWindow.getSize());
          mainWindow.setPosition(defaultPos.x, defaultPos.y);
          saveSettings(defaultPos);
        }
      },
    },
    { type: 'separator' },
    {
      label: '💻 윈도우 시작 시 자동 실행',
      type: 'checkbox',
      checked: !!currentSettings.openAtLogin,
      click: (item) => saveSettings({ openAtLogin: item.checked }),
    },
    {
      // 구간별 설정은 그대로 두고 모든 알림만 잠시 멈춤 (다시 체크 해제하면 즉시 재개)
      label: '알림 일시 중지',
      type: 'checkbox',
      checked: !!currentSettings.notificationsPaused,
      click: (item) => saveSettings({ notificationsPaused: item.checked }),
    },
    {
      label: '🧪 테스트 시뮬레이션',
      submenu: [
        { label: '5% (여유)', click: () => simulateUsage(5) },
        { label: '45% (안정)', click: () => simulateUsage(45) },
        { label: '70% (조금 빠름)', click: () => simulateUsage(70) },
        { label: '85% (빠름)', click: () => simulateUsage(85) },
        { label: '92% (멈춰!)', click: () => simulateUsage(92) },
        { label: '97% (위기)', click: () => simulateUsage(97) },
        { label: '100% (소진: 흑백 + 영정 띠 + 카운트다운)', click: () => simulateUsage(100) },
        { type: 'separator' },
        { label: '⚠️ 에러 테스트: 로그인 미완료', click: () => simulateError('NO_CREDENTIALS') },
        { label: '⚠️ 에러 테스트: 인증 만료', click: () => simulateError('AUTH_EXPIRED') },
        { label: '⚠️ 에러 테스트: 네트워크 오류', click: () => simulateError('NETWORK_ERROR') },
      ],
    },
    { type: 'separator' },
    {
      label: '위젯 보이기/숨기기',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      },
    },
    {
      label: '❌ 종료',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'images', 'cat1.jpg')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('CCS (ClaudeCodeStatus) · 실시간 사용량');
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

app.whenReady().then(() => {
  // macOS: Dock 아이콘 숨김 (위젯은 메뉴 막대 아이콘으로만 조작)
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createWindow();
  activityMonitor.start();
  createTray();

  pollInterval = setInterval(updateUsage, 5 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 핸들러
ipcMain.on('request-refresh', () => {
  isSimulationActive = false;
  updateUsage();
});
ipcMain.on('close-app', () => app.quit());
ipcMain.on('set-simulation', (_event, percent) => simulateUsage(percent));
// 설정 패널의 'Claude Code 작업 감지' 켜기/끄기: ~/.claude/settings.json에 우리 훅만 추가/제거
ipcMain.handle('set-claude-hooks', (_event, enable) => {
  const result = setHooksInstalled(!!enable);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', settingsPayload());
  }
  return result;
});

// 설정 패널을 열 때 위젯을 활성화(포커스)해 바로 마우스 휠 스크롤이 되게 하고, 닫을 때 포커스를 놓는다.
// (클릭 통과 위젯은 포커스가 없으면 Windows가 휠 입력을 보내 주지 않음 — TROUBLESHOOTING 44)
ipcMain.on('set-window-focus', (_event, focus) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (focus) mainWindow.focus();
  else mainWindow.blur();
});

// 창 위치·모니터 작업 영역 조회 (기본 위치 비율을 정할 때 사용)
ipcMain.handle('get-placement', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const bounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  return {
    bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    isPrimary: display.id === screen.getPrimaryDisplay().id,
  };
});

ipcMain.on('set-ui-scale', (_event, scale) => {
  applyUiScale(Number(scale));
});

ipcMain.on('reset-position', () => {
  if (mainWindow) {
    const defaultPos = getDefaultPosition(...mainWindow.getSize());
    mainWindow.setPosition(defaultPos.x, defaultPos.y);
    saveSettings(defaultPos);
  }
});
ipcMain.on('drag-window', (_event, { deltaX, deltaY }) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    // setPosition만 쓰면 배율이 다른 모니터 사이에서 끌 때 창 크기가 조금씩 커지는 문제가 있어
    // 크기를 현재 글자 크기 기준값으로 고정해서 함께 지정한다.
    const { width, height } = getWindowSize(currentSettings.uiScale || 1);
    mainWindow.setBounds({ x: x + deltaX, y: y + deltaY, width, height });
  }
});
ipcMain.on('set-ignore-mouse-events', (_event, ignore, options) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, options || { forward: true });
  }
});
ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});
ipcMain.on('set-view-mode', (_event, mode) => {
  saveSettings({ viewMode: mode });
  updateUsage();
});
const TIER_IDS = ['state_0_30', 'state_30_60', 'state_60_80', 'state_80_90', 'state_90_94', 'state_95_100'];

ipcMain.on('sync-tier-cat-map', (_event, map) => {
  if (!map || typeof map !== 'object') return;
  const valid = TIER_IDS.every((id) => typeof map[id] === 'string' && /^cat\d+\.jpg$/.test(map[id]));
  if (!valid) return;
  const clean = Object.fromEntries(TIER_IDS.map((id) => [id, map[id]]));
  if (JSON.stringify(clean) === JSON.stringify(currentSettings.tierCatMap)) return;
  saveSettings({ tierCatMap: clean });
});

ipcMain.on('update-settings', (_event, newSettings) => {
  saveSettings(newSettings);
});
