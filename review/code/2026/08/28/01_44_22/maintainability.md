# 유지보수성(Maintainability) 리뷰 — `01_44_22`

## 발견사항

- **[INFO]** `handleNodeCompleted`/`handleNodeFailed` 두 핸들러에서 `errorPayload` 추출 →
  `retryable`/`retryAfterSec` 정규화 → `addConversationMessage(makeSystemErrorItem(...))`
  블록이 거의 동일하게(~20줄) 중복된다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:813-835`
    (`handleNodeCompleted`) vs `:909-931` (`handleNodeFailed`)
  - 상세: diff 이전부터 있던 중복이지만, 이번 diff 가 정확히 그 블록의 호출 인자
    (`extractNodeErrorPayload(payload.output)`)를 양쪽 다 고친 지점이라 — 향후 shape 이
    또 바뀌면 두 곳을 동시에 고쳐야 하는 위험이 이번에 재확인됐다(실제로 W2 라운드에서
    한쪽만 고치고 자매 주석을 놓친 이력이 있음, `01_26_11` RESOLUTION W2). 이미 이전
    리뷰 라운드(`01_26_11` maintainability WARNING #... INFO #4)에서 지적됐고 "이번 PR
    범위 밖"으로 명시적으로 defer 된 항목 — 재차 강등 사유는 유효하지만 신규 결함은
    아니다.
  - 제안: `appendSystemErrorIfNeeded(rawOutput, { nodeId, nodeLabel, nodeExecutionId,
    nodeType, timestamp })` 같은 공유 헬퍼로 추출해 단일 지점화. 이번 PR 범위는 아니라
    보되, 다음에 이 블록을 또 손대게 되면 추출을 미루지 말 것.

- **[INFO]** `extractNodeErrorPayload` 내부의 `asRecord(asRecord(domain)?.error)` 이중
  중첩 호출이 한 줄에 압축돼 있어 즉시 읽기엔 약간 밀도가 높다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:90`
  - 상세: JSDoc 이 "래퍼 한 겹 아래" 를 설명해 의도는 파악 가능하지만, 코드만 보면
    `asRecord(domain)?.error` 가 무엇을 언래핑하는 중간 단계인지 변수명 없이 추론해야
    한다.
  - 제안: `const domainRecord = asRecord(domain); const source =
    asRecord(domainRecord?.error);` 로 한 단계 풀어써 중간값에 이름을 주면 가독성이
    소폭 개선된다. 필수는 아님(현재도 JSDoc 이 보완).

- **[INFO]** `payload.output` 필드의 타입 표기가 두 핸들러에서 다르다 —
  `handleNodeCompleted` 는 `output?: Record<string, unknown>`, `handleNodeFailed` 는
  `output?: unknown` 으로 같은 `NodeHandlerOutput` 래퍼를 서로 다른 폭으로 타이핑한다.
  - 위치: `handleNodeCompleted` payload 타입 리터럴의 `output` 필드 vs `handleNodeFailed`
    payload 타입 리터럴의 `output` 필드 (같은 파일, 두 `useCallback` 정의 상단)
  - 상세: 이번 diff 가 `extractNodeErrorPayload` 시그니처를 `rawOutput: unknown` 하나로
    통일했기 때문에 실질적 동작 차이는 없지만, "같은 개념(NodeHandlerOutput 래퍼)에 대해
    호출부마다 다른 로컬 타입을 손으로 duck-type 한다"는 근본 원인(이번 결함의 근본
    원인과 같은 계열: 공유 타입 부재)은 그대로 남아 있다.
  - 제안: 여유가 있을 때 `NodeHandlerOutput` 타입을 (테스트의 `wrapNodeHandlerOutput`
    반환 타입도 포함해) 한 곳에 정의해 두 payload 타입 리터럴과 테스트 빌더가 모두
    참조하도록 하면, 다음 "한 겹 얕았다" 류 회귀의 진입 지점 하나가 줄어든다. 이번 PR
    범위는 아님.

- **[INFO]** `extractNodeErrorPayload` 의 JSDoc(26줄)이 API 계약 설명과 이번 결함의
  포스트모템 서술(취소선 인용, "그 서술이 이 파일의 결함을 낳았다" 등)을 함께 담고 있어
  함수 본문(12줄)보다 훨씬 길다.
  - 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts:58-83`
  - 상세: 이 서술 스타일(정정 전 문구를 취소선으로 남기고 왜 틀렸는지 기록)은 이
    코드베이스 전반의 확립된 컨벤션과 일치하고(`spec_impact` 자기반증형 소정정 패턴,
    `masked-marker-mirror.test.ts` 등 다른 캐너리 주석에서도 동일 패턴 반복), 이번
    사고("결함이 초록으로 가려짐")의 재발 방지에 실질적 가치가 있어 규칙 위반은 아니다.
    다만 시간이 지나 SoT(`spec/5-system/6-websocket-protocol.md §4.1-a`)가 다시 갱신되면
    이 서사형 문단들이 갱신 대상에서 누락되기 쉬운 위치(함수 JSDoc 최상단, plan 문서와
    이중화)라는 점만 유의.
  - 제안: 조치 불요. 향후 §4.1-a 가 또 바뀔 때 이 JSDoc 도 함께 갱신 대상임을 잊지 말 것
    (plan 문서 `plan/in-progress/system-error-banner-live-ws.md` 하나만 보고 코드
    JSDoc 을 놓치는 실수가 이번 라운드에도 있었음 — `01_26_11` W1).

## 요약

이번 라운드의 diff 는 직전 리뷰(`01_26_11`)에서 지적된 CRITICAL/WARNING 4건(JSDoc-함수
인접성 분리, 자매 호출부 주석 낙후, fixture 중복 5곳, `direct` 분기 커버리지 0)을 이미
`asRecord` 재배치·`wrapNodeHandlerOutput` 빌더 추출·`direct` 분기 제거로 해결한 상태에서
출발한다. `asRecord`/`extractNodeErrorPayload`/`wrapNodeHandlerOutput` 모두 네이밍이
목적을 정확히 드러내고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮으며, 매직 넘버도 없다.
남은 발견사항은 전부 INFO 수준으로 (1) 두 핸들러 간 ~20줄 기존 중복(이미 이전 라운드에서
스코프 밖으로 defer됨), (2) 이중 `asRecord` 호출의 근소한 밀도, (3) `output` 필드의
호출부 간 타입 표기 불일치, (4) JSDoc 의 서사형 분량 — 이며 넷 다 동작에 영향이 없고
런타임 회귀 위험도 없다.

## 위험도
LOW
