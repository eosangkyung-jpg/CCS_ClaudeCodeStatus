# CCS 배포 기록 및 가이드

> 대상 저장소: https://github.com/eosangkyung-jpg/CCS_ClaudeCodeStatus
> 최종 갱신: 2026-11-05
> 이 문서 하나에 배포 구조, 설정 현황, 배포 방법, 지금까지의 시도와 실패, 남은 일을 모은다. (구 `RELEASE.md` 내용 포함)

---

## 1. 한눈에 보기

| 항목 | 주소 / 값 |
|---|---|
| 코드 저장소 (비공개) | https://github.com/eosangkyung-jpg/sideproj_status |
| 배포 저장소 (공개) | https://github.com/eosangkyung-jpg/CCS_ClaudeCodeStatus |
| 설치 파일 (Releases) | https://github.com/eosangkyung-jpg/CCS_ClaudeCodeStatus/releases |
| **친구에게 줄 링크** (다운로드 페이지) | https://eosangkyung-jpg.github.io/CCS_ClaudeCodeStatus/ |
| 자동 빌드 실행 기록 | https://github.com/eosangkyung-jpg/sideproj_status/actions |
| Windows 설치 파일 고정 링크 | https://github.com/eosangkyung-jpg/CCS_ClaudeCodeStatus/releases/latest/download/CCS-Setup.exe |
| macOS 설치 파일 고정 링크 | https://github.com/eosangkyung-jpg/CCS_ClaudeCodeStatus/releases/latest/download/CCS-mac.dmg |

- 앱 이름: **CCS (ClaudeCodeStatus)** — Claude 플랜 사용량만 조회 (Gemini 기능은 삭제됨)
- 배포 대상: 같이 일하는 친구들 (공개 배포·판매 없음)
- 현재 앱 버전: `0.1.1` (`package.json`)

## 2. 배포 구조

```
[비공개] sideproj_status            ← 코드
   │  v로 시작하는 태그 push (예: v0.1.2)
   ▼
GitHub Actions (.github/workflows/release.yml)
   ├─ windows-latest  → CCS-Setup.exe
   └─ macOS 러너      → CCS-mac.dmg (Intel + Apple Silicon 유니버설)
   ▼  (Secret RELEASES_TOKEN으로 업로드)
[공개] CCS_ClaudeCodeStatus          ← 설치 파일 + 다운로드 페이지만
   ├─ Releases: 버전별 설치 파일
   └─ GitHub Pages(main / root): index.html, icon.png, README.md
        → 접속한 OS를 감지해 맞는 설치 파일 버튼을 보여 줌
```

- 코드를 비공개로 둔 이유: 예전 Git 기록에 개인 계정 정보(구 Gemini 결제 계정 ID)가 남아 있음.
- 설치 파일 이름은 버전과 무관하게 고정(`CCS-Setup.exe`, `CCS-mac.dmg`) → `releases/latest/download/<파일명>` 링크가 항상 최신 버전을 가리킨다.

### 관련 파일 (코드 저장소)

| 파일 | 역할 |
|---|---|
| `.github/workflows/release.yml` | 태그 push 시 Windows·macOS 빌드 후 배포 저장소에 업로드 |
| `package.json` → `build` | electron-builder 설정: 파일 이름, Windows nsis, macOS universal dmg + ad-hoc 서명(`identity: "-"`), `publish` 대상 |
| `release-page/index.html`, `icon.png` | 다운로드 페이지 원본 (배포 저장소 루트에 올림) |
| `src/assets/icon.ico`, `src/assets/icon-mac.png` | Windows / macOS 앱 아이콘 |

## 3. 설정 현황 (처음 한 번만)

| # | 작업 | 상태 |
|---|---|---|
| 1 | 공개 저장소 `CCS_ClaudeCodeStatus` 생성 | ✅ 완료 |
| 2 | `index.html`, `icon.png`, `README.md` 업로드 (커밋 `c7fc71b`) | ✅ 완료 |
| 3 | GitHub Pages 켜기 (Deploy from a branch → `main` / `(root)`) | ✅ 완료, 페이지 열림 확인 |
| 4 | Fine-grained 토큰 생성 (대상: `CCS_ClaudeCodeStatus`만, 권한: Contents Read and write) | ✅ 완료 |
| 5 | 코드 저장소 Secret `RELEASES_TOKEN` 등록 | ✅ 완료 |

