### 발견사항

- **[INFO]** `harness-guard-followups.md` 의 `## Overview` 개수 서술이 이번 diff 로 더 stale 해짐
  - 위치: `plan/in-progress/harness-guard-followups.md` (전체 파일 컨텍스트 라인 18, diff 범위 밖)
  - 상세: 최상단 `## Overview`("`.claude/` 하네스 가드 계열의 비차단 개선 5건 + won't-do 1건. 우선순위는 A > B > C > D > E.")는 초기 스코프(A~E) 기준 서술이다. 현재 체크리스트(라인 416~425)엔 F·G·H·I 까지 총 9개 항목이 있고, 이번 diff 로 C 가 "won't-do" 로 확정되며 그 사유 서술이 대폭 늘었다. Overview 는 이번 diff 에서 손대지 않아 여전히 "5건+1" 로 읽혀, 실제 항목 수·우선순위(A>B>C>D>E 만 언급, F~I 미언급)와 불일치가 이번 변경으로 한 번 더 굳어졌다.
  - 제안: 이번처럼 plan 을 실질적으로 갱신하는 diff 에서는 Overview 카운트도 같이 동기화하거나, 최소한 "F~I 는 이후 추가된 별건" 이라는 한 줄을 남겨 최상단 요약과 체크리스트가 계속 벌어지지 않게 한다. (과거 메모: "plan 서술은 철회로 거짓이 될 수 있다 + 체크리스트 두 군데" — 본문/체크리스트는 이번에 정합했으나 Overview 는 세 번째 지점으로 남아 있다.)

- **[INFO]** won't-do 근거의 "프로브 8건" 표현이 최종 고정된 테스트 개수와 정확히 대응하지 않음
  - 위치: `plan/in-progress/harness-guard-followups.md` diff 라인 166~169 (`### 결론: won't-do (2026-07-23)` 문단)
  - 상세: "실측: `_MUTATING` 은 `^\s*` 로 앵커돼 명령의 첫 토큰만 본다. 프로브 8건 (`echo "rm -rf /tmp/x"`, `grep -n "mkdir" f`, `git log --grep="commit"`, `echo "git commit"` …) 전부 정분류, 불일치 0건." 이라고 서술하지만, 실제로 이 주장을 고정한 `test_guard_default_branch_bash_mutating.py::NoFalsePositiveClassTest` 는 두 메서드 합쳐 12개 커맨드(7+5)를 검증한다. "…" 로 열거가 끝나지 않았다는 표시는 있으나, "8건" 이라는 구체적 숫자가 어떤 시점의 어떤 실행(수동 사전 검증 vs 최종 테스트 스위트)을 가리키는지 문서만으로는 재현할 수 없다.
  - 제안: 숫자를 못 박으려면 "테스트 파일의 N건" 처럼 검증 가능한 앵커(커밋/테스트 파일)를 명시하거나, 정확한 사전 프로브 커맨드 목록을 각주로 남겨 향후 독자가 "8건"을 재현할 수 있게 한다. 사실관계 오류라기보다 재현성이 약한 숫자 서술이라 CRITICAL 은 아니다.

- **[INFO]** 모듈 최상단 docstring이 이번에 추가된 세그먼트 분할·`VAR=value` 스킵 동작을 언급하지 않음
  - 위치: `.claude/hooks/guard_default_branch_bash.py` 전체 파일 컨텍스트 라인 19-22 (모듈 docstring, diff 밖)
  - 상세: `_MUTATING` 정규식 바로 위 주석(라인 55-66)과 `_SEGMENT_SPLIT` 위 주석(라인 101-110)은 이번 변경(세그먼트별 첫 토큰 검사, `VAR=value` 접두 스킵)을 정확하고 상세하게 설명한다. 반면 파일 최상단 모듈 docstring 은 "matches common file-creation / install / git-state-change commands" 수준의 고수준 설명만 유지하고 있어, docstring만 읽는 독자는 "체인 명령 전체를 세그먼트별로 본다"는 이번 핵심 동작 변화를 알 수 없다. 틀린 서술은 아니지만(‘conservative’, ‘never blocks’ 등은 여전히 참), 완전성 측면에서 한 줄 보강 여지가 있다.
  - 제안: 필수는 아니나, 여유가 있다면 모듈 docstring에 "commands are split on `&&`/`||`/`;`/`|`/newline before classification" 한 줄 추가.

### 요약

이번 diff 는 코드 변경(정규식 세그먼트 분할 버그 수정) 대비 문서화 노력이 이례적으로 두텁다: 모듈 내 인라인 주석이 새 동작(세그먼트 분할, `VAR=value` 스킵, 의도적으로 남긴 잔여 오탐)을 원리까지 정확히 설명하고, `worktree-policy.md`(정책 SoT)·`.claude/tests/README.md`(테스트 카탈로그)·plan 두 건(`harness-push-guard-subcommand-detection.md`, `harness-guard-followups.md`)이 모두 같은 결정("항목 C 는 won't-do, 공유 이득 0")을 서로 참조하며 일관되게 갱신됐고, 신규 테스트 파일의 클래스별 docstring 도 각 클래스가 무엇을 고정하는지 명확히 밝힌다. 코드-주석 일치성, 카탈로그 동기화, plan 본문/체크리스트 동기화 모두 확인했으며 부정확한 서술은 발견하지 못했다. 지적한 항목은 모두 이번 diff 범위 밖에 있는 기존 서술의 잔여 staleness(Overview 카운트)이거나 재현성이 약한 숫자 표현 정도로, 실질적 위험은 없다.

### 위험도
LOW
