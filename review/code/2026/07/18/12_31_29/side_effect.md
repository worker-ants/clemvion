# 부작용(Side Effect) 리뷰

## 리뷰 대상
- `.claude/tools/bootstrap-session.sh` (마커를 lockfile 해시에 결속 — §2 설치 게이트 재작성)
- `.claude/tests/test_bootstrap_mermaid_install.py` (신규 테스트 2건 추가)
- `.github/dependabot.yml` (npm ecosystem 엔트리 신설, `/.claude/tools/mermaid-lint`)
- `.claude/tools/mermaid-lint/package-lock.json` (undici 7.27.0→7.28.0, dompurify 3.4.7→3.4.12)
- `PROJECT.md` (거버넌스 서술 1문장 추가)

이 diff 는 직전 라운드(`review/code/2026/07/18/12_06_58`) side_effect 리뷰의 **WARNING W1**("마커가 lockfile 과 무관해 이미 install 을 마친 checkout 에는 보안 픽스가 전파되지 않음")에 대한 해소 커밋이다. 아래는 그 해소 자체가 새로 만든/남긴 부작용 관점 검토다.

### 발견사항

- **[WARNING]** `want_hash` 를 `npm install` **실행 전** lockfile 스냅샷으로 계산해 마커에 그대로 기록 — `npm install` 이 그 lockfile 자체를 변형할 가능성에 대한 방어가 없음
  - 위치: `.claude/tools/bootstrap-session.sh:115`(`want_hash=$(_lock_hash)`, install 이전 1회 계산) ↔ `:127-128`(`npm install` 성공 후 **같은** `$want_hash` 를 마커에 기록)
  - 상세: `_lock_hash()` 는 `npm install` 을 실행하기 *전* 시점의 `package-lock.json` 내용을 해시한다. 그런데 `npm install --no-fund --no-audit --silent` 은 `--no-save`/`npm ci` 가 아니라서, 로컬 npm 이 (버전 차이·lockfileVersion 정규화 등으로) install 도중 `package-lock.json` 을 다시 써버리면, 마커에 저장되는 해시(install *이전* 스냅샷)와 install *이후* 디스크에 남는 실제 파일 내용이 서로 어긋난다. 다음 SessionStart 는 (install 후) 현재 파일을 다시 해시해 마커와 비교하므로, 어긋난 상태라면 불필요한 재설치가 한 번 더 트리거된다(트레이스상 무한 루프는 아니고 1회 추가 사이클로 수렴하지만, 이는 이 스크립트 파일 헤더가 명시하는 "Idempotent and fast on repeat runs" 계약을 국소적으로 깨는 형태다). 더 중요한 축은 방향성이다 — **SessionStart 훅이 git 추적 대상 파일(`package-lock.json`, `node_modules` 와 달리 gitignore 되지 않음)을 개발자가 인지하지 못한 채 갱신할 수 있다** — `git status`/`git diff` 에 예상 못한 dirty 파일로 나타나거나, 무관한 후속 커밋에 섞여 들어갈 위험(체크리스트 항목3 "파일시스템 부작용: 예상치 못한 파일 수정").
    실측(본 리뷰에서 직접 검증, repo 밖 scratch 격리 디렉터리 사용): 현재 커밋된 lockfile(`lockfileVersion:3`)을 `npm 10.9.2` 로 (a) node_modules 없는 최초 설치, (b) node_modules 있는 재설치 두 경우 모두 실행해 `package-lock.json` 해시가 install 전후 **동일함**을 확인했다 — 이 npm 버전에서는 재현되지 않는다. 또한 bumped 버전(undici 7.28.0/dompurify 3.4.12)이 반영된 실제 `node_modules` 로 `lint-mermaid.mjs` 를 정상 mermaid·비정상 mermaid 양쪽에 대해 실행해 봐도 정확히 exit 0 / exit 1(파스 에러 메시지)로 동작해 의존성 범프 자체의 기능 회귀도 없음을 확인했다.
    따라서 이 항목은 **오늘 재현된 결함이 아니라, 이 diff 가 새로 만든 "설계상 미방어 지점"**이다 — 이 harness 툴은 npm 버전을 핀하지 않으므로(레포 전체 정책은 pnpm workspace 이고, 이 독립 트리는 그 밖) 개발자마다 다른 로컬 npm 이 실행되고, 어떤 npm 버전·환경에서 lockfile 정규화가 실제로 발생할지는 이 리뷰의 범위를 넘는다.
  - 제안: `npm install` 대신 `npm ci`(존재하는 lockfile 을 신뢰 소스로 취급하고 **결코 lockfile 을 재기록하지 않음`, 대신 `package.json`/lockfile 불일치 시 명시적으로 실패)로 교체하거나, 최소한 `--no-save` 추가. 혹은 `printf` 로 마커를 쓰기 직전에 `_lock_hash` 를 **install 이후** 다시 호출해 실제 디스크 상태를 기록(자기 교정)하는 방식으로 바꾸면 두 값이 항상 일치를 보장한다.

- **[INFO]** 마커 콘텐츠 포맷 변경(0-byte sentinel → lockfile 해시 문자열)이 기존 3개 소비처를 깨지 않음을 코드 추적으로 확인
  - 위치: `.claude/tools/bootstrap-session.sh:128`(`printf '%s\n' "$want_hash" > "$marker"`, 이전엔 `: > "$marker"`) ↔ `.claude/hooks/_lib/mermaid_lint_ready.py:41-46`(`is_ready()`) ↔ `.githooks/pre-commit`, `.claude/hooks/lint_mermaid_posttooluse.py`
  - 상세: 마커를 실제로 읽는 세 소비처(pre-commit 훅, PostToolUse 훅, 이 둘이 공유하는 `mermaid_lint_ready.py`)는 모두 `os.path.isfile(...)` / `[ -f ... ]` 로 **존재 여부만** 판정하고 콘텐츠는 절대 파싱하지 않는다(`test_mermaid_lint_ready.py` 로도 재확인). 콘텐츠가 빈 문자열에서 SHA-256 해시로 바뀌어도 세 소비처 모두 영향 없음 — 이 diff 가 저장 포맷을 바꾸면서 다른 리더를 깨뜨리는 시그니처/인터페이스 부작용은 없다.

- **[INFO]** 이 diff 자체가 "이미 정상 설치를 마친 기존 checkout" 에 1회성 재설치를 유발함 — 의도된 자기치유이나 이를 못박는 회귀 테스트는 없음
  - 위치: `.claude/tools/bootstrap-session.sh:118-122`(마커 부재 OR 해시 불일치 시 `need_install=1`)
  - 상세: `ceee1fa5b` 이후 이미 빈 콘텐츠(`: > marker`) 마커를 가진 체크아웃은, 이 diff 반영 다음 SessionStart 에서 `want_hash`(비어있지 않음) ≠ `cat marker`(빈 문자열) 로 판정되어 **정확히 1회** 재설치가 트리거된다. 이는 이번 보안 픽스를 이미-설치된 트리에도 전파한다는 이 diff 의 목적과 정확히 부합하는 의도된 부작용이지만, `test_bootstrap_mermaid_install.py` 의 신규 테스트 2건(`test_lockfile_change_retriggers_install`, `test_unchanged_lockfile_does_not_reinstall`)은 모두 "새 포맷 마커 → 새 포맷 마커" 전이만 다루고, "구 포맷(빈 콘텐츠) 마커 → 신 포맷" 전이는 별도로 pin 하지 않는다. 코드 추적으로는 정확히 동작함을 확인했으나(위 WARNING 항목과 별개로), 향후 리팩터가 이 전이를 조용히 깨도 CI 가 못 잡는 gap 이다.
  - 제안 (선택적): `self._write(marker, "")` 로 구-포맷 마커를 미리 만들어 두고 1회 재설치 후 신-포맷으로 갱신되는지 보는 테스트 케이스 1건 추가 검토.

- **[INFO]** `.github/dependabot.yml` 신규 npm 엔트리 — 의도된 신규 자동화 표면, auto-merge 결합 없음 확인
  - 위치: `.github/dependabot.yml:14-18`
  - 상세: 이 항목은 GitHub Dependabot 서비스가 `/.claude/tools/mermaid-lint` 를 대상으로 매주 PR 을 여는 새로운 외부 자동화를 켠다(체크리스트 항목7 "네트워크 호출/외부 서비스" 에 형식적으로 해당). `.github/workflows/` 전수 검색 결과 dependabot PR 을 자동 병합하는 워크플로는 없어 — 실제 의존성 반영은 여전히 사람 리뷰·머지를 거친다. 직전 라운드 INFO(주석이 "보안 전용" 처럼 읽히나 실제로는 weekly version-update 스키마)도 이번 주석이 "스케줄 version-update(주간)" 으로 정확히 재서술해 해소했다.

- **[INFO]** 시그니처/공개 인터페이스/환경변수/이벤트-콜백 변경 없음
  - 상세: `bootstrap-session.sh` 는 인자 없이 호출되고 항상 `exit 0` 인 계약을 그대로 유지한다(`.claude/settings.json` SessionStart 훅 호출부 무변경). `_lock_hash()` 는 신규 내부 함수이나 외부에 노출되지 않는다. 읽는 환경변수는 기존 `MERMAID_INSTALL_RETRY_SEC` 뿐, 신규 환경변수 없음. `PROJECT.md` 변경은 실행되지 않는 산문 1문장 추가뿐이라 런타임 부작용 없음.

### 요약
이번 diff 의 핵심 변경(마커를 lockfile 해시에 결속)은 직전 라운드가 지적한 "보안 픽스가 이미 설치된 트리에 전파되지 않는" 구조적 갭을 올바르게 닫는다 — 마커를 실제로 읽는 3개 소비처(pre-commit/PostToolUse/공유 SoT)는 존재 여부만 확인하므로 콘텐츠 포맷 변경(빈 파일→해시)이 하위 호환을 깨지 않음을 코드·테스트 추적으로 확인했고, 의존성 범프 자체(undici/dompurify)도 실제로 `lint-mermaid.mjs` 를 정상/비정상 mermaid 양쪽에 돌려 기능 회귀가 없음을 실측했다. 다만 새 메커니즘은 `npm install` 실행 **이전** 시점의 lockfile 스냅샷을 해시해 그대로 마커에 남기면서, `npm install` 이 그 파일 자체를 변형하지 않는다는 가정에 명시적 방어(`npm ci`/`--no-save`) 없이 기대고 있다 — 이 저장소는 이 harness 트리의 npm 버전을 핀하지 않으므로, 어떤 로컬 npm 조합에서는 SessionStart 훅이 git 추적 대상 lockfile 을 조용히 재기록하고 다음 세션에 스퓨리어스 재설치를 유발할 여지가 이론상 남는다(현재 npm 10.9.2 로는 재현되지 않음을 확인). Dependabot 신규 엔트리는 의도된 자동화 확장이고 auto-merge 결합이 없어 안전하며, 그 외 파일(PROJECT.md, 테스트 추가분)은 순수 문서·테스트 변경으로 부작용이 없다.

### 위험도
LOW
