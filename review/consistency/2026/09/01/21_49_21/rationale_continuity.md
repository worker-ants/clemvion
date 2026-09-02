# Rationale 연속성 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 없음).

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 `EngineErrorCode` 를
`ErrorCode` 와 층(layer) 기반으로 병기하는 spec draft다. 아래 4개 관점을 실측·원문 대조로
독립 재검증했다 — 위반을 찾지 못했다. (참고: 직전 라운드 `21_46_05/rationale_continuity.md`
도 동일 결론이었고, target 파일은 그 라운드 이후 바이트 단위로 변경되지 않았다 — `diff` 없음
확인.)

### 1. 기각된 대안의 재도입 — 없음

`spec/5-system/4-execution-engine.md` §Rationale "Continuation ack client-safe typed error"
(2026-06-14 결정)의 실제 본문을 직접 열어 대조했다:

> "1. 에러 코드 네임스페이스 = 신규 `EXEC_*` prefix 를 만들지 않고 중앙 `ErrorCode` enum 의
> 기존 `EXECUTION_*` 확장. `EXEC_*` 는 기존 `EXECUTION_*` 과 이중 표기라 기각."

기각된 것은 **`EXEC_*` 값 레벨 prefix** 다. `EngineErrorCode` 자매 const 도입(별도 커밋
`7d1c8da9b`)은 코드 값을 한 글자도 바꾸지 않았고, target 의 "### 범위 한정 — 일반 원칙 선언이
아니다" 절이 이 결정과 "경쟁하지 않는다" 고 명시적으로 scoping 한다 — 기존 4종(`EXECUTION_
QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`/`WEBCHAT_IDLE_TIMEOUT`,
`codebase/backend/src/nodes/core/error-codes.ts:147` 이하 실측 확인)를 사후 문서화할 뿐,
향후 신규 엔진 코드의 귀속처는 말하지 않는다.

target 이 인용하는 `exec-intake-followups.md` ARCH#5 ⑤ 블록도 원문 대조로 검증했다
(`plan/complete/exec-intake-followups.md:82-92`) — "이 논리는 `RETRY_*` 에도 똑같이 적용될 수
있었고 그때는 채택되지 않았다… 형태의 의식적 이탈이다… 내 근거가 선례를 이겼다고 읽지 않도록…
해석의 여지가 있다는 사실 자체를 여기 남긴다" 는 인용은 축약(`…`) 부분을 포함해 원문과
정확히 일치한다. 지어낸 선례가 없다.

### 2. 합의된 원칙 위반 — 없음

`spec/conventions/error-codes.md` §Overview 자신이 "카탈로그·분류·트리거는
`3-error-handling.md §1` 이 SoT. 본 문서는 재선언하지 않는다" 를 이미 선언하고 있다(현재
파일 12~20행 실측). target 은 목적지 필드(`output.error.code`/`Execution.error`/
`NodeExecution.error`)를 §Overview 에 직접 적지 않고 카탈로그 SoT 로 위임한다 — 이 원칙을
그대로 지킨다. `EngineErrorCode` const 자체의 JSDoc(`error-codes.ts:117` 이하)도 "파일은
하나, const 는 둘 — SoT 는 하나로 남는다" 는 동일 원칙을 코드 레벨에서 반복하고 있어,
target 의 서술과 코드 실제 설계가 정합한다.

### 3. 결정의 무근거 번복 — 없음

target 자체가 "두 라운드가 반대로 가리켰다" 절에서 1판(목적지 필드 명시) → 2판(공존 명시) →
3판(SoT 위임, 목적지 필드 서술 삭제)의 번복 이력을 각 라운드의 지적과 함께 기록한다. "판단
기준(언제 central enum 확장·언제 자매 const)을 이번엔 안 쓴다" 결정도 새 Rationale 문단
("### 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다")을 갖추고 있고, 그 SoT 를 착수 근거
plan(`spec-conventions-engine-error-code-surface.md`)으로 명시해 동일 결정이 두 문서에
독립 서술되어 drift 하는 것을 피했다 — 번복이 아니라 "이번 라운드는 다루지 않는다" 는 명시적
스코프 결정이며 근거가 함께 있다.

### 4. 암묵적 가정 충돌 — 없음

`WORKER_HEARTBEAT_TIMEOUT` 이 `spec/conventions/error-codes.md` §3 예외 레지스트리
(70행)에 이미 "엔진 레벨 `error.code`" 로 등재돼 있고 코드상 `EngineErrorCode` 멤버라는
target 의 각주 근거를 재확인했다. `EngineErrorCode` JSDoc 의 목적지 서술(`SERVER_INTERRUPTED`
= "Execution·NodeExecution 양쪽 봉투에 실린다", `EXECUTION_QUEUE_WAIT_TIMEOUT` = "admission
에서 막혀 시작조차 못 한 경우")도 target 의 표와 정확히 일치한다(`error-codes.ts:150,157`
실측). `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `ErrorCode`(중앙 enum) 소속이라는 target 의 반례도
코드(`error-codes.ts:74` 부근 주석)로 확인된다. target 이 재개 신호 후보로 언급한 `WsErrorCode`
도 실재한다(`codebase/backend/src/modules/websocket/ws-error-codes.ts`) — 근거 없는 가정이
아니라 관측된 사실이다.

target 이 이번 diff 밖으로 명시적으로 미룬 `1-data-model.md`/`3-error-handling.md §1.4` 의
선재 drift(3차 `--spec` `21_39_47` cross_spec 지적)도 은폐가 아니라 착수 근거 plan 의 후속
항목으로 등재돼 있음을 확인했다 — 별도 checker 영역 발견을 rationale 서술 안에서 감추지
않았다.

## 요약

이 target 은 여러 라운드에 걸쳐 서로 다른 checker(cross_spec·convention_compliance·
plan_coherence·rationale_continuity)의 지적을 원문 인용과 함께 흡수해 온 이력을 문서 안에
투명하게 남기고 있다. 기각된 대안(`EXEC_*` 값 레벨 prefix)을 재도입하지 않고, SoT 위임
원칙을 지키며, 목적지-필드 서술의 3회 번복마다 근거를 명시했고, 유보 중인 선례 이탈
(ARCH#5 ⑤)을 규약으로 조기 승격시키지 않는 신중함을 유지한다. 모든 인용(ARCH#5 ⑤ 블록,
2026-06-14 결정문, `EngineErrorCode` JSDoc 목적지 서술)을 spec/plan/코드 원문과 대조해 정확함을
확인했다. Rationale 연속성 관점에서 이번 라운드의 새로운 위반은 발견되지 않았다.

## 위험도

NONE