- 토큰은 만료일이 있다. 만료되면 업로드 단계가 권한 오류로 실패하므로 같은 방법으로 새로 만들어 Secret을 교체한다.
- Contents 쓰기 권한이 필요한 이유: GitHub에서 Release 생성·파일 첨부가 Contents 권한에 속함. 범위는 배포 저장소 하나로 제한.

## 4. 새 버전 배포 방법

1. 코드 수정 → `npm start`로 확인 → 커밋 → `main`에 push
2. **테스트 시뮬레이션 바가 숨겨져 있는지 확인** (`src/renderer/index.html`의 `#simBar`에 `style="display: none;"`)
3. 버전 올리기: `package.json`과 `package-lock.json`(최상단 `version`, `packages[""].version`)
   - 버그 수정 `0.1.1 → 0.1.2`, 기능 추가 `0.1.x → 0.2.0`
4. 태그 push
   ```bash
   git tag -a v0.1.2 -m "CCS v0.1.2"
   git push origin v0.1.2
   ```
5. Actions에서 두 작업이 ✅인지 확인 (Windows 약 5분, macOS 10분 이상)
6. 배포 저장소 Releases에 `CCS-Setup.exe`, `CCS-mac.dmg`가 모두 있는지, 다운로드 페이지 버튼이 받아지는지 확인
7. 친구들에게 새 버전 안내 (자동 업데이트 없음 → 다운로드 페이지에서 다시 받아 설치. Windows는 덮어쓰기, 설정 유지)

주의:
- 워크플로 파일을 고친 경우 **Re-run이 아니라 새 태그**로 실행해야 반영된다 (Re-run은 당시 커밋의 워크플로를 그대로 사용).
- 일부 파일만 올라간 Release가 생기면 그 Release가 "최신"이 되어 다운로드 링크가 404가 된다 → 즉시 그 Release와 태그를 지운다 (5장 참고).

### 로컬 빌드 (확인용)
- Windows: `npm run dist` → `dist/CCS-Setup.exe` (2026-11-04 로컬 빌드 성공, 126MB)
- macOS: `npm run dist:mac` → `dist/CCS-mac.dmg` (Mac에서만 가능)

## 5. 배포 시도 기록

| 일시 | 태그 | 결과 |
|---|---|---|
| 2026-11-04 23:08 | `v0.1.0` | Windows: `CCS-Setup.exe`는 올라갔으나 이후 부가 파일 업로드 중 `Release: Internal server error`(GitHub 500)로 실패 표시. macOS(`macos-latest`, arm64): `The job was not acquired by Runner of type hosted even after multiple attempts` — 빌드 서버 배정 실패로 시작도 못 함 |
| 2026-11-04 23:37 | `v0.1.0` 재실행 | Windows ✅ 성공 (`CCS-Setup.exe`, blockmap, `latest.yml`). macOS 다시 배정 실패 → 취소 |
| 2026-11-05 00:03 | `v0.1.1` | macOS 러너를 `macos-15-intel`로 변경, actions v5·Node 22로 올림. Windows: 업로드 중 다시 GitHub 500 → **blockmap만 올라간 반쪽 Release가 "최신"이 되어 다운로드 링크 404**. macOS: Intel 러너도 배정 실패 |
| 2026-11-05 | — | 배포 저장소의 Releases를 모두 삭제 (다시 정비 후 배포 예정) |

진단 메모:
- 같은 시각 GitHub 상태 페이지는 "All Systems Operational".
- macOS 러너 배정 실패가 arm64·Intel 모두에서 3번 연속 → 단순 혼잡이 아니라 **비공개 저장소의 macOS 러너 사용 제한(계정 사용량/설정)** 가능성. 비공개 저장소에서 macOS 러너는 사용 시간이 10배로 계산됨. 계정 Settings → Billing → Actions 사용량 확인 필요.
- Windows 업로드 500은 electron-builder가 두 작업에서 각각 같은 Release에 직접 업로드하는 구조에서 발생. 실패 시 반쪽 Release가 남는 것이 가장 큰 문제.

