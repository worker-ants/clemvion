# 부작용(Side Effect) Review

## 리뷰 범위

- 실제 런타임 코드 변경은 파일 1~3(`CHANGELOG.md`, `websocket.service.spec.ts`, `websocket.service.ts`)뿐이다.
  파일 4~33(`plan/**`, `review/code/2026/08/14/10_32_27/**`, `review/consistency/2026/08/14/{07_44_12,10_32_29}/**`)은
  전부 markdown/json 산출물(plan·이전 리뷰/consistency 결과)이라 런타임 부작용 관점 대상이 아니다 —
  파일 생성 자체는 이번 diff 의 "의도된" 산출물(강제 리뷰/consistency 워크플로)이라 "예상치 못한
  파일시스템 부작용"에 해당하지 않는다.
- `websocket.service.ts`/`stripDeep`/`stripExternalOnlyFields`는 이전 라운드(`10_32_27`)에서
  이미 side_effect/security/performance/testing/maintainability 관점으로 상세 검토됐고
  `RESOLUTION.md`(`review/code/2026/08/14/10_32_27/RESOLUTION.md`)가 W1(`__proto__` 오염)·W3(할당
  주장 과장)·W4(깊이 상한 호출 순서 의존)를 "조치 완료"로 표시했다. 실제 코드를 직접 열어 그 처방이
  적용됐는지 대조했다 — `out ??= { ...obj }` 지연 할당 + `Object.defineProperty` 사용, `MAX_SANITIZE_DEPTH`
  캡 도입 모두 확인됨. 이번 라운드에서는 **그 처방 자체가 만든 새로운 부작용**에 집중했다.

## 발견사항

- **[WARNING]** `stripDeep` 에 새로 추가된 깊이 상한이 형제 함수 `sanitizePayloadForWs` 와 **경계값 비교 연산자가 달라(`>=` vs `>`) 정확히 depth=10 노드에서 strip 이 조용히 건너뛰어진다** — "형제와 같은 상한을 쓴다"는 JSDoc 주장이 그 경계에서 거짓이다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:387` (`function stripDeep`, `if (depth >= MAX_SANITIZE_DEPTH) return value;` — diff 게이트 387행과 일치) / 대조 `codebase/backend/src/modules/websocket/websocket.service.ts:251` (`function sanitizePayloadForWs`, `if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';` — 이번 diff 밖의 기존 코드, 직접 Read 로 확인한 실제 소스 줄 번호)
  - 상세: 두 함수 모두 "root 자신 = depth 0, 자식 = depth+1" 로 동일한 깊이 규약을 쓰고, `wireEnvelope = {executionId, ...sanitizedPayload, seq, timestamp}` 는 spread 라 추가 중첩 레벨을 만들지 않으므로 같은 논리 노드에 대해 두 함수의 `depth` 값이 정확히 일치한다(직접 추적 확인). 그런데 `sanitizePayloadForWs` 는 `depth > 10`(즉 depth 11 이상)에서만 `'[REDACTED_DEPTH]'` 문자열로 대체하고, depth 0~10(11개 레벨)의 노드는 **자신의 키를 정상적으로 검사**한다(`sanitizeInner(value, depth)` 진입). 반면 `stripDeep` 은 `depth >= 10`(depth 10 이상)에서 즉시 `return value` 하고 `Object.entries(obj)` 루프에 아예 진입하지 않는다. 즉 depth 정확히 10인 노드는 `sanitizePayloadForWs` 관점에서 **아직 real/비-redacted 데이터**(그 노드 자신의 키는 credential 마스킹만 거치고 원본 그대로 보존)인데, `stripDeep` 은 이 노드를 이미 "상한 초과라 손댈 필요 없는 대상"으로 취급해 그 노드 자신의 키 중 `llmCalls` 가 있어도 strip 하지 않고 그대로 반환한다. `stripDeep` JSDoc(`:360-364`)이 "상한을 넘으면 그 아래는 손대지 않고 그대로 둔다 — … 상한 초과 서브트리는 **이미 `sanitizePayloadForWs` 가 `[REDACTED_DEPTH]` 로 마스킹한 뒤다**" 라고 명시적으로 안전을 주장하는데, 이 주장은 depth 정확히 10인 경계 노드에서는 사실이 아니다(그 노드는 문자열로 마스킹되지 않은 실제 객체다). 결과적으로 depth 10 지점에 `llmCalls` 라는 키가 우연히(또는 매우 긴 AI 대화/도구 호출 결과의 깊은 JSON 중첩으로) 존재하면, 이번 PR 이 막으려던 것과 **같은 클래스의 정보 유출**(raw LLM request/response 가 외부 fanout 으로 새는 것)이 이 경계에서 재발할 수 있다.
  - 현재 실증된 두 leak 경로(`turnDebug.llmCalls.llmCalls[]`, `nodeOutput.meta.turnDebug[].llmCalls[]`)는 깊이 1~3 수준이라 이 diff 로 확실히 막힌다 — 이 finding 은 그 두 경로가 아니라 **새로 도입된 방어(depth cap) 자체의 경계 결함**이다. 이 프로젝트 메모리에 반복 기록된 "문서한 보장이 구현보다 넓으면 안 된다" 패턴과 정확히 같은 종류다.
  - 제안: `stripDeep` 의 경계 조건을 `sanitizePayloadForWs` 와 동일하게 `if (depth > MAX_SANITIZE_DEPTH) return value;` 로 맞추거나(권장 — 상한값을 depth 10까지 inclusive 로 처리하는 sanitize 쪽에 맞춤), 또는 두 함수가 서로 다른 경계 의미를 의도적으로 갖는다면 그 이유를 JSDoc 에 명시. 경계 테스트(정확히 depth 10 노드에 `llmCalls` 를 심어 strip 되는지 단언하는 회귀 테스트)를 `websocket.service.spec.ts` 에 추가하면 이 계열의 재발도 함께 잡는다(형제 함수의 `MAX_SANITIZE_DEPTH` 경계 테스트, `testing.md` 가 인용한 `:199` 케이스와 짝을 이루도록).

