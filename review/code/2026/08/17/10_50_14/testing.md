# 테스트(Testing) 코드 리뷰

## 검증 방법

diff 대상 프로덕션/테스트 파일(`executions.service.ts`/`.spec.ts` · `background-runs.service.ts`/`.spec.ts` ·
`websocket.service.ts`/`.spec.ts` · `redact-stored-error.ts`/`.spec.ts` ·
`sanitize-error-message.ts`/`.spec.ts` · `background-run-response.dto.ts` ·
`execution-response.dto.ts`)를 원본에서 직접 열어 diff 가 truncate 된 부분(프롬프트 크기 제한으로
생략된 5개 spec/service 쌍)까지 전수 확인했다. `review/code/**`·`review/consistency/**` 아래
대량 신규 파일은 이전 5라운드(`23_08_19`→`10_26_58`)의 산출물이며, 각 RESOLUTION.md 를 대조해
이번 라운드까지 남은 테스트 관련 미해결 항목이 있는지 추적했다.

## 발견사항

- **[INFO]** `websocket.service.spec.ts` 의 `emitNodeEvent` wire 마스킹 테스트가 이번 작업이 고친
  실제 결함(REST `error`/`input` 표면과의 flip-flop)의 당사자 필드인 `input` 을 직접 겨누지 않고
  `error` 로만 검증한다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` — `② emitNodeEvent —
    wire 도 마스킹 (R17 boundary parity: 수신 인구가 REST 와 동일)` (payload 가 `{ error:
    LEAKY_ERROR }` 뿐, `input` 없음). `①`(fanout)은 `input` 을 검증하지만 대응하는 wire 쪽(`②`)엔
    없다.
  - 상세: `maskWireEnvelope` 는 필드-불특정 전체 envelope 마스킹이라 어느 필드로 검증해도
    메커니즘상 결과는 동일하므로 실질 위험은 낮다 — 직전 라운드(`10_26_58` testing)도 같은 지점을
    INFO·"필수는 아니나"로 처분했고 이번 라운드까지 변화가 없다. 다만 회귀 캐너리로서는 "이 커밋이
    막으려던 그 구체적 결함(WS `input` 값이 REST 원문에 2초 뒤 덮이는 flip-flop)"을 필드 이름
    수준까지 정확히 겨누지 못한 채로 남아 있다.
  - 제안: 낮은 우선순위. `②` 의 payload 에 `input: LEAKY_INPUT` 을 추가해 `wire.input` 마스킹도
    함께 단언하면 캐너리가 결함 서사와 1:1 대응한다. 필수 아님.

- **[INFO]** `maskIfPresent`(비-export 헬퍼, `executions.service.ts`)의 `value == null` 방어
  분기가 실제 `undefined` 값으로는 직접 실행되지 않는다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `maskIfPresent` 함수
    본문의 `value == null ? value : (mask(value) ?? value)`.
  - 상세: JSDoc 은 "TypeORM 이 런타임에 `undefined` 를 줄 수 있는 경로에 대한 방어"라고 명시하는데,
    `executions.service.spec.ts`/`background-runs.service.spec.ts` 의 `nodeExecutions[]` fixture 는
    전부 `inputData`/`outputData`/`error` 를 `null` 또는 실값으로만 채운다 — `undefined` 를 직접
    넣는 fixture 는 없다. `==` 연산자가 `null`/`undefined` 를 동일 경로로 취급하므로 `null` 케이스로
    간접 커버된다는 논거는 타당하고, 이 갭은 3라운드 전(`00_23_57`)에 이미 같은 논거로 INFO 처분된
    바 있어 신규 결함은 아니다.
  - 제안: 조치 불요(기존 처분 유지). 후속으로 여유가 있다면 `nodeExecutions` fixture 한 곳에
    `outputData: undefined as never` 를 명시적으로 넣어 `==` 등가성 주장을 코드로도 고정하면 방어
    분기의 의도가 주석이 아니라 테스트로 남는다.

## 양호한 점

- **자매 표면 회귀를 구조적으로 막는 설계**: `redactStoredDataForResponse`(신규)와 자매
  `redactStoredErrorForResponse` 를 나란히 describe 로 두고 "같은 항목을 각각" 검증하며 그 이유를
  주석에 명시(`redact-stored-error.spec.ts`) — 이 저장소가 반복 겪은 "자매 넷 중 하나만 마스킹"
  결함 클래스를 테스트 설계 층위에서 예방한다.
- **방향성 캐너리 분리**: `executions.service.spec.ts` 의 `⑧`/`⑧-b`(`Execution.inputData` 는
  원문 유지) vs `⑤`/`⑥-b`(`NodeExecution.inputData` 는 마스킹 대상) 를 표로 명시해 "같은 이름의
  컬럼, 반대 방향 정책"을 양쪽 다 고정했다. `⑥-b` 는 값 비교가 아니라 참조 동일성(`toBe`/
  `not.toBe`)으로 3-컬럼 AND 비교의 각 항을 개별적으로 갈라, 값만 비교했다면 놓쳤을 "한 항이
  삭제돼도 GREEN" 취약점을 막는다.
- **마커 멱등성 캐너리**: `[REDACTED]`/`[REDACTED_DEPTH]`/`***` 를 재마스킹하지 않는지 각
  스위트(`redact-stored-error.spec.ts`·`sanitize-error-message.spec.ts`·`executions.service.spec.ts`
  ⑥·`background-runs.service.spec.ts`)가 개별적으로 고정하고, "마커가 아닌 진짜 값은 여전히
  마스킹된다"는 대조 단언을 항상 짝으로 둬서 "전부 보존" 오작동 구현도 통과하는 vacuous 함정을
  피했다.
- **깊이 경계 판별력 실측**: `websocket.service.spec.ts` 의 depth sweep(`it.each`)이 각 depth 값의
  판별력(strip 없이도 통과하는지)을 표로 남기고, 전환점(`MAX-3`↔`MAX-2`)까지 표본에 포함했다 —
  판별력 없는 케이스도 "설계 방어 구조 자체"라는 이유를 밝히고 의도적으로 유지한다.
- **뮤테이션 검증 문화**: RESOLUTION.md·직전 라운드 testing.md 가 매 라운드 실제 관문 코드를
  되돌려 대응 테스트가 RED 로 전환됨을 재현·기록하는 관례를 유지하고 있고, 이번 라운드 검증에서도
  `background-runs.service.spec.ts` 의 신규 마스킹 테스트가 vacuous 하지 않음을 직접 소스 대조로
  확인했다.
- **테스트 격리**: 각 `it` 블록이 payload/fixture 객체를 로컬 스코프에서 새로 생성하므로,
  `DEEP_REDACT_CACHE`/`SANITIZE_CACHE` 같은 모듈 스코프 `WeakMap` 캐시가 있음에도 테스트 간 캐시
  오염 경로가 없다(`sanitize-error-message.spec.ts` "캐시를 공유하지 않는다" 테스트가 이 불변식을
  직접 검증). Mock 은 TypeORM QueryBuilder 체이닝을 각 시나리오별 로컬 헬퍼(`buildOwnershipQB`,
  `buildSingleQB` 등)로 구성해 실제 호출 순서·메서드 체인과 크게 괴리되지 않는다.

## 요약

이번 diff 는 5라운드에 걸친 반복 리뷰를 거치며 `Execution`/`NodeExecution`/`BackgroundRun` egress
마스킹의 테스트 커버리지가 이례적으로 촘촘하다 — 표면 전수(6곳), 컬럼별 방향(카브아웃 레벨 반전),
마커 멱등성, copy-on-change 참조 동일성, 캐시 교차 오염 방지, prototype pollution 방어, 깊이 경계
판별력까지 각각 개별 테스트와 근거 주석으로 고정돼 있다. 직전 라운드(`10_26_58`)가 낸 유일한
WARNING(트래커 문서의 캐너리 방향 서술 stale)은 이번 diff 에서 방향별 표로 정정되어 해소를 확인했다.
남은 발견은 둘 다 INFO 이고 이전 라운드에서 이미 저위험으로 평가·유지 결정된 항목의 재확인이다 —
`emitNodeEvent` wire 테스트가 `input` 필드를 직접 겨누지 않는 점, `maskIfPresent` 의 런타임
`undefined` 방어 분기가 `==` 등가성 논거로만 간접 커버되는 점. 신규 CRITICAL/WARNING 급 테스트
결함은 발견하지 못했다.

## 위험도
LOW
