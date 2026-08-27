# 요구사항(Requirement) Review — `system_error` 배너 라이브 WS 경로 복구 (4라운드 최종 확인)

## 검증 방법

이 diff(`CHANGELOG.md`, `use-execution-events.ts`, `use-execution-events.test.ts`,
`plan/in-progress/system-error-banner-live-ws.md`)는 이미 3라운드(`01_26_11`→`01_44_22`→
`02_02_18`) 리뷰·`RESOLUTION`을 거쳐 CRITICAL 0·WARNING 전건 반영으로 수렴한 상태다. 이번
라운드는 그 최종 상태를 처음부터 재검증했다 — 이전 라운드의 판정을 그대로 승계하지 않고:

- `codebase/frontend/src/lib/websocket/use-execution-events.ts` 전문 Read (JSDoc, `extractNodeErrorPayload`, `handleNodeCompleted`, `handleNodeFailed`)
- `codebase/frontend/src/lib/websocket/__tests__/use-execution-events.test.ts` CT-S9~CT-S17 블록 전문 Read
- `spec/5-system/6-websocket-protocol.md` §4.1 / §4.1-a, `spec/conventions/node-output.md` Principle 0, `spec/conventions/conversation-thread.md` §1.2.1 / CT-S9~S16 행을 line-level 대조
- 백엔드 emit 4곳 실제 좌표 확인: `execution-engine.service.ts:6297·6372·8013`(`NodeEventType.NODE_FAILED`), `ai-turn-orchestrator.service.ts:1532` — plan 문서·spec 인용 좌표와 정확히 일치
- `npx vitest run src/lib/websocket/__tests__/use-execution-events.test.ts` 직접 실행 — **89/89 GREEN** (RESOLUTION `02_02_18` 의 주장과 일치)

## 발견사항

- **[INFO]** `plan/in-progress/system-error-banner-live-ws.md` 체크리스트의 테스트 개수 서술이 최종 상태보다 낡았다
  - 위치: `plan/in-progress/system-error-banner-live-ws.md:62` (`- [x] TEST WORKFLOW 4단계 PASS — frontend 87 (86→87) · e2e 285`)
  - 상세: 이 plan 파일은 최초 커밋(`9869afd5c`) 이후 갱신되지 않았다. 이후 `01_26_11`(`direct` 분기 제거 + JSDoc 재작성) → `01_44_22`(형제 가드 테스트 2건 추가) → `02_02_18`(단락 평가로 무검증이던 분기에 테스트 1건 추가, non-AI 자매 테스트 fixture 통일)를 거치며 테스트 수가 늘었고, 직접 실행한 결과 현재 스위트는 **89/89**다(`02_02_18/RESOLUTION.md` 도 이미 "frontend 89/89"로 기록). 체크박스 자체는 여전히 유효(테스트가 통과한다는 사실은 참)하지만 괄호 안 구체 수치(`87`, `86→87`)는 더 이상 최종 상태를 반영하지 않는다.
  - 제안: 기능 결함은 아니므로 즉시 조치 불요. `/ai-review · push · PR` 체크박스를 체크하는 시점에 함께 `frontend 89/89`로 갱신하면 충분.

- **[INFO]** `- [ ] /ai-review · push · PR` 이 여전히 미체크
  - 위치: `plan/in-progress/system-error-banner-live-ws.md:63`
  - 상세: 이번 세션이 그 `/ai-review` 단계 자체이므로 정상 — 결함 아님. push·PR 완료 후 체크 및 `plan/complete/` 이동이 필요.

## 요구사항 충족 평가

핵심 결함("`system_error` 재시도 배너가 라이브 WS 경로에서 한 번도 뜨지 않는다")과 원인(정정 전
§4.1 문구를 믿은 `extractNodeErrorPayload`의 얕은 `rawOutput.error` 접근 + `handleNodeFailed`의
`undefined` 인자)이 정확히 식별·수정됐다. 최종 코드는:

- `extractNodeErrorPayload(rawOutput)` — `asRecord(rawOutput)?.output` → `asRecord(...)?.error`
  2단 언래핑으로 `spec/5-system/6-websocket-protocol.md` §4.1-a("`error`는 문자열, 구조화 객체는
  `output.output.error`에만") 및 `spec/conventions/node-output.md` Principle 0(래퍼/도메인 구분)과
  line-level 로 일치. JSDoc 도 §4.1-a 인용으로 갱신돼 함수 계약과 문서가 일치한다(이전 라운드
  WARNING이던 JSDoc-stale 문제는 `01_26_11` 에서 해소됨, 직접 재확인 완료).
- 도달 불가능했던 `direct`(객체 `rawError`) 분기는 제거돼 "커버리지 0 방어 코드" 문제가 없다.
- `handleNodeCompleted`(:813)·`handleNodeFailed`(:909) 두 호출부 모두 `payload.output` 을 넘기고
  주석도 §4.1-a·래퍼 구조를 정확히 서술 — 자매 호출부 주석 낙후(이전 WARNING) 해소 확인.
- `code`/`message` 필수 가드(`!code || !message` → `null`), `retryable` 미제공 시 `false` 기본값,
  `retryAfterSec` 는 `typeof === "number"` 검증 후 전달 — `conversation-thread.md` §1.2.1
  `system_error` data shape(필드명·타입·기본값)과 정확히 일치.
- 테스트는 `wrapNodeHandlerOutput` 공유 빌더로 production shape(`{output, config:{}, meta:{}}`)을
  단일 지점에서 생성해 이전 WARNING("fixture 5곳 손 복제")을 해소했고, CT-S9/CT-S10/CT-S15/
  completed 4곳 + 신규 캐너리 2건 + `code`/`message` 부재 가드 + `details` 부재 가드 + "대화
  이력 없음" 단락 평가 가드(`02_02_18` W1 로 실제로 도달함을 뮤테이션 실증)까지 엣지 케이스가
  넓게 커버된다. 89/89 GREEN 직접 재확인.
- 백엔드 emit 4곳(`execution-engine.service.ts:6297·6372·8013`, `ai-turn-orchestrator.service.ts:1532`)
  좌표·payload shape(문자열 `error`, `output` 은 error-port 종결·AI turn 종결 2경로에만 동봉)을
  직접 열어 plan/spec 의 주장과 대조 — 정확히 일치.

TODO/FIXME/HACK/XXX 잔존 없음(`grep` 확인). 모든 코드 경로에서 반환값(`extractNodeErrorPayload`
의 `null` 조기 반환 포함)이 명시적이고 누락된 분기 없음. 비즈니스 규칙(retryable 유무에 따른
`[다시 시도]` 노출, `output` 미동봉 2경로는 배너 미표시가 정상)이 spec §4.1-a·conversation-thread
CT-S9/S10/CT-S16 표와 정확히 일치한다. 유일한 잔여 흠은 기능과 무관한 plan 문서의 낡은 테스트
개수 표기(INFO)뿐이다.

## 위험도

NONE