## 확인했으나 문제 없음 (positive findings)

- `stripExternalOnlyFields`/`stripDeep` 모두 module-private(비-export) 함수이고, 호출부는 같은 파일의 `emitExecutionEvent`(`:571`)·`emitNodeEvent`(`:642`) 두 곳뿐이다(`grep -rn` 으로 저장소 전체 확인) — 공개 API·다른 모듈 호출자에 대한 시그니처/인터페이스 영향 없음.
- `emitExecutionEvent`/`emitNodeEvent` 본문(이 diff 밖의 기존 코드, `executionEventSubject.next(...)` 호출 지점 포함)은 이번 diff 에 포함되지 않았다 — 이벤트 발행 횟수·구독자·콜백 배선은 변경되지 않았고, `stripExternalOnlyFields` 의 **내부 구현만** 교체됐다.
- `stripDeep` 은 입력을 어떤 경로로도 mutate 하지 않는다 — 배열 분기는 변경이 있을 때만 `value.slice()`, 객체 분기는 `out ??= { ...obj }` 로 지연 spread 후 `Object.defineProperty` 로 기록. `__proto__` 리터럴 키가 있어도 스프레드가 먼저 own data property 로 옮겨두므로 이후 `defineProperty` 가 프로토타입을 갈아치우지 않는다(직접 소스 확인, 이전 라운드의 W1 처방이 실제로 반영됨).
- 전역 변수 신설 없음 — `EXTERNAL_STRIPPED_FIELDS`(기존)·`MAX_SANITIZE_DEPTH`(기존, export 된 채 재사용)만 참조.
- 환경 변수·파일시스템·네트워크 호출과 관련된 변경 없음(순수 인메모리 payload 변환).
- `plan/in-progress/eia-terminal-payload.md`·`spec-draft-eia-62-waiting-payload.md`(파일 4~5)와 `review/**` 산출물(파일 6~33)은 문서 신설일 뿐이며, 코드 실행 경로에 어떤 영향도 주지 않는다.

## 요약

핵심 코드 변경(`stripExternalOnlyFields`→`stripDeep`, depth-1 shallow에서 깊이 무관 재귀 strip으로 교체)은 mutate-free·비-export·이벤트 배선 불변이라는 점에서 부작용 관점의 큰 결함은 없다. 이전 라운드(`10_32_27`)가 지적한 `__proto__` 오염·과장된 "할당 없음" 주장·호출 순서 의존 깊이 상한 부재는 실제로 소스에서 처방이 반영됐음을 직접 확인했다. 다만 그 처방으로 새로 도입된 깊이 상한(`stripDeep:387`)이 형제 함수(`sanitizePayloadForWs:251`)와 경계값 비교 연산자가 미묘하게 달라(`>=` vs `>`), 정확히 depth 10 인 노드에서 strip 이 스킵되는 좁지만 실재하는 경계 결함이 생겼다 — "형제와 같은 상한을 쓴다"는 JSDoc 의 안전 주장이 그 경계에서는 성립하지 않는다. 현재 실증된 두 leak 경로는 깊이가 얕아 이 diff 로 확실히 막히므로 즉시 재현 가능한 CRITICAL 은 아니지만, 이 PR 이 막으려던 것과 같은 클래스의 정보 유출을 재도입할 수 있는 지점이라 WARNING 으로 기록한다.

## 위험도

MEDIUM
