# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** 게이트 인터페이스가 명시적 계약(Protocol/ABC) 없이 런타임 시그니처 추론(`_accepts_cwd`)에 의존
  - 위치: `.claude/hooks/guard_review_before_push.py:450` (`_accepts_cwd` 함수), 호출부 `:636` (`_evaluate_over_targets` 내 `scoped = _accepts_cwd(evaluate)`)
  - 상세: `guard_review_before_push.py` 는 `review_guard.evaluate_review` / `plan_guard.evaluate_plan` 이 "positional cwd 인자를 받는지"를 `inspect.signature` 로 매 호출마다 추론해서 scoped/legacy 두 경로 중 하나로 분기한다. 이는 명시적 인터페이스(예: `typing.Protocol`) 없이 구조적 타이핑을 리플렉션으로 흉내 낸 것으로, 두 모듈 사이의 실질적 계약(“cwd 를 첫 인자로 받아야 한다”)이 타입 시스템이 아니라 오직 `AcceptsCwdContractTest`(테스트 파일) 하나에만 존재한다. 코드 자체의 주석(`test_guard_review_before_push_main.py` 관련 docstring, `_accepts_cwd` docstring)도 "keyword-only 로 바뀌면 조용히 false-ALLOW 구멍이 재발한다"는 위험을 스스로 인지하고 있다 — 즉 설계자도 이 결합이 취약함을 알고 테스트로만 막고 있는 상태다.
  - 제안: `_lib` 에 `class GateEvaluator(Protocol): def __call__(self, cwd: str | None = ...) -> "GateDecision": ...` 형태의 명시적 프로토콜을 선언하고, `review_guard`/`plan_guard` 가 이를 준수함을 타입 체크(또는 최소한 문서화된 SoT)로 강제하면, 시그니처 변경 시 “테스트가 우연히 잡아주길 바라는” 상태에서 “정적으로 드러나는” 상태로 바뀐다. 지금 방식을 유지하더라도 최소한 이 리플렉션 계약을 `_lib/gate_protocol.py` 같은 이름으로 한 군데에 문서화해 두 모듈이 참조하게 하는 편이 낫다.

- **[WARNING]** 두 게이트의 “차단됨” 필드명이 불일치(`Decision.blocked` vs `Plan.untouched`)해 신설된 공용 러너에서 호출부마다 람다로 흡수
  - 위치: `.claude/hooks/guard_review_before_push.py:719` (`is_blocked=lambda d: d.blocked,`), `:741` (`is_blocked=lambda pl: pl.untouched,`) — 둘 다 `_run_gates` 내부, `_evaluate_over_targets` 호출부
  - 상세: 이번 변경으로 REVIEW/PLAN 두 게이트를 동일한 제네릭 러너(`_evaluate_over_targets`)로 통합했는데, 두 게이트가 반환하는 결과 타입의 “차단 여부” 필드명이 각각 `blocked`/`untouched` 로 달라 호출부가 매번 커스텀 `is_blocked` 람다로 이 불일치를 흡수해야 한다. 러너 자체는 좋은 Strategy 패턴 추상화이지만, 이 리팩터 시점이 두 게이트의 반환 타입을 공통 `Decision`(예: `blocked: bool`, `reason: str`) 프로토콜로 통일할 좋은 기회였음에도 기존 명명을 그대로 보존했다. 결과적으로 세 번째 게이트가 추가될 때도 매번 새로운 필드명에 맞춘 람다를 작성해야 하는 패턴이 굳어진다.
  - 제안: 필수는 아니지만, `review_guard`/`plan_guard` 쪽 결과 dataclass 에 공통 `blocked: bool` 속성(또는 `@property`)을 추가해 `is_blocked=lambda d: d.blocked` 하나로 통일하면 세 번째 게이트 추가 시 보일러플레이트가 줄어든다.

