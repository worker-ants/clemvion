# Cross-Spec 일관성 검토 — `spec-draft-error-code-two-surfaces.md`

## 검증 절차

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단 하나에만 `ErrorCode`/
`EngineErrorCode` 두 surface 를 병기하는 draft다. 실측 주장을 독립적으로 재확인했다:

- `codebase/backend/src/nodes/core/error-codes.ts` — `ErrorCode`(:8~)와 `EngineErrorCode`(:147~)가
  **같은 파일**에 자매 const 로 존재함을 확인.
- `error-codes.spec.ts:59-60` — `overlap = Object.keys(EngineErrorCode).filter(k => k in ErrorCode); expect(overlap).toEqual([])` — 키 비중첩이 테스트로 고정됨을 확인.
- `spec/1-data-model.md:474/557-562` — `Execution.error`/`NodeExecution.error` 필드가 "엔진
  인프라 차원의 코드"(`SERVER_INTERRUPTED`·`WORKER_HEARTBEAT_TIMEOUT` 등)를 이미 문서화하고
  있고, 이 코드들이 실제로 `EngineErrorCode` 멤버(`SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`)
  와 일치 — target 이 §Overview 에 쓰려는 "엔진이 `Execution.error`·`NodeExecution.error` 에
  싣는다" 서술과 정합.
- `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT`
  행이 이미 "엔진 레벨 `error.code`" 로 §1 규율 적용 대상임을 전제하고 있음 — target 의 병기는
  기존 §3 서술과 **역행하지 않고 오히려 그 전제를 §Overview 로 끌어올려 명문화**한다.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md`(착수 근거)와
  `plan/complete/exec-intake-followups.md` ARCH#5 ⑤ 인용문을 원문과 대조 — target 의 인용이
  정확함을 확인.
- `spec/5-system/4-execution-engine.md:1143`/`:1800` 이 여전히 "신규 client-safe 코드는 중앙
  `ErrorCode` enum 의 `EXECUTION_*` 네임스페이스를 확장" 만 서술하고 `EngineErrorCode` 존재를
  언급하지 않음을 확인 — 아래 발견사항 참조.

## 발견사항

- **[INFO]** `4-execution-engine.md` §Rationale 이 `EngineErrorCode` 신설을 아직 반영하지 않음
  - target 위치: 변경 없음(§Overview "적용 범위" 문단만 편집하는 draft라 이 문서를 건드리지 않음)
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1143`, `:1800`
  - 상세: 두 자리 모두 "신규 client-safe 코드는 신규 prefix 를 만들지 않고 중앙 `ErrorCode` enum 의
    기존 `EXECUTION_*` 네임스페이스를 확장한다"(2026-06-14 사용자 결정)만 서술하고, 그 이후 신설된
    `EngineErrorCode`(엔진 인프라 코드용 자매 const)의 존재를 언급하지 않는다. `error-codes.md`
    §Overview 가 두 surface 를 병기하게 되면, 이 문서만 읽는 사람은 "신규 엔진 코드는 항상
    `ErrorCode` 확장" 이라는 낡은 규칙만 보고 `EngineErrorCode` 라는 대안 경로를 모르게 된다.
    다만 이 drift 는 target 이 만든 것이 아니라 **선재하는 상태**이며, target 의 착수 근거 plan
    (`spec-conventions-engine-error-code-surface.md`)과 그 Rationale 이 이 긴장을 이미 정확히
    인지하고 "판단 기준은 이번엔 안 쓴다 — 유보를 닫는 것이 이 병기보다 큰 결정" 이라고 의도적으로
    미룬 것이다(§`함께 볼 것`, ARCH#5 ⑤ 인용). 즉 **의도적 유보이지 target 의 누락이 아니다**.
  - 제안: 조치 불필요(target 범위 밖, 이미 plan 에 재개 신호 — "세 번째 자매 const 가 생길 때" —
    가 명시돼 있음). 다만 향후 `4-execution-engine.md` 를 편집하는 사람이 이 문서를 참조할 때
    `EngineErrorCode` 존재를 함께 갱신하는 것이 바람직하다는 점만 기록해 둔다.

다른 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)에서는 충돌을 찾지 못했다.
target 은 §Overview 한 문단만 편집하고 §3(historical-artifact 레지스트리)·§4(내부 전용 분류
파이프라인)·§2(rename 정책)를 건드리지 않으며, 그 경계 선언("무엇을 안 하나")도 실제 편집 범위와
일치한다. `EngineErrorCode` 자체는 `spec/**` 어디에도 아직 참조되지 않아(신규 등재이므로) ID·API·
상태 충돌의 여지가 애초에 없다.

## 요약

target 은 이미 구현된 코드 사실(`ErrorCode`/`EngineErrorCode` 자매 const, 키 비중첩 테스트)을
정확히 실측해 규약 문서의 좁은 gap(§Overview 대표 surface 단수 서술)만 메우는 최소 범위 편집이다.
"판단 기준은 이번엔 안 쓴다"는 결정도 ARCH#5 ⑤ 의 유보 상태를 정확히 반영해 규약을 성급히 굳히지
않는다. 유일한 잔여 지점은 `4-execution-engine.md` §Rationale 이 `EngineErrorCode` 신설을 아직
반영하지 않은 선재 drift 인데, 이는 target 이 만든 문제가 아니고 착수 근거 plan 이 이미 인지·유예한
사안이라 이번 병기를 막을 이유가 되지 않는다. Cross-spec 관점에서 채택을 막을 모순은 없다.

## 위험도

LOW
