# CCS 배포 가이드

친구들에게 나눠 주는 구조:

```
[비공개] eosangkyung-jpg/sideproj_status   ← 코드 (여기)
   │  v로 시작하는 태그 push
   ▼
GitHub Actions (.github/workflows/release.yml)
   ├─ windows-latest → CCS-Setup.exe
   └─ macos-latest   → CCS-mac.dmg (Intel + Apple Silicon 유니버설)
   ▼
[공개] eosangkyung-jpg/CCS_ClaudeCodeStatus          ← 설치 파일 + 다운로드 페이지만
   ├─ Releases: 최신 설치 파일
   └─ GitHub Pages: https://eosangkyung-jpg.github.io/CCS_ClaudeCodeStatus/
                    (접속한 OS에 맞는 파일을 골라 줌)
```

## 처음 한 번만 하는 설정

1. **공개 저장소 만들기**: GitHub에서 `CCS_ClaudeCodeStatus`라는 이름의 **Public** 저장소를 만든다 (README 체크).
2. **다운로드 페이지 올리기**: 이 저장소의 `release-page/` 안 파일(`index.html`, `icon.png`)을 `CCS_ClaudeCodeStatus` 저장소 루트에 올린다.
3. **GitHub Pages 켜기**: `CCS_ClaudeCodeStatus` → Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save.
4. **토큰 만들기**: GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate
   - Repository access: `Only select repositories` → `CCS_ClaudeCodeStatus`
   - Permissions → Repository permissions → **Contents: Read and write**
5. **토큰 등록**: 코드 저장소 `sideproj_status` → Settings → Secrets and variables → Actions → New repository secret
   - Name: `RELEASES_TOKEN`, Secret: 4에서 만든 토큰

## 새 버전 배포하기

1. `package.json`의 `version`을 올린다 (예: `0.1.0` → `0.2.0`).
2. 커밋 후 태그를 붙여 push:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. GitHub → Actions 탭에서 `Release` 작업이 끝날 때까지 기다린다 (약 5~10분).
4. `CCS_ClaudeCodeStatus` Releases에 `CCS-Setup.exe`, `CCS-mac.dmg`가 올라왔는지 확인.
5. 친구들에게는 항상 같은 링크만 주면 된다: `https://eosangkyung-jpg.github.io/CCS_ClaudeCodeStatus/`

## 로컬에서 직접 빌드 (확인용)

- Windows 설치 파일: `npm run dist` → `dist/CCS-Setup.exe`
- macOS(맥에서만 가능): `npm run dist:mac` → `dist/CCS-mac.dmg`

## 설정 파일 직접 고칠 때

위치: `%APPDATA%\sideproj-status-widget\sideproj-widget-settings.json` (개발 실행), 빌드 앱은 `%APPDATA%\CCS\...`
**앱을 끈 상태에서**, BOM 없는 UTF-8로 저장할 것 (PowerShell `Out-File` 금지 — TROUBLESHOOTING 31번).

## 친구에게 안내할 것

- Claude Code에 로그인되어 있어야 한다 (`claude` 실행 → 로그인).
- Windows: "Windows의 PC 보호" → 추가 정보 → 실행.
- macOS: 처음엔 우클릭 → 열기, 키체인 접근 허용. 막히면 `xattr -cr /Applications/CCS.app`.
- 다운로드 페이지에 같은 안내가 들어 있다.
