# 부작용(Side Effect) 리뷰

이번 diff 는 §J-후속(env 접두 정규식 후행 `\S+` 폴백 추가)에 대한 **직전 리뷰(01_25_14)의
RESOLUTION 반영본**이다. 직전 side_effect 리뷰(LOW)가 지적한 내용은 그대로 유효하며, 이번
세션에서는 (a) 직전 리뷰의 W1/W2 fix 가 실제로 반영됐는지, (b) fix 자체(§K→§L 정정,
`ENV_VALUE_SHAPES` 공유 상수화, 회귀 형태 명시적 고정 테스트 추가)가 새로운 부작용을 들여오지
않았는지를 코드 직접 열람 + 테스트 실행으로 독립 재검증했다.

## 발견사항

- **[INFO]** 블로킹 게이트 `_GIT_PUSH` 판정 경계 확장 — 의도된 확장, 하위호환 아님 (직전 리뷰 재확인)
  - 위치: `.claude/hooks/guard_review_before_push.py:119` (env-값 대안 `[^\s'"]\S*` → `\S+`)
  - 상세: `git push` 마다 도는 **차단 게이트**의 1차 판정 정규식이다. 이전에는 따옴표를 열고
    닫지 않은 env 값(`A='x git push`)이 접두 그룹 붕괴를 일으켜 탐지 자체가 스킵됐는데, 이제는
    탐지되어 REVIEW/PLAN 게이트가 정상 작동한다. 직접 코드 확인 결과 `\S+` 는 이전 대안의
    엄밀한 상위집합이라 `.search()` 매칭 범위는 단조 확장만 하며(따옴표 문자 포함 매칭 가능),
    `GeneratedFloorTest`(168 조합: 손실 0/획득 12)로 무손실 상위집합임이 재확인된다. 관측 가능한
    동작 변화("이전에 무검사로 통과하던 push 형태가 이제 검사·차단 대상")이지만 diff 의 명시적
    목적이므로 의도된 것.
  - 제안: 조치 불필요.

- **[INFO]** 동일 완화가 비차단 넛지 훅(`_MUTATING`)에도 적용 — 부작용 범위 최소
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111`
  - 상세: 이 훅은 절대 차단하지 않고 세션당 1회 stdout reminder 만 출력한다(`_already_warned`/
    `_mark_warned`, 상태 파일 `.claude/state/main_worktree_bash_warned/<session_id>`) — 이번
    diff 에서 이 dedupe 로직·상태 파일 경로는 손대지 않았음을 직접 확인. 판정 경계가 넓어져도
    부작용은 "reminder 가 조금 더 자주 뜬다" 수준.
  - 제안: 조치 불필요.

- **[INFO]** 세 곳(훅 2 + 테스트 미러 1) 패턴 동기화 — 직접 재확인, byte-identical
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111`, `.claude/hooks/guard_review_before_push.py:119`,
    `.claude/tests/test_push_guard_allowlist.py:82`
  - 상세: 세 곳 모두 `\S+` 폴백이 동일 형태로 반영됐음을 `grep` 으로 직접 확인. `EnvValueSubpatternSharedTest`
    (두 훅 간 drift 가드)·`BlindPassFrozenTest`(테스트-미러 drift 가드) 도 그대로 유지되어 "한쪽만 고치는"
    부작용 클래스는 계속 방지된다.
  - 제안: 조치 불필요.

- **[INFO]** 직전 리뷰 W1(모듈 docstring 자기모순) — fix 반영 확인, 재발 없음
  - 위치: `.claude/hooks/guard_default_branch_bash.py:33-36`
  - 상세: 파일을 직접 열어 확인한 결과 현재 텍스트는 "An unclosed quote (`A='x mkdir foo`) DOES
    match — the env-value group keeps `\S+` as a trailing fallback precisely so it cannot silently
    narrow. Only an empty value (`VAR= git commit`) stays unmatched..." 로 갱신되어, 이번 diff 가
    고친 실제 동작(`test_unterminated_quote_still_matches` 가 이제 `assertTrue`)과 더 이상 모순되지
    않는다. 이 문서 정합성 결함은 side-effect 카테고리는 아니지만(documentation 리뷰어 소관), 코드가
    실제로 하는 일과 최상단 서술이 일치하는지는 향후 유지보수자의 "의도치 않은 되돌림" 부작용을
    막는 1차 방어선이므로 side-effect 관점에서도 확인해 둔다.
  - 제안: 조치 불필요(이미 반영됨).

- **[INFO]** 직전 리뷰 W2(§K/§L 백로그 레터 자기모순) — fix 반영 확인, 잔존 없음
  - 위치: `.claude/tests/test_push_guard_allowlist.py:371, 892-921`
  - 상세: 저장소 전체(`grep -rn "§K\|§L"`)에서 이 결함을 지칭하는 표현은 전부 `§L` 로 통일되어
    있고, 무관한 백로그 항목(§K = 게이트 제어흐름 4중 복제)을 잘못 가리키는 `§K` 잔존은 없음을
    직접 확인했다. 주석/canary 테스트 이름이 잘못된 백로그 항목을 가리키면 향후 "§K 를 고쳤다"는
    착각으로 실제 게이트 우회(§L)를 방치하는 부작용으로 이어질 수 있었는데, 그 경로가 닫혔다.
  - 제안: 조치 불필요(이미 반영됨).

