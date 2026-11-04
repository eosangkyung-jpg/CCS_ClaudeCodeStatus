const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { fetchUsageData, resolveState, calculatePace } = require('./services/usageService');
const { fetchGeminiBillingData, resolveGeminiState, calculateCreditPace, TOTAL_FREE_CREDIT_KRW } = require('./services/geminiBillingService');

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

const DEFAULT_SETTINGS = {
  notifyBubble: true,
  notifyToast: true,
  openAtLogin: false,
  bubbleDuration: 3500,
  alertRules: DEFAULT_ALERT_RULES,
};

let currentSettings = { ...DEFAULT_SETTINGS };

const SETTINGS_FILE = path.join(app.getPath('userData'), 'sideproj-widget-settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      currentSettings = {
        ...DEFAULT_SETTINGS,
        ...saved,
        alertRules: {
          ...DEFAULT_ALERT_RULES,
          ...(saved.alertRules || {}),
        },
      };
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
        app.setLoginItemSettings({
          openAtLogin: settings.openAtLogin,
          path: app.getPath('exe'),
        });
      } catch (e) {
        console.warn('openAtLogin 설정 실패:', e.message);
      }
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2), 'utf8');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-updated', currentSettings);
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

  let title = `[Gemini 크레딧] ${stateInfo.label} (${percent}% 소진)`;
  let body = stateInfo.quote;
  let iconFile = stateInfo.iconFile || (stateInfo.id + '.jpg');

  if (isReset) {
    title = '🎉 [Gemini 크레딧] 크레딧 갱신 완료!';
    body = '새로운 크레딧 주기가 시작되었습니다.';
  } else if (stateInfo.id === 'state_95_100') {
    title = percent >= 100 ? '⛔ [Gemini 크레딧] 체험 크레딧 완전 소진!' : `🚨 [Gemini 크레딧] 소진 임박 (${percent}%)`;
  } else if (stateInfo.id === 'state_90_94') {
    title = `⚠️ [Gemini 크레딧] 멈춰! (${percent}%)`;
  }

  // 1. 캐릭터 위 일시적 말풍선 팝업
  if (currentSettings.notifyBubble && rule.bubble && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('trigger-bubble-alert', {
      duration: currentSettings.bubbleDuration || 3500,
      title,
      body,
      isReset,
    });
  }

  // 2. Windows 네이티브 토스트 알림
  if (currentSettings.notifyToast && rule.toast && Notification.isSupported()) {
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

function getDefaultPosition(width, height) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  return {
    x: Math.round(workArea.x + workArea.width - width - 30),
    y: Math.round(workArea.y + workArea.height - height - 30),
  };
}

function createWindow() {
  const windowWidth = 340;
  const windowHeight = 540;

  const savedSettings = loadSettings();
  const defaultPos = getDefaultPosition(windowWidth, windowHeight);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: savedSettings.x ?? defaultPos.x,
    y: savedSettings.y ?? defaultPos.y,
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

  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    saveSettings({ x, y });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.webContents.send('settings-updated', currentSettings);
    updateUsage();
  });
}

async function updateUsage() {
  if (!mainWindow || isSimulationActive) return;
  try {
    const [claudeData, geminiData] = await Promise.all([
      fetchUsageData().catch((err) => ({ success: false, errorMessage: err.message })),
      fetchGeminiBillingData(TOTAL_FREE_CREDIT_KRW).catch((err) => ({ success: false, errorMessage: err.message })),
    ]);

    const claudePercent = claudeData.success ? Math.round(claudeData.session.percent) : 0;
    const geminiPercent = geminiData.success ? geminiData.billing.consumedPercent : 0;
    const maxPercent = Math.max(claudePercent, geminiPercent);

    const primaryState = claudeData.success ? claudeData.state : resolveGeminiState(geminiPercent);

    const payload = {
      success: claudeData.success || geminiData.success,
      claude: claudeData.success ? claudeData : null,
      gemini: geminiData.success ? geminiData : null,
      state: primaryState,
      primaryPercent: maxPercent,
      fetchedAt: new Date().toISOString(),
    };

    mainWindow.webContents.send('usage-updated', payload);

    if (payload.success) {
      notifyStateChange(primaryState, maxPercent, false);
    }
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

  const totalCredit = TOTAL_FREE_CREDIT_KRW;
  const spentKrw = Math.round((totalCredit * percent) / 100);
  const remainingKrw = Math.max(0, totalCredit - spentKrw);
  const creditPaceInfo = calculateCreditPace(spentKrw, totalCredit);

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
    gemini: {
      success: true,
      billing: {
        projectId: 'gmp-demo-project-478303576',
        billingAccountId: '011F0E-845EBB-D70DB3',
        totalCreditKrw: totalCredit,
        spentKrw: spentKrw,
        remainingKrw: remainingKrw,
        consumedPercent: percent,
        currency: 'KRW',
      },
      pace: creditPaceInfo,
    },
    state: stateInfo,
    primaryPercent: percent,
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
          const defaultPos = getDefaultPosition(280, 420);
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
      label: '🔔 마스터 알림 스위치',
      submenu: [
        {
          label: '💬 캐릭터 말풍선 팝업 전체',
          type: 'checkbox',
          checked: currentSettings.notifyBubble,
          click: (item) => saveSettings({ notifyBubble: item.checked }),
        },
        {
          label: '🪟 Windows 토스트 알림 전체',
          type: 'checkbox',
          checked: currentSettings.notifyToast,
          click: (item) => saveSettings({ notifyToast: item.checked }),
        },
      ],
    },
    {
      label: '🧪 테스트 시뮬레이션',
      submenu: [
        { label: '0% (초기 상태)', click: () => simulateUsage(5) },
        { label: '25% (여유: 일라이저 우드)', click: () => simulateUsage(25) },
        { label: '45% (안정: 린마누엘)', click: () => simulateUsage(45) },
        { label: '70% (고민: 비버 웅크림)', click: () => simulateUsage(70) },
        { label: '85% (기도: 비버 기도)', click: () => simulateUsage(85) },
        { label: '92% (경고: 비버 손바닥 스톱)', click: () => simulateUsage(92) },
        { label: '97% (멘붕: 비버 농구공)', click: () => simulateUsage(97) },
        { label: '100% (소진: 비버 흑백+타이머)', click: () => simulateUsage(100) },
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
  tray.setToolTip('실시간 Claude 사용량 위젯');
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
  createWindow();
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
ipcMain.on('reset-position', () => {
  if (mainWindow) {
    const defaultPos = getDefaultPosition(280, 420);
    mainWindow.setPosition(defaultPos.x, defaultPos.y);
    saveSettings(defaultPos);
  }
});
ipcMain.on('drag-window', (_event, { deltaX, deltaY }) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(x + deltaX, y + deltaY);
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
ipcMain.on('update-settings', (_event, newSettings) => {
  saveSettings(newSettings);
});
