// Claude Code 작업 상태 감지 (완전 로컬: 내 컴퓨터의 파일만 본다)
//
// A. 훅(정확): Claude Code 훅이 ~/.claude/ccs/activity 파일에 "<상태> <epoch초>"를 쓴다.
//    working = 질문을 받았거나 도구를 쓰는 중 / waiting = 권한 허락을 기다리는 중 / idle = 답변 끝
// B. 대화 기록(보완): ~/.claude/projects 아래 대화 기록(.jsonl)이 방금 바뀌었으면 작업 중으로 본다.
//    훅을 등록하지 않은 경우, 또는 여러 세션 중 다른 세션이 아직 작업 중인 경우를 보완한다.

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const ACTIVITY_DIR = path.join(CLAUDE_DIR, 'ccs');
const ACTIVITY_FILE = path.join(ACTIVITY_DIR, 'activity');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const CLAUDE_SETTINGS = path.join(CLAUDE_DIR, 'settings.json');

const HOOK_MARK = 'ccs-activity'; // 우리가 넣은 훅을 찾아 지우기 위한 표시
const TRANSCRIPT_ACTIVE_MS = 4000; // 대화 기록이 이 시간 안에 바뀌었으면 작업 중
const WORKING_STALE_MS = 10 * 60 * 1000; // 훅이 working인데 10분간 갱신이 없으면 비정상 종료로 보고 무시
const WAITING_STALE_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// 훅 명령: Claude Code는 Windows(Git Bash)·macOS 모두 bash 계열 셸로 훅을 실행한다.
// 표준 출력으로 아무것도 내보내지 않는다 (UserPromptSubmit의 출력은 대화에 섞이기 때문).
function hookCommand(state) {
  const write = `mkdir -p "$HOME/.claude/ccs" && printf '%s %s\\n' "$s" "$(date +%s)" > "$HOME/.claude/ccs/activity"`;
  if (state === 'notification') {
    // 권한 요청 알림이면 waiting, 그 밖의 알림(입력 대기 등)은 idle
    return `if grep -qi permission; then s=waiting; else s=idle; fi; ${write} # ${HOOK_MARK}`;
  }
  return `s=${state}; ${write} # ${HOOK_MARK}`;
}

const HOOK_EVENTS = [
  { event: 'UserPromptSubmit', state: 'working' },
  { event: 'PreToolUse', state: 'working', matcher: '*' },
  { event: 'PostToolUse', state: 'working', matcher: '*' },
  { event: 'Notification', state: 'notification' },
  { event: 'Stop', state: 'idle' },
  { event: 'SessionEnd', state: 'idle' },
];

function readClaudeSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS)) return {};
  const raw = fs.readFileSync(CLAUDE_SETTINGS, 'utf8').replace(/^﻿/, '');
  return raw.trim() ? JSON.parse(raw) : {};
}

function isOurHookEntry(entry) {
  return Array.isArray(entry && entry.hooks) && entry.hooks.some((h) => String(h.command || '').includes(HOOK_MARK));
}

function areHooksInstalled() {
  try {
    const s = readClaudeSettings();
    return !!(s.hooks && Object.values(s.hooks).some((list) => Array.isArray(list) && list.some(isOurHookEntry)));
  } catch (e) {
    return false;
  }
}

// 설정 파일을 읽지 못하면(형식 오류 등) 절대 덮어쓰지 않는다.
function setHooksInstalled(enable) {
  let settings;
  try {
    settings = readClaudeSettings();
  } catch (e) {
    return { ok: false, error: 'Claude Code 설정 파일(~/.claude/settings.json)을 읽을 수 없어 변경하지 않았습니다.' };
  }

  // 처음 한 번 원본 백업
  const backup = CLAUDE_SETTINGS + '.ccs-backup';
  if (fs.existsSync(CLAUDE_SETTINGS) && !fs.existsSync(backup)) {
    fs.copyFileSync(CLAUDE_SETTINGS, backup);
  }

  const hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
  // 기존에 우리가 넣은 항목은 먼저 모두 제거 (중복 방지, 다른 훅은 그대로 둠)
  for (const key of Object.keys(hooks)) {
    if (!Array.isArray(hooks[key])) continue;
    hooks[key] = hooks[key].filter((entry) => !isOurHookEntry(entry));
    if (hooks[key].length === 0) delete hooks[key];
  }
  if (enable) {
    for (const { event, state, matcher } of HOOK_EVENTS) {
      const entry = { hooks: [{ type: 'command', command: hookCommand(state) }] };
      if (matcher) entry.matcher = matcher;
      (hooks[event] = hooks[event] || []).push(entry);
    }
  }
  if (Object.keys(hooks).length) settings.hooks = hooks;
  else delete settings.hooks;

  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  if (!enable) {
    try { fs.unlinkSync(ACTIVITY_FILE); } catch (e) {}
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
function readHookState() {
  try {
    const [state, ts] = fs.readFileSync(ACTIVITY_FILE, 'utf8').trim().split(/\s+/);
    return { state, at: Number(ts) * 1000 };
  } catch (e) {
    return null;
  }
}

function createActivityMonitor(onChange) {
  let lastTranscriptChange = 0;
  let current = 'idle';
  let watcher = null;
  let timer = null;

  function startTranscriptWatch() {
    if (watcher || !fs.existsSync(PROJECTS_DIR)) return;
    try {
      // Windows·macOS는 하위 폴더까지 감시(recursive) 지원
      watcher = fs.watch(PROJECTS_DIR, { recursive: true }, (_type, filename) => {
        if (filename && String(filename).endsWith('.jsonl')) lastTranscriptChange = Date.now();
      });
      watcher.on('error', () => { watcher = null; });
    } catch (e) {
      watcher = null;
    }
  }

  function compute() {
    const now = Date.now();
    const transcriptActive = now - lastTranscriptChange < TRANSCRIPT_ACTIVE_MS;
    const hook = readHookState();

    let state = 'idle';
    if (hook && hook.state === 'working' && now - hook.at < WORKING_STALE_MS) state = 'working';
    else if (hook && hook.state === 'waiting' && now - hook.at < WAITING_STALE_MS) state = 'waiting';
    // 훅이 idle이어도(다른 세션이 끝났을 수 있음) 대화 기록이 방금 바뀌었으면 작업 중
    if (state === 'idle' && transcriptActive) state = 'working';
    return state;
  }

  function tick() {
    startTranscriptWatch(); // projects 폴더가 나중에 생겨도 감시 시작
    const next = compute();
    if (next !== current) {
      current = next;
      onChange(current);
    }
  }

  return {
    start() {
      tick();
      timer = setInterval(tick, 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      if (watcher) watcher.close();
      timer = null;
      watcher = null;
    },
    get state() {
      return current;
    },
  };
}

module.exports = {
  createActivityMonitor,
  areHooksInstalled,
  setHooksInstalled,
  ACTIVITY_FILE,
};
