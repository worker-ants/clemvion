# 아키텍처(Architecture) 리뷰 — `20_50_49` (4차 fresh review)

## 검토 방법

이 diff(`origin/main...HEAD`)는 `ws-event-types-extract` 리팩터 자체(코드 27개 파일) + 그 위에서
누적된 3차례 코드 리뷰(`19_27_37` → `20_05_17` → `20_27_08`)와 2차례 consistency-check
(`18_53_27`, `20_05_19`)의 산출물 + spec frontmatter 1줄로 구성된다. 직전 세 라운드 모두
아키텍처 관점 CRITICAL/WARNING 은 0건으로 수렴했고(`19_27_37` W1 gateway 순환 노드 누락 →
`20_05_17` 에서 해소 확인, 이후 두 라운드는 신규 발견 없음), 이번 라운드의 실질 코드 델타는
직전 라운드(`20_27_08`)가 **testing/maintainability** 관점에서 지적한 두 건 —
(1) 회귀 가드가 별칭(`as`)으로 판정해 `import { ExecutionEventType as WebsocketService }` 를
놓치던 FN, (2) `import type` 누락 5문장(스펙 파일 2곳 포함) — 을 고친 것이다. 둘 다 아키텍처
표면(모듈 경계·순환·레이어 책임) 자체를 바꾸지 않으므로, 이번 라운드는 "새 아키텍처 결함이
있는가"와 "직전 라운드가 확정한 구조가 이번 fix 로 흔들리지 않았는가"를 중심으로 재검증했다.
프롬프트 diff 게이트가 아니라 현재 워크트리 소스를 직접 `Read`/`grep` 로 대조했다:

- `codebase/backend/src/modules/websocket/websocket-events.types.ts` 전체(266줄) — import 0줄 재확인
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` 전체(286줄) — 가드 로직(`valueEdgeToWebsocketService`, `originalName`) 재독
- `codebase/backend/src/modules/websocket/websocket.gateway.ts` — `websocket.service`/`WebsocketService` 참조 전수(0건, `grep` 확인)
- `codebase/backend/src/modules/websocket/websocket.service.ts` 상단 40행 — 값/타입 import·re-export 분리 형태

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 급 아키텍처 결함은 없다.

- **[INFO]** re-export facade 가 여전히 3중 수동 동기화 지점(`websocket.service.ts` export 블록 / `websocket-events.types.ts` 선언 / `websocket-events.types.spec.ts` 의 `EXPECTED_EXPORTS`)이라는 관찰은 `20_27_08/architecture.md` 가 이미 INFO 로 기록했고 이번 라운드의 diff(가드 로직·import type 수정)는 이 구조를 바꾸지 않았다. 재확인만 하고 새 항목으로 세지 않는다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `export { … } / export type { … }` 블록(현재 함수: 파일 상단 31-46행), `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` `EXPECTED_EXPORTS` 배열
  - 제안: 조치 불필요(비차단, 이전 라운드 합의 유지).
- **[INFO]** 순환 재편입 가드(`websocket-events.types.spec.ts`)가 lint/CI 아키텍처 계층이 아니라 단위 테스트 계층에서 `src/` 전체(~1,230 파일)를 스캔하는 배치도 `20_27_08/architecture.md` 가 이미 지적·합의한 사안이며 이번 라운드의 변경(`originalName` 별칭 판정 수정, 5번째 `import type` 테스트 추가)은 그 배치 자체를 바꾸지 않았다. 다만 새로 추가된 5번째 테스트도 같은 `allTsFiles(SRC_ROOT)` 전수 스캔 패턴을 반복해, 이 가드 부류가 lint 계층으로 승격되지 않는 한 앞으로도 여기(단일 모듈의 spec 파일)에 계속 쌓일 구조라는 점만 참고로 덧붙인다.
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` (다섯 번째 `it`, "타입 전용 심볼을 `type` 표시 없이 import 하는 곳이 없다")
  - 제안: 조치 불필요 — 직전 라운드가 이미 "후속 PR 에서 `no-restricted-imports`/`*.arch.spec.ts` 로 승격 고려"로 처분했고 이번 라운드가 그 판단을 반증할 근거가 없다.

## 확인 완료 — 직전 라운드(`20_27_08`) fix 의 아키텍처 영향 재검증 (문제 없음)

