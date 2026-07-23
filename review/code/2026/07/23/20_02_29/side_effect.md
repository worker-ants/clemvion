# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 넛지(마커 파일 쓰기) 트리거 빈도 확대는 의도된 부작용 확장
  - 위치: `.claude/hooks/guard_default_branch_bash.py:114-119` (`_is_mutating`)
  - 상세: `_is_mutating` 이 이제 명령을 `&&`/`||`/`;`/`|`/개행으로 분할해 **각 세그먼트**에 `_MUTATING` 을 적용한다. 이전엔 명령 전체의 첫 토큰만 봤으므로 `git status && rm -rf x` 같은 체인이 무반응이었지만, 이제는 반응한다. 그 결과 `_mark_warned()`(`.claude/state/main_worktree_bash_warned/<session_id>` 파일 쓰기, `guard_default_branch_bash.py:134-145`)가 이전보다 더 넓은 명령 집합에 대해 트리거될 수 있다. 다만 세션당 1회만 기록되고(`_already_warned` 가드), 파일시스템 경로·의미 자체는 변경되지 않았다.
  - 제안: 의도된 변경이며 `plan/in-progress/harness-guard-followups.md` §C 및 `test_guard_default_branch_bash_mutating.py::SegmentTest` 로 근거·회귀가 고정돼 있음. 조치 불필요, 참고용 기록.

- **[INFO]** 세그먼트 분할이 인용을 모름 — 새로운 오탐 클래스 인정
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111` (`_SEGMENT_SPLIT`)
  - 상세: `_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|\n]")` 는 따옴표 내부와 외부를 구분하지 않는다. `echo "a && rm -rf x" > /dev/null` 처럼 인용된 문자열 안의 구분자도 분할 대상이 되어, 실제로는 안전한 명령이 nudge를 유발한다(새 부작용: stdout 에 reminder 출력 + 세션 마커 파일 생성이 이전엔 없던 케이스에서 발생). 단, 이 훅은 **차단하지 않고** 세션당 최대 1회만 출력하므로 영향은 미미하며, `AcknowledgedFalsePositiveTest`(`test_guard_default_branch_bash_mutating.py:98-110`)로 의도적으로 고정된 트레이드오프다.
  - 제안: 조치 불필요. push 가드(`guard_review_before_push.py`)처럼 차단하는 훅이 아니므로 정밀 파서 도입은 오히려 무한 표면을 여는 방향(§C won't-do 근거와 동일 논리)이라 현행 유지가 타당.

- **[INFO]** 새 모듈 전역 상수 추가 — 충돌·오염 없음
  - 위치: `.claude/hooks/guard_default_branch_bash.py:111` (`_SEGMENT_SPLIT`)
  - 상세: 새 module-level 정규식 상수가 추가됐으나 `_`-prefixed private 이름이고, 다른 모듈에서 import 되지 않음(`grep` 결과 `_is_mutating`/`guard_default_branch_bash` 참조는 이 훅 파일과 신규 테스트 파일뿐). 기존 `_MUTATING` 상수의 패턴 본문만 확장(VAR= 접두 허용)됐고 시그니처(`_is_mutating(command: str) -> bool`)는 불변이라 다른 호출자 영향 없음.
  - 제안: 조치 불필요.

## 확인한 항목 (문제 없음)

- **시그니처/인터페이스**: `_is_mutating(command: str) -> bool` 시그니처 불변. 이 훅은 `.claude/settings.json` 의 PreToolUse(Bash) matcher 에서만 프로세스로 실행되며 다른 코드가 이 모듈을 import 하지 않음(레포 전수 grep 확인) — 공개 API 성격이 아니라 시그니처/인터페이스 변경의 호출자 영향 없음.
- **환경 변수**: `VAR=value` 접두 정규식은 명령 **문자열** 패턴 매칭이지 실제 프로세스 환경 변수를 읽거나 쓰지 않음. `BYPASS_DEFAULT_BRANCH_GUARD` 읽기는 diff 밖(기존 로직) 그대로.
- **파일시스템**: `_mark_warned`/`_state_dir`/`_already_warned` 자체는 이번 diff 에서 변경되지 않음 — 마커 파일 쓰기 로직(경로, 형식, 실패 시 best-effort 무시)은 그대로. 신규 테스트(`test_guard_default_branch_bash_mutating.py`)는 `guard._is_mutating()` 만 직접 호출하고 `main()`/`_mark_warned()` 는 호출하지 않으므로 테스트 실행이 실제 저장소 `.claude/state/` 를 오염시키지 않음.
- **네트워크 호출**: 없음.
- **성능(ReDoS) 부작용**: `_SEGMENT_SPLIT.split()` 은 단순 리터럴/문자클래스 교대라 선형. `_MUTATING` 의 `(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*` 반복은 `\S+`(비공백)와 뒤이은 `\s+`(공백)가 상호 배타적 문자 클래스라 모호성이 없어 지수 백트래킹(ReDoS) 위험 없음 — push 가드가 겪었던 겹치는 대안 패턴과는 다른 구조. 세그먼트별 `.search()` 호출은 각 세그먼트 길이에 비례하며 총합은 명령 전체 길이이므로 O(n).
- **이벤트/콜백 격리**: `print(reminder)` 는 훅 프로세스 자신의 stdout(하네스가 가로채 모델 컨텍스트에 주입)이며, 실제 Bash 명령이 실행되어 만들어내는 stdout/stderr 파이프라인과는 분리되어 있음 — 실행되는 명령의 출력에 reminder 텍스트가 섞여 들어가 다운스트림 파싱을 깨뜨릴 위험 없음.
- **문서 변경**(`.claude/docs/worktree-policy.md`, `.claude/tests/README.md`, `plan/**`): 서술만 갱신, 실행 가능한 코드 경로 없음 — 부작용 없음.

## 요약

이번 변경은 `guard_default_branch_bash.py::_is_mutating` 을 "명령 전체 첫 토큰만 검사"에서 "구분자로 나눈 각 세그먼트의 첫 토큰 검사"로 넓힌 것이 핵심이며, 이 훅은 애초에 **차단하지 않고 세션당 최대 1회만 stdout 에 reminder 를 출력**하는 nudge 전용 훅이라 부작용의 폭발 반경이 구조적으로 좁다. 새로 도입된 module-level 상수(`_SEGMENT_SPLIT`)는 다른 코드에서 참조되지 않고, `_is_mutating` 시그니처·`_mark_warned`/`_state_dir` 등 실제 파일시스템 쓰기 경로는 변경되지 않았다. 트리거 빈도가 넓어짐에 따라 마커 파일 쓰기·reminder 출력이 이전보다 더 자주 발생할 수 있다는 점, 그리고 인용을 모르는 순진한 분할이 새로운(그러나 사소한) 오탐 클래스를 만든다는 점은 모두 plan(`harness-guard-followups.md` §C)과 신규 테스트(`AcknowledgedFalsePositiveTest`, `SegmentTest`)로 의도적으로 인지·고정되어 있어 추가 조치가 필요한 CRITICAL/WARNING 급 부작용은 발견되지 않았다. 나머지 문서·plan 파일 변경은 서술만 갱신하는 것으로 실행 경로에 영향이 없다.

## 위험도

LOW
