### 발견사항

- **[WARNING]** `bootstrap-session.sh` 세 곳의 "once"/"one-time" 표현이 이번 diff 가 도입한 재설치 가능성과 모순
  - 위치: `.claude/tools/bootstrap-session.sh:13`(파일 최상단 "Four responsibilities" 항목 2), `:34`(섹션 2 헤더 주석), `:126`(런타임 `echo` 메시지, 세션 콘솔에 실제 노출)
  - 상세: 이번 diff 의 핵심은 설치완료 마커를 `package-lock.json` 해시에 결속해, lockfile 이 바뀌면(전형적으로 이 diff 가 같은 커밋에서 `.github/dependabot.yml` 에 등록한 Dependabot 보안 bump PR 이 머지될 때) **이미 설치된 checkout 도 재설치**되게 만드는 것이다 — 새로 추가된 `_lock_hash()`/`need_install` 로직과 그 위 장문 설계주석("A changed lockfile … no longer matches, so the next SessionStart reinstalls")이 정확히 이를 설명한다. 그런데 같은 파일의 다른 세 곳은 여전히 "설치는 평생 한 번뿐"이라고 말한다: 최상단 목록의 "Install the mermaid-lint tooling deps **once**", 섹션 2 헤더의 "install **once**; skip if already present", 그리고 설치 시 실제로 세션에 출력되는 런타임 메시지 `"bootstrap: installing mermaid-lint deps (**one-time**)…"`. 세 곳 모두 이번 diff 의 변경 라인 밖(unchanged context)이라 자동으로는 안 걸렸지만, 새 설계주석과 바로 인접해 있어 같은 PR 안에서 정정하기 가장 쉬운 위치였다. 특히 line 126 은 사용자-가시 문자열이라, 향후 재설치가 실제로 일어날 때(= 이 diff 가 의도적으로 설계한 정상 경로) "one-time"이라는 이제는 틀린 신호를 그대로 노출한다.
  - 제안: 세 곳 모두 "설치 후 lockfile 이 바뀌면 재설치"로 완화. 예: line 13 → "Install the mermaid-lint tooling deps in the MAIN checkout, reinstalling when the lockfile changes (e.g., a security bump) — node_modules is gitignored, so worktrees share this single copy."; line 34 → "# 2. Ensure mermaid-lint deps are installed and match the current lockfile (skip if already current)."; line 126 → "(one-time)" 삭제(또는 최초설치/재설치를 구분해 동적 문구 선택).

