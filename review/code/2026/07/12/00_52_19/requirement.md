# 요구사항(Requirement) Review

## 대상
- `codebase/backend/src/modules/knowledge-base/embedding/embedding.service.ts`
- `codebase/backend/src/modules/knowledge-base/graph/graph-extraction.service.ts`
- `codebase/backend/src/modules/websocket/websocket.service.ts`
- `plan/in-progress/kb-websocket-emit-compile-guard.md`

목표(plan 명시): private `emitEvent(documentId, event, payload)` 의 `event` 파라미터를
`string` → `KbEventType` 로 좁혀 `as Parameters<typeof emitKbEvent>[1]` unsafe cast 를
제거하고, union 밖 이벤트명을 build 타임에 차단. union 멤버 집합(11종) 자체는 불변 —
순수 타입 강제 강화.

## 검증 수행
- 두 service 의 모든 `emitEvent(...)` 호출부(embedding 5곳 / graph 6곳)가 `KbEventType`
  union 멤버인 문자열 리터럴만 전달함을 grep 으로 전수 확인 — non-literal 인자 없음 →
  narrowing 이 컴파일 실패를 유발할 여지 없음.
- `npx tsc --noEmit` 로 변경 3파일 관련 타입 에러 0건 실측 (plan 의 "build clean" 주장 재현).
- `emitKbEvent` 의 다른 production 호출부 존재 여부 grep — 3개 파일 외 없음 (스코프 누락 없음).
- 두 service 의 `.spec.ts` 는 `emitKbEvent` (public, `WebsocketService` mock) 를 직접
  스텁하며 private `emitEvent` 를 호출하지 않음 → 타입 narrowing 으로 인한 테스트 회귀 여지 없음.
- spec 크로스체크: `spec/5-system/6-websocket-protocol.md` §4.4, `spec/5-system/8-embedding-pipeline.md`,
  `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md` 전부 "`KbEventType` union
  11종(embedding 6 + graph 5), `document:embedding_error` 선언만 존재(미emit), `document:graph_error`
  는 #443 에서 제거" 로 일치. 이번 diff 는 union 멤버를 건드리지 않으므로 spec 본문과 line-level
  불일치 없음.

## 발견사항

- **[INFO]** 변경은 순수 컴파일타임 타입 강제(narrowing)이며 런타임 동작·이벤트 payload·채널
  명명·재시도 정책·상태 전이 어느 것도 바꾸지 않는다.
  - 위치: `embedding.service.ts` / `graph-extraction.service.ts` `private emitEvent`, `websocket.service.ts` JSDoc
  - 상세: `event: string` → `event: KbEventType`, `as` 캐스트 제거, `websocket.service.ts` 에 "emit
    경로도 컴파일타임 강제" 설명 주석 1개 추가. 로직·분기·에러 처리·반환값 전부 diff 밖.
  - 제안: 없음(수정 불필요). plan 의 "spec 본문 변경 불필요" 판단과 일치 — 새 요구사항 ID·필드·에러코드가
    생기지 않으므로 spec 갱신 대상 아님.

- **[INFO]** `plan/in-progress/kb-websocket-emit-compile-guard.md` 체크리스트 중 `/ai-review` +
  Critical/Warning 0, `/consistency-check --impl-done` 두 항목이 미체크 상태.
  - 위치: plan 파일 "검증 체크리스트" 마지막 2줄
  - 상세: 본 리뷰가 그 `/ai-review` 단계에 해당하므로 정상적인 진행 중 상태(리뷰 완료 후 체크 예정).
    결함 아님 — 참고용 기록.
  - 제안: 리뷰 결과 반영 후 체크박스 갱신(CLAUDE.md "plan 체크박스 = 실제 상태" 규약).

발견된 CRITICAL/WARNING 없음. TODO/FIXME/HACK/XXX 주석 없음. 엣지 케이스·에러 시나리오·반환값·
비즈니스 로직은 이번 diff 범위 밖(모두 기존 로직 그대로, 파라미터 타입만 좁힘)이라 별도 결함 여지가
구조적으로 없음.

## 요약
이번 변경은 KB WebSocket emit 경로의 `event` 파라미터를 `string` 에서 `KbEventType` union 으로
좁혀 기존의 `as` unsafe cast 를 제거하는 순수 컴파일타임 타입 강화 리팩터다. 모든 호출부가 이미
union 멤버 리터럴만 전달하고 있어 동작 변경이나 회귀 위험이 없으며, `tsc --noEmit` 로 3파일 모두
타입 에러 0건을 직접 재현했다. union 멤버 집합(11종)과 관련 spec 4개 문서(websocket-protocol,
embedding-pipeline, graph-rag, data-flow/6-knowledge-base) 서술이 모두 일치하고 이번 diff 로
그 서술이 훼손되지 않는다. 요구사항 충족 관점에서 결함 없음.

## 위험도
NONE