- **[INFO]** 신규 공유 모듈 상수 `ENV_VALUE_SHAPES` (`.claude/tests/_harness.py`) — 테스트 전용,
  런타임 부작용 없음
  - 위치: `.claude/tests/_harness.py:62-70`
  - 상세: 두 테스트 파일이 각자 들고 있던 리터럴 값-형태 리스트(직전 리뷰 W3 지적: 이미 드리프트
    발생)를 단일 튜플로 합친 것. 모듈 로드 시 1회 생성되는 불변 튜플이며 재바인딩·mutation 없음,
    두 스위트 모두 read-only 로 참조만 한다. `test_no_duplicate_values` 가 양쪽 스위트(넛지 훅
    `OldEnvPrefixSupersetTest`, push 가드 `GeneratedFloorTest`)에 대칭으로 추가되어(직전 리뷰 W4
    반영) 중복 값이 "조용히 커버리지를 줄이는" 부작용도 가드된다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/2026/07/24/01_25_14/*` 11개 파일이 신규 커밋으로 diff 에 포함됨
  - 위치: `review/code/2026/07/24/01_25_14/{RESOLUTION,SUMMARY,meta,_retry_state,documentation,
    maintainability,requirement,scope,security,side_effect,testing}.{md,json}`
  - 상세: 직전 리뷰 세션의 산출물이 이번 커밋(`6e1723985`)에 실제 파일로 포함되어 저장소에
    커밋됐다. `review/` 는 `.gitignore` 대상이 아니고 프로젝트 규약(CLAUDE.md)상 리뷰 산출물은
    `review/code/<date>/<time>/` 에 보관하는 것이 정본 위치이므로 의도된 동작이며, 런타임
    코드에는 영향이 없는 순수 아카이브 파일이다(실행되는 로직·설정 아님). 다만 "직전 리뷰의
    output 을 이번 리뷰 대상 diff 안에 포함시키는" 재귀적 구조 자체는 side-effect 관점에서
    특이하므로 기록해 둔다 — 문제는 아니나, 이 파일들의 내용(수치·판정)이 이번 diff 의 실제
    코드와 일치하는지는 이번 side-effect 리뷰에서 독립적으로 재확인했다(아래 검증 참고).
  - 제안: 조치 불필요.

## 점검했으나 문제 없음으로 판단한 항목

- **전역 변수/상태**: `_MUTATING`/`_GIT_PUSH`/`_BLIND_PATTERN` 모두 모듈 레벨 상수(재바인딩 없음,
  리터럴 값만 변경). 신규 `ENV_VALUE_SHAPES` 도 불변 튜플.
- **파일시스템 부작용**: 훅의 상태 파일 쓰기(`_mark_warned`, fail-open 카운터) 로직은 이번 diff
  에서 손대지 않음. `review/` 신규 파일 커밋은 정책상 정상 아카이브 동작.
- **함수 시그니처**: `_is_mutating(command)`, `_is_git_push(command)` 등 모든 시그니처 불변.
- **공개 인터페이스**: PreToolUse 훅 등록·exit code 계약(0/2) 불변. 두 파일을 import 하는 외부
  소비처는 테스트 외에 없음(직접 확인).
- **환경 변수**: `BYPASS_DEFAULT_BRANCH_GUARD`/`BYPASS_REVIEW_GUARD`/`BYPASS_PLAN_GUARD`/
  `CLAUDE_PROJECT_DIR` 읽기 로직 불변, 신규 env var 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음 — `print()`/`return`/`sys.exit()` 뿐이며 호출 순서·조건 변경 없음.
- **테스트 실행 재확인**: `.claude/tests` 디렉터리에서 `python3 -m unittest discover -p "test_*.py"`
  직접 실행 — **552 tests, OK** (RESOLUTION.md 의 "552건 OK" 수치와 일치, 독립 재현 완료).
  `test_guard_default_branch_bash_mutating`/`test_push_guard_allowlist` 단독 실행도 71 tests OK.

## 요약

이번 diff 는 직전 리뷰(01_25_14, RISK=MEDIUM, Critical 0, Warning 4)의 RESOLUTION 반영본이며,
side-effect 관점의 핵심 결론(함수 시그니처·전역 상태·공개 인터페이스·환경변수·파일시스템·네트워크
호출 불변, 유일한 관측 가능 변화는 의도된 게이트 판정 경계 확장)은 직전 세션과 동일하게 유지된다.
이번 세션에서 새로 확인한 것은 그 직전 리뷰가 지적한 문서 정합성 결함(W1 docstring 자기모순, W2
§K/§L 오기)이 실제로 코드에 반영돼 재발하지 않았다는 점과, 그 수정 자체(`ENV_VALUE_SHAPES` 공유
상수화, 대칭 중복-검출 테스트 추가, 회귀 형태 명시적 고정)가 불변 테스트 전용 데이터일 뿐 런타임
부작용을 전혀 추가하지 않는다는 점이다. 저장소 전체 552건 테스트를 독립 재실행해 회귀가 없음을
직접 확인했다. side-effect 관점에서 위험 요소는 발견되지 않았다.

## 위험도

LOW