- **가드 별칭 오탐/미검출 수정 (`20_27_08` W2)**: `valueEdgeToWebsocketService` 의 `originalName` 헬퍼가 로컬 바인딩(`el.name`)이 아니라 원 export 식별자(`el.propertyName ?? el.name`)로 판정하도록 바뀌었다. 이 변경은 가드의 **판별 로직**만 수정하며, 가드가 지키는 대상(`websocket-events.types.ts` 의 의존성-프리 경계)이나 모듈 그래프 자체는 건드리지 않는다 — 아키텍처 표면 무변경.
- **`import type` 5문장 완성 (`20_27_08` W1)**: `execution-event-emitter.service.spec.ts:6`(`ExecutionRoutingContext`), `websocket.service.spec.ts:3`(`ExecutionChannelEvent`) 등 남은 5곳이 `import type` 으로 통일됨을 diff 로 확인. 값/타입 import 분리라는 이 리팩터의 설계 원칙(그리고 그 원칙을 검증하는 가드의 `isTypeOnly` 판별 기준)과 정합적이며, 새 결합이나 새 export 표면 변경은 없다.
- **순환 당사자 노드**: `websocket.gateway.ts` 는 여전히 `websocket.service`/`WebsocketService` 를 값·타입 어느 쪽으로도 참조하지 않는다(`grep` 결과 0건, `20_50_49` 기준 재확인) — `19_27_37` W1 이 지적한 결함이 이후 라운드에서 회귀하지 않았다.
- **의존성-프리 모듈 무결성**: `websocket-events.types.ts` 는 이번 라운드에서도 import 문이 0줄이며, 선언 12종(값 4 + 타입 8)이 `websocket.service.ts` 의 re-export 블록(값/타입 각각 `import`→`export` 재배포)과 1:1 일치한다.

## 설계 평가

4개 라운드에 걸친 리뷰 이력의 마지막 단계인 이번 diff는, 순수하게 회귀 가드 자신의 판별 로직
결함(별칭 세탁으로 인한 FN)과 그 가드가 스스로 강제하는 타입/값 import 분리 원칙의 잔여
불일치(스펙 파일 2곳)를 고치는 것으로, **아키텍처 구조 변경이 전혀 없다**. 핵심 설계
— ES-module 순환 위에 있던 `websocket.service.ts` 에서 값/타입 선언을 의존성 0인 leaf
모듈로 분리하고, 하위호환은 re-export facade 로 유지하며, 그 불변식을 정적 가드(TS 파서
기반 fitness function)로 코드에 고정한다 — 는 3차례 리뷰를 거치며 흔들리지 않았고, 이번
4차 라운드에서도 실제 소스 대조 결과 그 구조가 정확히 유지되고 있음을 확인했다. 흥미로운
점은 가드 자체가 **세 라운드 연속으로 스스로의 판별 로직 결함**(첫 형태 blind-spot →
별칭 미대응 → 타입 표시 누락)을 발견당했다는 것인데, 이는 제품 코드가 아니라 가드 코드
쪽으로 리뷰의 화력이 수렴하고 있다는 신호이며 — 매번 인스턴스가 아니라 부류(헬퍼 함수·
5번째 테스트)로 고정한 접근은 SRP·재사용성 관점에서 적절하다.

## 요약

이번 라운드(`20_50_49`)는 직전 라운드(`20_27_08`)가 testing/maintainability 관점에서 찾은
가드 로직 결함(별칭 세탁 FN)과 `import type` 누락 5문장을 고친 것으로, 아키텍처 관점의 모듈
경계·순환·레이어 책임·SOLID·확장성 어느 축에서도 구조 변경이나 새 결합이 발생하지 않았다.
`websocket.gateway.ts` 의 순환 노드 이탈, `websocket-events.types.ts` 의 의존성-프리 상태,
re-export facade 의 export 표면 일치를 현재 소스에서 직접 재확인했고 전부 이전 라운드가
기록한 상태와 일치한다. 유일한 잔여 관찰(re-export facade 3중 수동 동기화, 가드의 테스트-계층
배치)은 두 라운드 전부터 이미 INFO 로 합의된 비차단 사안이며 이번 라운드가 이를 반증하거나
악화시키지 않았다. 이 PR을 막을 아키텍처 사유는 없다.

## 위험도

NONE
