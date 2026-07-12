# Rationale 연속성 Check 결과

## 스코프 확인

target 은 `spec/5-system/` (payload 상 `1-auth.md`, `10-graph-rag.md` 본문 + Rationale 포함)이나,
실제 HEAD 커밋(`ca41ab8ac refactor(knowledge-base): KB WebSocket emit 경로 KbEventType 컴파일타임
강제`)의 diff 는 `spec/5-system/**` 를 **전혀 건드리지 않는다**:

```
codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts       | 14 +++---
codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts    | 14 +++---
codebase/backend/src/modules/websocket/websocket.service.ts                      |  4 ++
plan/in-progress/kb-websocket-emit-compile-guard.md                              | 54 ++++
```

변경 내용은 private `emitEvent(documentId, event, payload)` 헬퍼의 `event` 파라미터 타입을
`string` → `KbEventType`(닫힌 union) 으로 좁히고, 기존의 `event as Parameters<typeof
emitKbEvent>[1]` 캐스트를 제거한 것뿐이다. `KbEventType` union 멤버(11종: embedding 6 + graph 5)
자체는 무변경이며, `websocket.service.ts` 의 JSDoc 에 "emit 경로도 컴파일타임 강제" 설명 한 문단만
추가됐다. plan 문서(`plan/in-progress/kb-websocket-emit-compile-guard.md`)도 "순수 타입 강제
강화 — 계약 멤버 불변" · "spec 본문 변경 불필요" 를 명시한다.

## 발견사항

없음.

- **기각된 대안 재도입 여부**: 해당 없음. 이번 변경은 새로운 대안 채택이 아니라, 기존에 이미
  `spec/5-system/10-graph-rag.md` KB-GR-OB-02 가 서술한 결정("graph 에는 `document:graph_error`
  이벤트가 없다 — emit 경로가 없어 #443 에서 union 제거. 에러는 `_retry`/`_failed` 로만 노출")을
  코드 레벨에서 **강제**하는 방향이다. 오히려 과거 `document:graph_error` 부활 드리프트
  (PR #891, plan 배경 섹션 언급)가 재발하지 않도록 컴파일타임 가드를 추가한 것이라, 기각된
  대안(`graph_error` 이벤트)의 재도입을 막는 조치이지 재도입 자체가 아니다.
- **합의된 원칙 위반 여부**: `websocket.service.ts` 의 `KbEventType` JSDoc(§ "총 11종 = embedding
  6 + graph 5", "graph 에는 대응하는 `document:graph_error` 가 없다")과 diff 후 코드가 정확히
  일치한다 (`KbEventType` 정의부 확인: 11개 리터럴, `document:graph_error` 없음). spec
  KB-GR-OB-02 서술과도 1:1 대응.
- **결정의 무근거 번복 여부**: 없음. union 멤버·behavior 무변경 — "번복" 에 해당하는 변경 자체가
  없다.
- **암묵적 가정 충돌 여부**: 없음. `emitEvent` 가 이제 `KbEventType` 만 받도록 좁혀졌으므로, 기존
  spec 이 "권위 정의(union)" 로 선언한 이벤트 목록을 우회할 방법이 오히려 줄었다 (이전에는
  `string` 캐스트로 인해 union 밖 이벤트명이 런타임에 통과할 수 있는 구멍이 있었음). 이는 spec
  invariant 를 우회하는 설계가 아니라 반대로 invariant 를 코드로 정합화하는 변경이다.

`1-auth.md` 는 이번 diff 와 무관한 파일이며(코드 변경 없음), 그 Rationale(1.1.B-*, 2.3.*, 1.4.*
등)과 충돌 가능성을 점검할 대상 자체가 없다.

## 요약

이번 변경은 spec `5-system/10-graph-rag.md` KB-GR-OB-02 및 `websocket.service.ts` JSDoc 이 이미
문서화한 "KbEventType 은 11종 닫힌 union, `document:graph_error` 없음" 결정을 코드 타입 시스템으로
강제하는 순수 리팩터다. 새로운 설계 결정·대안 채택이 없고, 기존 Rationale 을 그대로 따르며 오히려
그 원칙(닫힌 union)의 우회 경로(캐스트)를 제거해 정합성을 강화한다. `spec/5-system/` 문서 자체는
이번 커밋에서 변경되지 않았고, target 으로 제시된 `1-auth.md`/`10-graph-rag.md` 본문·Rationale
어디에도 이 코드 변경과 충돌하는 대목이 없다. Rationale 연속성 관점에서 문제 없음.

## 위험도
NONE