## 6. 현재 상태 (2026-11-05)

- 배포 저장소 Releases: **없음** → 다운로드 페이지 버튼은 지금 404. **새 배포 전까지 친구에게 링크 공유 금지.**
- 남아 있는 태그
  - 배포 저장소: `v0.1.0`, `v0.1.1` (Release 삭제 후에도 태그는 남음 → Tags 페이지에서 삭제 필요)
  - 코드 저장소: `v0.1.0`, `v0.1.1`
- 다음 배포는 새 번호(`v0.1.2` 이상)로 하는 것이 안전. `v0.1.0`부터 다시 쓰려면 양쪽 저장소의 기존 태그를 먼저 삭제.
- 로컬: 테스트 시뮬레이션 바는 숨김 상태(2026-11-05 세션 종료 시 정리). 앱 버전은 아직 0.1.1 — 다음 배포 때 0.1.2 이상으로 올릴 것.
- v0.1.1 이후 추가된 기능(작업 중 스피너·훅, 사진 풀 60장·구도 조정, 붉은 막·영정 띠, 시작 위치 비율, 경고 효과 옵션, 마비옛체 폰트 등)은 아직 배포되지 않음.

## 7. 다음 배포 전에 할 일

1. **업로드 구조 변경 (A안, 필수)**
   - 빌드 작업(Windows, macOS)은 설치 파일만 만들어 Actions 아티팩트로 보관 (`--publish never`).
   - 마지막 업로드 작업 하나가 모든 빌드 성공 시에만 Release를 만들고 파일을 한꺼번에 업로드, 실패 시 재시도.
   - 파일이 다 준비되지 않으면 Release를 만들지 않음 → 반쪽 Release·깨진 링크 방지.
2. **macOS 처리 방식 결정**
   - ① 우선 Windows만 배포, 다운로드 페이지의 Mac 버튼은 "준비 중" 표시 (추천)
   - ② 코드 저장소 공개 전환 (공개 저장소는 macOS 러너 무료·무제한). 단 Git 기록의 계정 정보 정리 필요
   - ③ Mac 쓰는 친구에게 `npm run dist:mac` 직접 빌드 부탁
3. 배포 저장소의 남은 태그 `v0.1.0`, `v0.1.1` 정리

## 8. 친구에게 안내할 것

- Claude Pro / Max 구독 + **Claude Code 로그인** 필요 (터미널에서 `claude` 실행 → 로그인).
- Windows: "Windows의 PC 보호" 창 → **추가 정보 → 실행** (코드 서명 없음).
- macOS: 처음엔 **우클릭 → 열기**, "키체인 접근 허용" 창에서 **허용** (Claude Code 로그인 정보를 읽기만 함). 막히면 터미널에서 `xattr -cr /Applications/CCS.app`.
- 로그인 정보와 사용량은 내 컴퓨터 밖으로 나가지 않는다 (Anthropic에 직접 조회).
- 다운로드 페이지에 같은 안내가 들어 있다.

## 9. 설정 파일을 직접 고칠 때

- 위치: `%APPDATA%\sideproj-status-widget\sideproj-widget-settings.json` (개발 실행), 빌드 앱은 `%APPDATA%\CCS\...`
- **앱을 끈 상태에서**, BOM 없는 UTF-8로 저장 (PowerShell `Out-File` 금지 — TROUBLESHOOTING 31번).

## 관련 기록 (TROUBLESHOOTING.md)

- 32번: 앱 이름 CCS 확정, 정책 내용 삭제
- 33번: 친구 배포 구조 구축 (Mac 지원, 자동 빌드, 다운로드 페이지)
- 34번: Gemini 기능 삭제
- 35번: Initial commit의 node_modules로 push 거부 → 기록 정리
- 36번: 첫 배포 Mac 러너 배정 실패 → Intel 러너 변경, v0.1.1
