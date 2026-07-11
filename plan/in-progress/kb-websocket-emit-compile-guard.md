---
worktree: happy-tesla-906461
started: 2026-07-12
owner: developer
spec_impact: none
---

# KB WebSocket emit 경로 컴파일타임 계약 강제

> 작성일: 2026-07-12
> 선행: PR #891 "KB WebSocket 이벤트 count drift 정정" (frontend 가 backend `KbEventType`
> union 에 없는 `document:graph_error` 를 구독하던 12-vs-11 드리프트 정정).

## 배경 / 근본 원인

KB 이벤트를 emit 하는 두 service 의 private `emitEvent(documentId, event: string, ...)` 헬퍼가
`event: string` 을 받고 내부에서 `event as Parameters<typeof emitKbEvent>[1]` 로 union 캐스팅한다.
그래서 호출부가 union 에 없는 이벤트명(예: 되살아난 `document:graph_error`)을 넣어도 tsc 가 못
잡는다 — union 은 문서상 "권위 정의"지만 emit 경로에서 컴파일타임 강제가 무력화돼 있었다.

## 목표 (순수 타입 강제 강화 — 계약 멤버 불변)

private `emitEvent` 의 `event` 파라미터를 `string` → `KbEventType` 로 좁히고 `as` 캐스트를
제거해, 향후 union 에 없는 이벤트명이 build 에러가 되게 한다.

## 변경 대상 (backend 전용)

- [x] `knowledge-base/graph/graph-extraction.service.ts` — `KbEventType` import + `event: KbEventType` + 캐스트 제거
- [x] `knowledge-base/embedding/embedding.service.ts` — 동일
- [x] `websocket/websocket.service.ts` — `KbEventType` JSDoc 에 "emit 경로가 이제 컴파일타임에 union 강제" 한 문장 (선택 항목 반영)

권위 union: `websocket/websocket.service.ts` `export type KbEventType` (11종 = embedding 6 + graph 5).

## 범위 밖

- `KbEventType` union 멤버 변경 금지 (11종 유지). 순수 타입 강제 강화이며 계약(멤버 집합)은 불변.
- spec 본문 변경 불필요 (union 멤버 무변경). §2.5 / §4.3 "권위 정의" 서술은 이미 정확.

## consistency --impl-prep 판단

pure type-narrowing (union 멤버 무변경, 신규 identifier·API·behavior 없음)이라 cross-spec /
rationale / convention / plan / naming 위배가 구조적으로 불가능 → impl-prep fan-out 생략.
hook 강제 게이트인 `--impl-done` (spec-linked 코드 변경) 은 REVIEW WORKFLOW 에서 수행.

## 검증 체크리스트

- [x] 스펙 분석 (§2.5 data-flow/6, §4.3 6-websocket-protocol, 8-embedding-pipeline, 10-graph-rag)
- [x] 구현 (2 service + JSDoc)
- [x] lint (PASS)
- [x] unit (embedding.service.spec + graph-extraction.service.spec 24 tests PASS; backend suite 8104 PASS)
- [x] build (nest build clean — 컴파일타임 union 강제 실증)
- [x] e2e (253 PASS)
- [ ] /ai-review + Critical/Warning 0
- [ ] /consistency-check --impl-done (SPEC-CONSISTENCY 가드)
