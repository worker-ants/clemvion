### 발견사항

- **[INFO]** 두 훅 파일이 동일한 심볼명 `_SEGMENT_SPLIT` 을 서로 다른 역할·정규식으로 각각 정의
  - 위치: `.claude/hooks/guard_default_branch_bash.py:146` (`_SEGMENT_SPLIT = re.compile(r"&&|\|\||[;|&\n]")`) vs `.claude/hooks/guard_review_before_push.py:149` (`_SEGMENT_SPLIT = re.compile(r"&&|[|;\n]")`)
  - 상세: 실제 코드를 추적한 결과, 두 `_SEGMENT_SPLIT` 은 답하는 질문 자체가 다르다 — `guard_default_branch_bash.py` 쪽은 `_is_mutating`(`:149-154`)에서 명령 **전체를 세그먼트로 나눠 각각을 분류**하는 데 쓰이고, `guard_review_before_push.py` 쪽은 `_owns_heredoc_as_message`(`:158` 부근)에서 heredoc 마커 **직전 세그먼트 하나만** 추출하는 좁은 용도로 쓰인다. push 가드의 실제 차단 판정(`_GIT_PUSH`)은 `_SEGMENT_SPLIT` 을 전혀 거치지 않고 원문 문자열에 직접 매칭되므로, 두 정규식의 구분자 집합이 다른 것(`||`/단일 `&` 포함 여부) 자체는 기능 결함이 아님을 확인했다. 다만 **동일 식별자를 재사용**한 것은 "이 둘은 같은 개념이라 항상 함께 갱신해야 한다"는 오해를 만들 구조적 여지를 남긴다 — 실제로는 주석(양쪽 파일에 상호 참조 있음)으로만 그 차이를 설명하고 있어, 주석을 읽지 않고 이름만 보고 복붙 동기화를 시도하는 향후 편집을 완전히 막지는 못한다.
  - 제안: 심볼명을 역할 기반으로 분리(예: `_CHAIN_SEGMENT_SPLIT` / `_HEREDOC_OWNER_SPLIT`)해 "겉보기엔 비슷하지만 실제로는 다른 질문에 답한다"는 사실을 이름 수준에서도 드러내면, 주석 의존 없이도 오해 가능성이 줄어든다. (차단 여부는 아니며, 현재도 두 파일 모두 이 차이를 상세히 문서화하고 있어 실질 위험은 낮음.)

- **[INFO]** `_MUTATING` 정규식이 라운드를 거치며 규칙이 계속 누적되는 단일 blind-regex 구조
  - 위치: `.claude/hooks/guard_default_branch_bash.py:96-117` (`_MUTATING`)
  - 상세: env-prefix skip(3-way 따옴표 alternation, `:98`) · 세그먼트 앵커링(`:149-154`) 등이 이번 diff 로 추가되며 하나의 컴파일된 정규식/모듈에 규칙이 계속 쌓이는 추세다. 현재는 선형성이 실측(`BacktrackingTest`)·테스트로 뒷받침되어 안전하지만, 구조적으로는 "토크나이저 없이 정규식 하나를 계속 정교화"하는 패턴이라 향후 edge case 가 더 붙을수록 가독성·회귀 위험이 누적될 수 있다. 다만 이 프로젝트는 이미 "정밀 셸 파서" 경로를 무한 표면이라는 이유로 명시적으로 폐기한 바 있어(`guard_review_before_push.py` 상단 주석, plan `harness-push-guard-subcommand-detection.md`), 현재 시점에는 이 트레이드오프가 합리적이다. 조치 불필요, 향후 규칙이 더 붙는지 관찰 포인트로만 기록.

- **[INFO, 긍정 평가]** `_lib/` 공유 추출을 거부한 §C won't-do 결정이 아키텍처적으로 타당
  - 위치: `plan/in-progress/harness-guard-followups.md` §C (라인 163-210 부근), `.claude/hooks/guard_default_branch_bash.py:72-95` 주석
  - 상세: 두 훅이 "정규식으로 git 명령을 분류한다"는 표면적 유사성을 갖지만, 실제로는 안전 방향이 정반대다 — 넛지 훅(`guard_default_branch_bash.py`)은 차단 권한이 없어 관대하게 놓치는 쪽이 안전하고, 게이트 훅(`guard_review_before_push.py`)은 차단이 유일한 효과라 정밀한 오탐 해제(`_redact_inert_text`)가 필수다. 표면적 유사성만으로 조기에 `_lib/` 공유 모듈을 추출하지 않고, 실측(`NoFalsePositiveClassTest`)으로 "공유해도 얻는 게 없다"를 확인한 뒤 결정을 내린 점은 premature abstraction 을 피한 좋은 판단이다. 기존 `_lib/`(`review_guard.py`, `plan_guard.py`, `branch_guard.py`, `failopen_state.py`)는 실제로 여러 훅이 완전히 같은 로직을 공유하는 경우에만 쓰이고 있어, 이번 결정은 프로젝트의 기존 추상화 기준과 일관된다. 순환 의존성도 없음 — 두 훅 모두 leaf 모듈이며 `_lib/branch_guard` 로의 단방향 의존만 존재.

- **[정보성 확인 — 이상 없음]** SRP/모듈 경계/테스트 구조
  - `_MUTATING`(패턴) / `_SEGMENT_SPLIT`(분할) / `_is_mutating`(합성)이 각각 단일 책임을 지닌 작고 조합 가능한 프리미티브로 분리되어 있음(`.claude/hooks/guard_default_branch_bash.py:96-154`).
  - 신규 테스트 파일(`.claude/tests/test_guard_default_branch_bash_mutating.py`)은 `NoFalsePositiveClassTest`/`SegmentTest`/`AcknowledgedFalsePositiveTest`/`OutOfScopeTest`/`EnvPrefixTest`/`BacktrackingTest`/`EmptyInputTest` 로 관심사별 응집이 잘 되어 있고, 각 클래스 docstring 이 "왜 이 클래스가 존재하는가"를 pin 하고 있어 유지보수 관점에서도 견고함.
  - 두 훅(넛지 vs 블로킹 게이트) 사이의 모듈 경계는 이번 diff 에서도 유지되며, 상호 참조 주석(§J 포함)으로 결합 지점만 명시적으로 드러낸 점은 "결합은 최소화하되 드리프트 위험은 가시화"하는 합리적 절충.

### 요약

이번 변경은 단일 advisory 훅(`guard_default_branch_bash.py`)의 세그먼트 분류 로직을 확장하는 좁은 범위의 수정으로, 새로운 레이어·모듈·서비스 경계를 도입하지 않으며 순환 의존성도 없다. SRP 를 지키는 작은 조합형 프리미티브(패턴/분할/합성 함수)로 잘 구성되어 있고, 표면적으로 비슷해 보이는 push 게이트와의 코드 공유를 실측 근거로 거부한 §C 결정은 조기 추상화를 피한 좋은 아키텍처 판단이다. 다만 두 파일이 동일한 `_SEGMENT_SPLIT` 심볼명을 서로 다른 의미로 재사용하는 점과, 단일 blind 정규식(`_MUTATING`)에 규칙이 계속 누적되는 추세는 향후 유지보수 시 혼동·복잡도 증가의 소지가 있어 관찰이 필요하다. 두 사항 모두 현재는 상세한 주석·테스트로 완화되어 있어 차단 사유는 아니다.

### 위험도
LOW