- **[WARNING]** `.claude/tests/README.md` 커버리지 표 + 테스트 모듈 docstring 이 새로 추가된 lockfile-해시 결속 동작을 반영하지 않음
  - 위치: `.claude/tests/README.md:34`, `.claude/tests/test_bootstrap_mermaid_install.py:1-23`(모듈 docstring)
  - 상세: `.claude/tests/README.md` 는 "## What's covered" 표로 테스트 파일마다 무엇을 가드하는지 한 줄 요약하는, 이 저장소가 실제로 매 관련 커밋마다 갱신해온 인덱스다 — 34행은 바로 직전 커밋(`ceee1fa5b`, #976 "마커-only" 재작성)에서 마지막으로 갱신됐다(`git log -1 -- .claude/tests/README.md` 로 확인). 이번 커밋(`c5fdd1bb8`)이 `test_bootstrap_mermaid_install.py` 에 새 동작(마커를 lockfile 해시에 결속) + 전용 테스트 2건(`test_lockfile_change_retriggers_install`, `test_unchanged_lockfile_does_not_reinstall`)을 추가했음에도, README 표의 해당 행과 테스트 파일 자체의 모듈 docstring(파일 최상단 "these tests pin what it does" 불릿 3개)은 그대로다 — 넷째 항목(lockfile 변경 시 재설치)이 어디에도 요약돼 있지 않다. 이는 이 PR 이 고치려는 실패 유형("마커의 존재만 보고 안심하지만 실제로는 최신이 아님")과 같은 모양의 문서 버전이다: README 표만 읽는 독자는 이 guard 가 여전히 순수 marker-presence 기반이라고 오해한다. 강제하는 CI 가드는 없음(비차단이지만 실질 정보 손실). 새로 추가된 두 테스트 메서드 자체의 로컬 docstring 은 충분히 상세하므로(코드를 직접 열면 알 수 있음), 갭은 "요약 레이어"에 한정된다.
  - 제안: `README.md:34` 행 끝에 기존 문체(다른 행의 "Also exercises…"/"cf. …" 패턴)를 따라 한 문장 추가 — 예: "The marker also binds to the installed `package-lock.json`'s hash, so a changed lockfile (e.g., a merged Dependabot security bump) retriggers install even with the marker present (review 2026/07/18/12_06_58 W1); `test_lockfile_change_retriggers_install`/`test_unchanged_lockfile_does_not_reinstall` pin both halves." 모듈 docstring(1-23행)에도 기존 3개 불릿과 같은 형식으로 4번째 불릿 추가.

### 점검 확인 사항 (문제 없음, 참고용)

- `PROJECT.md`(`:48` 인근, "의존성 취약점 audit·핀 거버넌스" 절)는 직전 리뷰 라운드(`review/code/2026/07/18/12_06_58` WARNING #2)가 지적한 "Dependabot npm ecosystem 경로 미언급"을 정확히 1문장으로 해소했고, "이 트리를 pnpm 워크스페이스로 흡수하기 전까지 두 경로가 병존한다"는 전향적 caveat까지 붙였다. `.github/dependabot.yml` 신규 주석도 같은 라운드 INFO #2("스케줄 version-update vs repo security-updates 토글 구분을 정밀화")를 정확히 반영했다.
- `CHANGELOG.md` 미갱신은 정당하다 — 61개 기존 "Unreleased" 섹션 전수가 배포되는 제품 코드(backend/frontend/channel-web-chat) 전용이고 하네스 로컬 도구(`.claude/tools/mermaid-lint`) 관련 항목은 하나도 없다(직전 라운드 INFO #7과 동일 결론, 이번 라운드에서도 grep 으로 재확인). 실제 변경 이력은 `plan/in-progress/harness-guard-followups.md` §F 가 담당하며, 이번 커밋 범위에서 체크박스 3건이 완료로 갱신되고 잔여 항목(I3)이 명시적으로 defer 로 남아 있어 충실하다.
- `bootstrap-session.sh` 신설 코드(`_lock_hash()`, `need_install` 분기)에는 그 즉시 옆에 정확한 인라인 주석이 붙어 있고(빈 lockfile/해시도구 부재 시 "presence-only 폴백" 동작까지 정확히 서술), 코드 동작과 대조 검증한 결과 불일치 없음.
- `_lib/mermaid_lint_ready.py`(`is_ready()`)는 이번 diff 로 건드리지 않았고, 마커 **내용**(해시)이 아니라 **존재**만 검사하는 기존 docstring 서술이 여전히 정확하다 — 이 모듈은 "설치가 완료돼 있는가"만 판정하면 되고 "최신인가"는 bootstrap-session.sh(SessionStart 시점)의 책임이라 계층 분리가 유지된다. 갱신 불필요.
- API 문서·신규 환경변수 문서화·예제 코드 항목은 해당 사항 없음(harness 내부 CI 설정/npm lockfile 변경으로 공개 API·신규 env var·사용자 대상 예제가 없음). `MERMAID_INSTALL_RETRY_SEC` 는 이번 diff 이전부터 존재하는 기존 변수.

### 요약
전체적으로 이번 diff 는 이 저장소의 평소 문서화 기준(장문의 설계 근거 주석, 이전 리뷰 라운드 인용, 같은 turn 안에서 canonical 문서(PROJECT.md)·`dependabot.yml` 주석까지 정밀화)을 잘 지켰고, 직전 리뷰 라운드(12_06_58)의 WARNING 2건을 정확히 겨냥해 해소했다. 다만 두 가지 잔여 갭이 있다: (1) 같은 파일 안에서 새로 도입한 "lockfile 변경 시 재설치" 동작과 모순되는 "once"/"one-time" 표현이 3곳(그중 하나는 세션에 실제로 노출되는 런타임 메시지) 그대로 남았고, (2) `.claude/tests/README.md` 커버리지 표와 테스트 모듈 docstring 이 새로 추가된 핵심 동작 및 전용 테스트 2건을 요약하지 않아, 이 PR 이 코드 레벨에서 막으려는 것과 같은 모양의 "조용한 갱신 누락"을 문서 레이어에 남겼다. 둘 다 코드 동작·보안·빌드에는 영향이 없는 비차단 사항이며, 나머지(README/CHANGELOG 스코프 판단, 신규 인라인 주석의 정확성, 계층 분리 유지)는 모두 정확했다.

### 위험도
LOW
