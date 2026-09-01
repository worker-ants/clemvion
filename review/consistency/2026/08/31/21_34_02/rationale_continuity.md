# Rationale 연속성 검토 — 엔진 에러 코드 앵커링 (`EngineErrorCode`)

## 검토 대상
- **scope**: `spec/conventions/` (impl-done, diff-base `origin/main`) — 이 브랜치는 `spec/conventions/**` 파일을 변경하지 않았다 (spec 델타 0, 정상).
- **실제 구현 diff**: `codebase/backend/src/nodes/core/error-codes.ts` 에 신규 `EngineErrorCode` const 신설 + 9개 맨 문자열 소비처(`ai-turn-orchestrator.service.ts`·`execution-engine.service.ts`·`shutdown-state.service.ts`)를 상수 참조로 리다이렉트 + AST 앵커 가드 3파일 신설. `plan/complete/exec-intake-followups.md` ARCH#5 항목 완료 처리, `CHANGELOG.md` Unreleased 항목 추가.
- 원 계획(ARCH#5)의 문구는 **"엔진 레벨 에러코드 레이어 **분리**"**(파일 분리를 함의)였으나, 실제 구현은 "파일은 하나, const 는 둘" 로 계획을 명시적으로 뒤집었다 — 이 반전 자체는 `error-codes.ts` JSDoc·`CHANGELOG.md`·`plan/complete/exec-intake-followups.md` 세 곳에 동일한 새 근거(파일 분리 시 동일 파일의 "canonical code strings 는 one source of truth" 원칙이 깨진다)를 갖추고 원문을 취소선으로 보존한 채 기록했다 — **기준 3(무근거 번복)을 위반하지 않는다.** 오히려 미러 3곳 동기화까지 리뷰 라운드를 거쳐 확인된 모범 사례다.

## 발견사항

- **[WARNING]** `EngineErrorCode` 신설이 `4-execution-engine.md` §Rationale 의 "에러 코드 네임스페이스" 결정(2026-06-14, 사용자 확정)을 참조·구분하지 않음
  - target 위치: `codebase/backend/src/nodes/core/error-codes.ts:115-121` (신규 `EngineErrorCode` JSDoc "왜 별 const 인가"), `CHANGELOG.md` Unreleased 항목, `plan/complete/exec-intake-followups.md` ARCH#5 "완료 (2026-08-31)" 블록
  - 과거 결정 출처: [`spec/5-system/4-execution-engine.md` §Rationale "Continuation ack client-safe typed error — 내부 메시지 누출 차단 (§7.5.2, 2026-06-14 결정)"](spec/5-system/4-execution-engine.md) — "**결정 (4점, 전부 옵션 A — 2026-06-14 사용자 확정)**" 항목 1: *"**에러 코드 네임스페이스** = 신규 `EXEC_*` prefix 를 만들지 않고 **중앙 `ErrorCode` enum 의 기존 `EXECUTION_*` 확장**. `EXEC_*` 는 기존 `EXECUTION_*` 과 이중 표기라 기각."*
  - 상세: 위 결정은 엔진 관련 신규 에러 코드가 필요할 때 **별도 네임스페이스/prefix 를 만들지 말고 중앙 `ErrorCode` enum 을 확장**하라고 명시적으로 못박고, 대안(`EXEC_*` 분리 표기)을 "기각"이라는 단어로 못박았다. 이번 PR 이 신설한 `EngineErrorCode` 는 값 문자열에 새 prefix 를 붙이지는 않았지만(`EXECUTION_QUEUE_WAIT_TIMEOUT` 등 기존 이름 유지), **TypeScript 상수 객체 수준에서 엔진 전용 네임스페이스를 새로 만든 것**은 같은 결정이 경계하던 "엔진 코드를 위한 별도 네임스페이스" 패턴과 정확히 같은 형태다. 더 나아가 신설 JSDoc 의 정당화 논리("`ErrorCode` 는 docstring 이 스스로 범위를 *node handlers' `output.error.code`* 로 못박는다")는 같은 파일 안에서 **이미 반증**된다 — `ErrorCode` 에는 `EXECUTION_TIME_LIMIT_EXCEEDED`·`EXECUTION_INTERNAL_ERROR`·`EXECUTION_ENQUEUE_FAILED`·`EXECUTION_MESSAGE_TOO_LONG`·`RETRY_STATE_NOT_FOUND`·`NODE_NOT_RETRYABLE`·`RETRY_TOO_EARLY` 처럼, 인접 주석이 스스로 *"이건 노드 `output.error.code` 가 아니다"* 라고 적어 두고도 **"canonical code strings 는 one source of truth"** 라는 이유로 **같은 enum 안에 의도적으로 함께 둔** 선례가 바로 위 2026-06-14 결정의 산물로서 존재한다(`error-codes.ts:93-96`). 즉 "레이어가 다르면 같은 enum 에 안 넣는다"가 아니라 "레이어가 달라도 한 enum 에 넣어 SoT 를 하나로 유지한다"는 것이 그 결정의 실제 귀결이었는데, 이번 PR 은 그 정확히 같은 상황(엔진이 쓰는, node-handler 가 아닌 코드)에서 **반대 결론**(별도 const)을 택하면서 이 선례·결정을 언급도 반박도 하지 않는다.
  - 참고(완화 요인): 2026-06-14 결정의 표제가 "Continuation ack client-safe typed error" 로, 문면상 **WS ack 의 `errorCode` 경계 코드**에 한정된 맥락일 수 있어 이번 PR 의 `EngineErrorCode`(Execution/NodeExecution DB 영속 `error.code` 봉투, WS ack 아님)에 문자 그대로 적용되는지는 해석의 여지가 있다 — 그래서 CRITICAL 이 아니라 WARNING 이다. 다만 그 해석의 여지 자체가 target 문서 어디에도 명시적으로 다뤄지지 않았다는 점이 문제다.
  - 제안: `plan/complete/exec-intake-followups.md` ARCH#5 완료 블록 또는 `error-codes.ts` 의 `EngineErrorCode` JSDoc 에 한 문단을 추가해 — (a) 2026-06-14 결정이 WS ack 경계 코드에 한정된 것이었고 이번 신설(Execution/NodeExecution DB 영속 봉투)은 그 결정의 스코프 밖이라는 점을 명시적으로 밝히거나, (b) 그렇지 않다면 왜 이번엔 "새 네임스페이스 대신 central 확장" 원칙에서 벗어나는지 근거를 밝혀 두는 것. 두 문장이면 충분하며, 다음에 이 파일을 읽는 사람이 "언제는 central enum 을 확장하고 언제는 새 const 를 만드는가"를 판단할 규칙을 얻는다.

- **[INFO]** `spec/conventions/error-codes.md` 가 `EngineErrorCode` 의 존재를 아직 모른다
  - target 위치: `spec/conventions/error-codes.md` Overview ("적용 범위" 문단, `code:` 의 `ErrorCode` enum 을 "명명이 중앙화된 대표 surface" 로 서술)
  - 과거 결정 출처: 해당 아님(신규 정보 누락 — 위 WARNING 과 동일 원인의 파생)
  - 상세: 값 문자열이 바뀌지 않아 `spec_impact: none` 판정 자체는 (기존 code-review 라운드들이 이미 확인한 대로) 타당하다. 다만 `error-codes.md` 가 여전히 "그 대표 surface" 를 단수 `ErrorCode` 하나로 서술하고 있어, `EngineErrorCode` 라는 자매 const 가 생겼다는 사실이 conventions 문서 어디에도 등재되지 않는다 — 위 WARNING 이 지적하는 "central enum 확장 원칙" 과의 관계를 정리하는 김에 이 문서에도 한 줄 추가하면 두 항목이 함께 닫힌다.
  - 제안: `error-codes.md` §Overview 또는 신규 소절에 "`EngineErrorCode`(엔진 자신이 발행하는 `Execution.error`/`NodeExecution.error` 코드, `error-codes.ts` 동일 파일)" 한 줄을 등재.

## 요약
이번 diff 의 핵심 반전 — 원 계획(ARCH#5, "레이어 **분리**")을 뒤집어 "파일 하나·const 둘" 로 구현한 것 — 은 새 근거를 세 곳(코드 JSDoc·CHANGELOG·plan)에 일관되게 남겨 Rationale 연속성 기준 3(무근거 번복 금지)을 충족한다. 다만 그 새 const 신설이 실제로는 `4-execution-engine.md` §Rationale 의 2026-06-14 "에러 코드 네임스페이스는 중앙 `ErrorCode` enum 을 확장하고 새 네임스페이스를 만들지 않는다"는 명시적 사용자 결정과 접촉면을 가지며, 그 결정의 산물인 "레이어가 달라도 한 enum 에 넣어 SoT 를 하나로 유지한다"는 선례(`RETRY_*`/`EXECUTION_*` 계열)와 반대 결론을 내리면서도 이를 언급·반박하지 않는다. 문면상 그 결정이 WS-ack 경계로 스코프가 좁을 수 있어 명백한 위반(CRITICAL)이라 단정하긴 어렵지만, 다음 독자가 "언제 central enum 을 확장하고 언제 별도 const 를 만드는가"를 판단할 근거가 spec 에 없다는 점에서 WARNING 으로 표시한다.

## 위험도
LOW
