# Maintainability Review — bootstrap-session.sh 마커-해시 결속 diff

리뷰 대상: `.claude/tools/bootstrap-session.sh`, `.claude/tests/test_bootstrap_mermaid_install.py`, `.claude/tests/README.md` (origin/main 대비 diff — lockfile-hash 결속 기능 및 그 테스트 추가분 중심)

## 발견사항

- **[INFO]** `bootstrap-session.sh` §2 설계 노트 주석이 이번 diff 로 더 길어짐 (comment-to-code 비율 상승 추세)
  - 위치: `.claude/tools/bootstrap-session.sh:35-96` (특히 51-57, 75-84 가 이번 diff 신규 추가분)
  - 상세: 섹션 2("mermaid-lint deps 설치")의 인라인 설계 노트가 이번 diff 로 약 20줄 더 늘어 총 ~62줄이 됐다(같은 섹션의 실행 코드는 ~50줄). 과거 리뷰(02_06_42 C1, 12_06_58 W1, 12_31_29 W2/W3) 사고 이력을 코드 옆에 방어적으로 남기는 것은 이 프로젝트가 여러 라운드를 거쳐 이미 의도적으로 택한 패턴(손으로 짠 primitive 를 다시 시도하지 않도록 못박기)이므로 되돌리자는 제안은 아니다. 다만 이 속도로 계속 자라면 스크립트를 훑어보기 어려워지는 지점에 가까워진다.
  - 제안: 다음 라운드가 추가될 때는 사건별 서술 전체를 인라인에 계속 쌓기보다 `plan/complete/`나 spec 문서로 옮기고, 스크립트에는 "왜"의 1~2문장 요약 + 링크만 남기는 것을 고려.

- **[INFO]** `want_hash` 계산이 그 값을 쓸지 결정하는 가드보다 먼저 실행됨
  - 위치: `.claude/tools/bootstrap-session.sh:124` (`want_hash=$(_lock_hash)`)
  - 상세: `want_hash` 는 바로 다음 줄의 `if [ -f "$tool_dir/package.json" ]; then` 가드 밖에서, 즉 이 값이 실제로 쓰일지 알기 전에 무조건 계산된다. `_lock_hash` 자체가 lockfile 부재 시 빈 문자열을 안전하게 반환하므로 동작 결함은 아니지만, 처음 읽는 사람은 "가드 실패 케이스에서도 왜 미리 계산하는지"를 확인하려 아래로 시선을 옮겨야 한다.
  - 제안: `if [ -f "$tool_dir/package.json" ]; then want_hash=$(_lock_hash); ...` 로 가드 안으로 옮기거나, 가드 밖에 두는 의도(예: 값 자체가 저렴하고 가드와 독립적으로 재사용 가능하게 하려는 의도)를 한 줄 주석으로 남기면 순서가 더 명확해진다.

- **[INFO]** 신규 로컬 변수(`want_hash`, `need_install`)가 스크립트 전역(flat) 스코프에 계속 합류
  - 위치: `.claude/tools/bootstrap-session.sh:124-132`, 파일 전체 구조
  - 상세: 이 파일은 4개의 번호 매긴 책임을 함수로 감싸지 않고 하나의 top-level 스크립트로 실행한다(기존부터의 스타일, 이번 diff 가 새로 만든 문제는 아님). 이번 diff 로 `want_hash`/`need_install` 두 변수가 이미 10개 안팎인 flat 스코프(`common`, `main_root`, `current`, `tool_dir`, `marker`, `fail_marker`, `retry_after`, `state_dir`, `anchor`, `reaper` 등)에 추가로 합류했다. 183줄 규모에서는 아직 추적 가능한 수준이나, 섹션 2를 예컨대 `ensure_mermaid_deps() { ... }` 로 감싸면 이런 지역 변수들이 스코프에 갇혀 다른 섹션과 이름 충돌 걱정 없이 읽고 테스트하기 쉬워진다.
  - 제안: 지금 리팩터링을 요구할 정도는 아니며, 다음 확장 시점에 섹션별 함수화를 고려할 만하다는 관찰.

