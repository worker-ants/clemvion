# Cross-Spec 일관성 검토 — `spec-draft-error-code-two-surfaces.md`

대상: `plan/in-progress/spec-draft-error-code-two-surfaces.md` (target). `spec/conventions/error-codes.md` §Overview
"적용 범위" 문단에 `ErrorCode`/`EngineErrorCode` 두 surface 를 병기하는 draft.

사전 확인: prompt 번들의 "관련 spec 본문"은 컨텍스트 예산 초과로 대부분 파일이 절단(`⚠️ 본문 생략됨`)돼 있었다
(`spec/conventions/error-codes.md` 자체를 포함해 `spec/conventions/**` 전체가 번들에 아예 없음 — 기존
`feedback_consistency_spec_mode_budget.md` 교훈과 동일 패턴). 이 검토는 번들 대신 로컬 파일시스템에서
`spec/conventions/error-codes.md`, `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md`,
`codebase/backend/src/nodes/core/error-codes.ts`(+`.spec.ts`), `plan/complete/exec-intake-followups.md`,
`plan/in-progress/spec-conventions-engine-error-code-surface.md` 를 직접 읽어 대조했다.

target 의 "실측" 표(`ErrorCode` :8, `EngineErrorCode` :147, `overlap` 테스트)는 코드와 정확히 일치한다.
착수 근거(`exec-intake-followups.md` ARCH#5 ⑤, "자매 const" 판단)와 착수 plan(`spec-conventions-engine-error-code-surface.md`)의
서술도 실제로 존재하며 target 의 요약과 부합한다 — 근거 날조는 없다.

## 발견사항

- **[WARNING]** `EngineErrorCode` 귀속 규칙("엔진이 싣는다")이 `spec/1-data-model.md`의 `Execution.error`/`NodeExecution.error`
  필드 정의와 어긋나는 예시를 이미 포함하고 있다
  - target 위치: `## 변경 제안` bullet 2·3 — "`ErrorCode` — 노드 핸들러가 `output.error.code`" / "`EngineErrorCode` —
    엔진이 `Execution.error`·`NodeExecution.error` 에 싣는다"
  - 충돌 대상: `spec/1-data-model.md:474`(Execution 컬럼 표 `error` 행) · `spec/1-data-model.md:557-563`
    ("Execution.error ↔ NodeExecution.error 관계" 표)
  - 상세: target 은 "emitter 축"(누가 싣는가: 노드 핸들러 vs 엔진)으로 두 surface 를 이분한다. 그런데
    `1-data-model.md:474` 는 이 두 필드의 `code` 어휘를 **(a) 각 노드 핸들러가 정의한 코드(=최초 failed
    NodeExecution 의 에러를 복사) + (b) "엔진 인프라 차원의 코드"** 의 합집합으로 명시한다 — 즉 이 필드들은
    `EngineErrorCode` 전용이 아니라 `ErrorCode`(노드 실패 복사분)와 `EngineErrorCode` 가 **공존**하는 필드다.
    더 구체적으로, `1-data-model.md:474` 가 "엔진 인프라 차원의 코드" 예시로 드는 4종 중
    `EXECUTION_TIME_LIMIT_EXCEEDED` 는 실측상 `EngineErrorCode` 가 아니라 **`ErrorCode`**
    (`error-codes.ts:73`, "Execution Engine — engine-level limits" 주석과 함께 `ErrorCode` 안에 선언)에
    있다. `RESUME_FAILED`/`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 도 어느 쪽 const 에도
    없다(`EngineErrorCode` JSDoc 이 "이미 타입 앵커가 있어 옮기지 않았다"고 명시 — `RehydrationError.code`
    리터럴 유니온). 즉 실제 귀속 규칙은 "누가 싣는가"가 아니라 "그 코드가 어느 const 로 옮겨졌는가"(선례
    존중·기존 타입 앵커 보존 등 개별 판단)이며, target 의 두-bullet 요약을 문면 그대로 적용하면
    `EXECUTION_TIME_LIMIT_EXCEEDED` 의 소속을 반대로 추론하게 된다.
  - 제안: `EngineErrorCode` bullet 에 "`Execution.error`·`NodeExecution.error` 는 `ErrorCode`(복사된 노드
    실패 코드)와 `EngineErrorCode` 가 공존하는 필드"라는 단서를 덧붙이거나, 최소한 `EXECUTION_TIME_LIMIT_EXCEEDED`
    처럼 "엔진 레벨 개념이지만 `ErrorCode` 에 남아있는" 예외가 있음을 각주로 남길 것. `spec_impact` 에
    `spec/1-data-model.md`(§Execution 컬럼 표 `error` 행) 동반 검토를 추가하는 편이 안전하다 — 지금 상태로는
    두 문서가 같은 필드를 다르게 분류한다.

- **[WARNING]** `4-execution-engine.md` §Rationale의 "신규 코드는 중앙 `ErrorCode` 확장" 문구와 draft가
  승인하는 "자매 const" 패턴 사이에 명시적 우선순위/scope 경계가 없다
  - target 위치: `## Rationale` "왜 자매 const 인가 (선례와의 이탈)" 문단
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1143`, `:1800`(2026-06-14 사용자 결정: "신규 client-safe
    코드는 신규 prefix 를 만들지 않고 중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 네임스페이스를 확장한다")
  - 상세: target 자신이 이 이탈을 인지하고 `exec-intake-followups.md` ARCH#5 ⑤ 를 인용해 "재확인할 뿐 번복
    하지 않는다"고 적는다 — 이는 정확하다(그 근거 문서를 직접 대조 확인함). 다만 그 근거 문서의 완화 요인
    ("그 결정은 WS ack 경계 코드에 한정된 맥락일 수 있다")과, 착수 plan(`spec-conventions-engine-error-code-surface.md`
    "함께 볼 것") 이 명시한 요구사항 — *"병기만 하지 말고 '언제 central enum 을 확장하고 언제 자매 const 를
    만드는가' 의 판단 기준을 함께 적을지 결정하라"* — 가 target 의 `## 변경 제안`에 반영돼 있지 않다. 이
    상태로 병기만 규약 문서에 들어가면, `4-execution-engine.md` 는 여전히 "central enum 확장" 을 유일
    원칙처럼 서술하고 `error-codes.md` 는 "두 surface 병존" 을 사실로 서술하는 두 문서가 나란히 남아,
    향후 신규 엔진 레벨 코드 작성자가 어느 패턴을 따라야 하는지 판단 기준이 없다(이전 consistency round
    `21_34_02` 도 같은 취지의 WARNING/INFO 를 이미 냈던 지점).
  - 제안: 두 선택지 중 하나 — (a) target 변경 제안에 "이 병기는 이미 존재하는 4종
    `EngineErrorCode` 값을 사후 문서화할 뿐, 향후 신규 엔진 코드에 central-enum-확장 대신 자매 const 를
    쓰라는 일반 원칙 선언이 아니다"라는 명시적 scoping 한 줄을 추가, 또는 (b) `4-execution-engine.md`
    §Rationale(1143/1800 인접)에 `error-codes.md` 두-surface 병기를 가리키는 상호 참조를 추가해 두 문서가
    서로를 인지하게 할 것.

- **[INFO]** 착수 plan이 요구한 "판단 기준" 서술이 변경 제안에 없음(계획-산출물 정합성, cross-spec 범위 경계선)
  - target 위치: `## 변경 제안` 전체
  - 충돌 대상: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "## 함께 볼 것 (착수 전 읽기)"
  - 상세: 착수 plan 은 "규약 문서에 한 줄을 쓰면 그 형태가 규약으로 굳는다 — 병기만 하지 말고 판단 기준을
    함께 적을지 planner 가 결정해야 한다 — 그게 이 항목의 실제 무게다"라고 명시했다. target 의 변경 제안은
    두 surface 의 존재·비-중첩만 서술하고 "언제 확장/언제 신설"의 판단 기준 채택 여부에 대한 명시적 결정을
    담지 않는다. 이는 엄밀히는 spec-vs-spec 충돌이 아니라 plan 요구사항 대비 draft 완결성 문제이므로
    INFO 로 낮춰 등재한다 — 위 WARNING 두 건과 함께 처리하면 자연히 해소될 가능성이 높다.

## 요약

target 이 인용하는 사실(코드 위치·overlap 테스트·선행 plan 근거)은 모두 실측과 일치해 날조나 근거 오귀속은
없다. 다만 draft 가 제안하는 "노드 핸들러=`ErrorCode`, 엔진=`EngineErrorCode`"라는 간결한 이분법은 이미
존재하는 두 문서 — `spec/1-data-model.md`(`Execution.error`/`NodeExecution.error` 필드가 두 code family 를
공존시킨다고 명시하며, 그 예시 중 하나(`EXECUTION_TIME_LIMIT_EXCEEDED`)가 실제로는 target 의 규칙과 반대
surface 에 속한다)와 `spec/5-system/4-execution-engine.md`(신규 코드는 central enum 을 확장해야 한다는
2026-06-14 결정문이 아직 그대로 남아 있다) — 와 정합화되지 않은 채로 규약 문서에 들어가게 된다. 기능적
파손은 없으나(코드·엔드포인트·RBAC·상태전이·요구사항 ID 는 모두 영향 밖), 세 문서가 같은 사실을 서로 다른
프레임으로 서술하게 되므로 명시적 우선순위/scope 정리가 필요하다.

## 위험도

MEDIUM
