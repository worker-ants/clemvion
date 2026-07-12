# 유지보수성(Maintainability) Review

## 리뷰 대상
- `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`
- `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `plan/in-progress/kb-websocket-emit-compile-guard.md`

## 개요
`emitEvent(documentId, event: string, payload)` 사설(private) 헬퍼의 `event` 파라미터를
`string` → `KbEventType` 로 좁히고, 내부의 `event as Parameters<typeof emitKbEvent>[1]`
unsafe cast 를 제거한 순수 타입-강화 변경. `websocket.service.ts` 는 JSDoc 한 문단 추가만
(런타임 코드 변경 없음). 두 서비스에 동일 패턴이 대칭적으로 적용되어 있고, plan 문서가
배경·목표·범위 밖을 명확히 기록했다.

### 발견사항

- **[INFO]** `emitEvent` 사설 헬퍼 로직이 두 서비스에 동일하게 중복
  - 위치: `embedding.service.ts:397-410`, `graph-extraction.service.ts:926-938`
  - 상세: try/catch + `websocketService.emitKbEvent` 호출 + 주석까지 구조가 거의 동일한
    3~4줄짜리 헬퍼가 두 파일에 각각 존재한다. 이번 diff 가 새로 만든 중복은 아니고
    기존부터 있던 패턴에 타입만 좁힌 것이라, 이번 변경 자체의 결함은 아니다.
  - 제안: 현시점에서 굳이 공통 base/mixin 으로 추출할 필요는 없다(2곳·3줄 수준, PR 범위
    밖). 향후 KB 이벤트 emit 로직이 더 늘어나면 공용 헬퍼화를 고려할 수 있다는 정도의
    참고 사항.

- **[INFO]** import 표기(`import { WebsocketService, type KbEventType } from ...`)의
  인라인 `type` modifier 사용
  - 위치: `embedding.service.ts:79-82`, `graph-extraction.service.ts:473-476`
  - 상세: 코드베이스 내 다른 파일들(`main.ts`, `manual-trigger.handler.ts`,
    `graph-warning-rule.ts` 등)에서도 동일한 인라인 `type` named-import 패턴이 이미
    쓰이고 있어 컨벤션과 일관됨을 확인했다. 문제 없음(참고로 기록).

- **[INFO]** `KbEventType` JSDoc 확장 (`websocket.service.ts`)이 "emit 경로도 이 union
  을 컴파일타임에 강제한다"는 사실을 정확히 문서화
  - 위치: `websocket.service.ts:959-961`
  - 상세: 코드 변경(두 서비스의 시그니처 강화)과 문서(union 의 권위성 서술)가 함께
    갱신되어 drift 위험이 낮다. 가독성·향후 유지보수 관점에서 긍정적.

이 외 함수 길이·중첩 깊이·매직 넘버·순환 복잡도·네이밍 컨벤션 관점에서 diff 자체가
도입한 새로운 문제는 발견되지 않았다. 변경분은 사실상 `string` → `KbEventType` 타입
파라미터 좁히기 + `as` 캐스트 제거 + 주석/JSDoc 보강뿐이며, 런타임 동작·제어 흐름·
함수 경계는 그대로다.

### 요약
이번 변경은 범위가 매우 좁고(두 private 헬퍼의 파라미터 타입 좁히기 + 문서 보강), unsafe
`as` 캐스트를 제거해 오히려 가독성과 타입 안전성을 개선하는 리팩터다. 두 서비스에 동일
패턴이 대칭적으로 적용되어 일관성이 있고, plan 문서가 배경·근본 원인·범위 밖을 명확히
남겨 추적성도 좋다. 두 서비스에 걸친 `emitEvent` 헬퍼 자체의 경미한 구조적 중복은
이번 diff 가 만든 것이 아니라 기존부터 있던 것으로, 지금 규모에서는 추출을 강제할
정도는 아니다.

### 위험도
NONE