- **[INFO]** push 탐지(정규식/heredoc/redaction) 로직이 게이트들과 달리 `_lib/` 로 추출되지 않아 모듈화 기준이 파일별로 비일관
  - 위치: `.claude/hooks/guard_review_before_push.py:101`–`:345` (`_GIT_PUSH`, `_redact_inert_text`, `_commit_heredoc_spans`, `_owns_heredoc_as_message` 등 push-detection 서브시스템 전체)
  - 상세: 같은 파일에서 REVIEW/PLAN 게이트 로직과 fail-open 상태 관리는 각각 `_lib/review_guard.py`, `_lib/plan_guard.py`, `_lib/failopen_state.py` 로 분리되어 있는 반면, 그와 성격이 전혀 다른(그리고 독립적으로 테스트되는 — `test_push_guard_allowlist.py`) push-detection 서브시스템(정규식·heredoc·quote 스캐닝, 약 250줄)은 여전히 hook 파일 안에 인라인되어 있다. 두 서브시스템 모두 "hook 이 아니어도 독립적으로 단위 테스트 가능한 순수 로직"이라는 점에서 동일한 추출 기준을 만족하는데도 분리 여부가 다르다. 파일이 이미 800줄을 넘고 다수의 독립적 관심사(탐지/타겟 선정/게이트 오케스트레이션/장애관측)를 담고 있어, 향후 이 파일에서 작업할 때 “여기 있는 코드가 hook 고유 로직인지 재사용 가능한 유틸인지”를 매번 재확인해야 하는 비용이 있다.
  - 제안: 필수 조치는 아님(동작에 영향 없음). 다음에 이 파일을 만질 일이 있으면 `_lib/push_detection.py` 로 `_GIT_PUSH`/`_redact_inert_text`/관련 헬퍼를 이관해, hook 파일은 “오케스트레이션만” 담당하도록 정리하는 것을 고려.

- **[INFO]** `failopen_state` 부재 시 사용하는 `_Outcome` 대체 클래스가 실제 `failopen_state.Outcome` 의 shape 을 암묵적으로 미러링
  - 위치: `.claude/hooks/guard_review_before_push.py:602`–`:608` (`class _Outcome:` fallback)
  - 상세: `failopen_state` 모듈 임포트가 실패하면 `answered`/`bypassed`/`degraded` 세 리스트 속성을 가진 최소 stand-in `_Outcome` 이 대신 쓰인다. 이 shape 은 `failopen_state.Outcome` 의 실제 속성과 손으로 동기화된 것으로, 후자가 속성을 추가/변경해도 이 fallback 은 자동으로 따라가지 않는다(현재는 코드가 이 세 속성만 사용하므로 즉시 깨지지는 않음). 두 클래스를 묶는 공유 계약(Protocol)이나 명시적 주석이 없어, `failopen_state.Outcome` 변경 시 이 fallback 이 조용히 stale 해질 여지가 있다.
  - 제안: `failopen_state.py` 쪽에 `Outcome` shape 변경 시 이 fallback 도 함께 갱신하라는 주석을 남기거나, 두 클래스가 공유하는 최소 인터페이스를 `Protocol` 로 한 곳에 선언.

## 요약

리뷰 대상은 harness 인프라 코드(`guard_review_before_push.py` + 그 e2e 테스트)로, 애플리케이션 레이어 아키텍처(프레젠테이션/비즈니스/데이터) 개념은 적용되지 않는 단일 스크립트 성격이다. 전반적으로 설계 품질은 높다 — `_evaluate_over_targets` 는 REVIEW/PLAN 두 게이트의 "타겟 순회 + fail-open 관측 + 차단 판정" 로직을 하나의 제네릭 러너로 통합한 좋은 Strategy-스타일 추상화이고, `_push_targets`/`_worktree_branches`/`_mentions_branch` 는 책임이 명확히 분리되어 있으며, 세 번째 게이트 추가 시 registry 가 조용히 만족되는 것을 막기 위해 named `frozenset`(`_ALL_GATES`)을 쓰는 등 확장성보다 명시성·안전성을 의도적으로 택한 트레이드오프가 주석으로 잘 근거되어 있다. `_lib/` 로 게이트 로직을 분리한 모듈 경계도 테스트(subprocess + stub `_lib` 모듈)로 실제로 검증 가능함을 증명한다. 다만 (1) 게이트 인터페이스가 타입 계약이 아닌 런타임 리플렉션(`_accepts_cwd`)으로만 강제되고, (2) 두 게이트의 "차단" 필드명이 불일치해 신설 공용 러너의 호출부마다 매핑 람다가 필요하며, (3) push-detection 서브시스템만 유독 `_lib` 추출 기준에서 벗어나 있는 등, 추상화 수준·모듈 경계 일관성 측면에서 개선 여지가 있다. 이들은 모두 정확성 결함이 아니라 유지보수성 관점의 개선 제안이며, 현재는 촘촘한 테스트 스위트(특히 `AcceptsCwdContractTest`, `test_degradation_is_counted_once_per_gate_not_per_target` 등)가 실질적 안전망 역할을 하고 있다.

## 위험도
LOW