- **[INFO]** 신규 실패용 shell stub 이 기존 `_NPM_STUB` 패턴과 달리 인라인 리터럴로 정의됨
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:213-222` (`test_missing_hasher_degrades_to_presence_only`, 특히 221줄 `self._write(stub, "#!/usr/bin/env bash\nexit 127\n")`)
  - 상세: 이 파일은 기존에 셸 stub 스크립트를 모듈 레벨 상수(`_NPM_STUB`, 파일 상단, 설명 주석 포함)로 정의해 왔다. 신규 테스트는 `shasum`/`sha256sum` 실패 stub 을 테스트 메서드 안에 인라인 문자열로 바로 넣는다. 현재 1회만 쓰여 DRY 위반은 아니지만, 파일 자체가 확립한 컨벤션과는 결이 달라 나란히 보면 다소 이질적이다.
  - 제안: 재사용이 필요해지거나 일관성을 위해서라면 `_FAILING_STUB = "#!/usr/bin/env bash\nexit 127\n"` 정도로 모듈 상수화하고 "127 = 셸의 '명령을 찾을 수 없음' 관례"를 한 줄 주석으로 남기는 것을 고려.

- **[INFO]** `_env`/`_run` 두 헬퍼가 파라미터 목록을 그대로 미러링 — 신규 knob 추가 시 4곳 동시 수정 필요
  - 위치: `.claude/tests/test_bootstrap_mermaid_install.py:104`(`_env`), `:124`(`_run`)
  - 상세: 이번 diff 로 `rewrites_lock` 파라미터가 `_env` 시그니처, `_env` 본문(`env["NPM_REWRITES_LOCK"] = ...`), `_run` 시그니처, `_run` → `_env` 위임 호출까지 4곳에 나란히 추가됐다. `fail`/`sleep`/`retry_after` 도 diff 이전부터 이미 이중 시그니처였던 기존 패턴의 연장이라 새로운 문제는 아니지만, 파라미터가 계속 늘어나면(현재 4개) shotgun-surgery 성격이 강해진다.
  - 제안: 급하지 않음. knob 이 하나 더 늘어나는 시점에는 `_run(self, **kwargs)` 가 그대로 `_env(**kwargs)` 에 위임하는 형태를 고려(다만 명시적 파라미터가 주는 IDE 자동완성/발견 용이성과는 트레이드오프이므로 팀 판단 필요).

## 요약

이번 diff 는 완료 마커를 `package-lock.json` 해시에 결속하는 기능(`_lock_hash` 헬퍼, `need_install` 판정 재구성, install-후 해시 재계산)과 이를 검증하는 4개의 신규 테스트(`test_lockfile_change_retriggers_install`, `test_unchanged_lockfile_does_not_reinstall`, `test_npm_rewriting_lockfile_still_converges`, `test_missing_hasher_degrades_to_presence_only`)를 더한다. 네이밍(`_lock_hash`/`want_hash`/`need_install`/`NPM_REWRITES_LOCK`/`rewrites_lock`)은 명확하고 기존 컨벤션(`_file_mtime`의 cross-platform fallback 패턴, `NPM_STUB_FAIL`/`NPM_SLEEP` 스타일의 env var 접두사, `test_*` 배너-주석 섹션 구조)을 충실히 따른다. 기존의 단일 `&&` 체인 조건문을 `want_hash`/`need_install` 을 명시적으로 먼저 계산하는 `if/elif` 블록으로 바꾼 것은 실질적인 가독성 개선이며, 늘어난 분기는 lockfile 무효화라는 실제 신규 요구사항에 비례한 것으로 우발적 복잡도가 아니다. 신규 테스트들은 `_write_lock` 공용 헬퍼를 재사용하고 시나리오당 1개 테스트라는 파일의 기존 스타일을 그대로 지켜, 문제 삼을 만한 코드 중복은 없다(테스트 간의 arrange-act-assert 구조 유사성은 테스트 스위트에서 일반적으로 허용되는 반복이다). 발견된 사항은 전부 INFO 수준의 스타일·스코프 관찰(주석 블록 성장 추세, `want_hash` 조기 계산 순서, flat 변수 스코프, 인라인 stub 리터럴, 파라미터 목록 이중화)이며 diff 이전부터 있던 패턴의 연장이거나 매우 경미하다. Critical/Warning 급 유지보수성 결함은 없다.

## 위험도

LOW
