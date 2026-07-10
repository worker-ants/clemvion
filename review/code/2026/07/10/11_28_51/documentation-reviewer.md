# 문서화 리뷰 — KB WebSocket 이벤트 count drift 정정

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- diff: `origin/main..HEAD` (base `2aa4c8093`, HEAD `8c3e95319`)
- 변경 파일: `codebase/backend/src/modules/websocket/websocket.service.ts`,
  `codebase/frontend/src/lib/websocket/use-kb-events.ts`(+신규 테스트),
  `spec/5-system/6-websocket-protocol.md`, `spec/5-system/10-graph-rag.md`,
  `spec/5-system/8-embedding-pipeline.md`

## 검증 결과 요약 (diff 자체)

diff 가 직접 수정한 4개 파일(backend union JSDoc, frontend JSDoc 2곳 + `KB_EVENT_NAMES`,
6-websocket-protocol §4.3, 10-graph-rag §6/KB-GR-OB-02, 8-embedding-pipeline §8.1/§8.2)은
**상호 일관**됨을 확인했다:

- 총 11종(embedding 6 + graph 5) 서술이 4개 파일 전부 동일.
- `document:embedding_error` — "union 선언·현재 미emit·`embedding_status='error'`+`_retry` 로 통지·forward-compat" 서술이 동일하게 반복되고, 실제 코드(`embedding.service.ts:106-112`)와 정확히 일치함을 확인 (`embeddingStatus: 'error'` set 후 `emitEvent(documentId, 'document:embedding_retry', ...)` — `document:embedding_error` 를 emit 하는 코드 경로 없음).
- `document:graph_error` — "#443 에서 union 제거·emit 경로 없음" 서술이 backend union JSDoc·frontend JSDoc 2곳·두 spec 파일에서 동일. `git show 6898c4b3c`(#443, 2026-06-03)에서 실제 이 union 정리가 수행됐음을 확인.
- `data-flow §2.5` cross-reference — `spec/data-flow/6-knowledge-base.md §2.5`(287-301행)를 직접 읽어 확인. "총 11개(embedding 6 + graph 5)", "`document:graph_error` 는 emit 경로가 없어 union 에서 제거됨 — #443", `document:embedding_error` 는 "union 에 정의돼 있으나 현재 backend emit 경로 없음 — `_retry` 로 통지" 라고 정확히 동일 사실을 담고 있어 참조가 유효함.
- `{@link KB_EVENT_NAMES}`(`use-kb-events.ts:42`) — 같은 파일 18행에 `export const KB_EVENT_NAMES` 로 실존, TSDoc 문법 오류 없음.
- 신규 회귀 테스트 `use-kb-events.test.ts` — `npx vitest run` 로 실행해 5개 케이스 전부 통과 확인. union parity 를 실측 가드하는 유효한 문서적 안전장치.

## 발견사항

- **[CRITICAL]** `spec/2-navigation/5-knowledge-base.md:182` — 그래프 이벤트 목록에 삭제된 `_error` 가 여전히 남아 이번 diff 가 정정한 사실과 정면으로 모순
  - 위치: `spec/2-navigation/5-knowledge-base.md:182`
  - 상세: `- WebSocket 이벤트 (`document:graph_started` / `_progress` / `_completed` / `_error` / `_retry` / `_failed`) 로 실시간 갱신...` — `_error` 가 여전히 활성 이벤트 목록에 포함돼 있다. 이번 diff 로 `10-graph-rag.md §6`·`6-websocket-protocol.md §4.3`·`8-embedding-pipeline.md §8.2`·`data-flow/6-knowledge-base.md §2.5`·backend/frontend 코드 주석이 전부 "graph 에는 `_error` 없음(#443 제거)"로 정정됐는데, 같은 KB 도메인을 다루는 이 네비게이션 spec 만 stale 상태로 남았다. 이 파일은 이번 diff 의 변경 대상에 포함되지 않았다. 참고로 이 정확한 stale 은 `review/consistency/2026/06/12/00_16_44/naming_collision.md`(W-7)에서 이미 한 달 전 지적됐던 항목으로, 그 후 이 diff 가 관련 4개 문서를 손댔음에도 여전히 미해결로 남아있다.
  - 제안: 144행 인접 서술과 동일하게 `_error` 를 목록에서 제거하고, 필요하면 `10-graph-rag.md §6`/`data-flow/6-knowledge-base.md §2.5` 를 cross-reference 로 남긴다.

- **[CRITICAL]** `spec/5-system/8-embedding-pipeline.md:411` — 같은 파일 내부에서 union count 자기모순 ("12개" vs 이번 diff 로 정정된 "11개(5+6)")
  - 위치: `spec/5-system/8-embedding-pipeline.md:411` (`## Rationale` → `### 결정: spec 정합성 정비`)
  - 상세: `WebSocket 채널 명명을 KB 단위(`embedding:{knowledgeBaseId}`) 에서 **문서 단위**(`kb:${documentId}`) 로 전환. backend `KbEventType` union (12개 이벤트) 과 `emitKbEvent` 구현이 권위이며...` — 이번 diff 가 바로 위 §8.1/§8.2(278-296행)를 "11개 = embedding 6 + graph 5(graph 는 5개, `_error` 없음)"로 정정했는데, 같은 문서의 Rationale 섹션은 여전히 "12개 이벤트"라고 서술한다. `data-flow/6-knowledge-base.md` 는 동일한 과거-오기(`KbEventType 12개 + document:graph_error`)를 §Rationale 말미의 "폐기·정정된 과거 서술 (이력)" 목록에 취소선으로 명시적으로 처리했지만, 이 파일은 그런 처리 없이 본문에 살아있는 서술로 남아 한 문서 안에서 8.1/8.2 와 Rationale 이 서로 다른 숫자를 주장하는 상태다.
  - 제안: "12개 이벤트"를 "11개(embedding 6 + graph 5, `document:graph_error` 는 #443 에서 제거)"로 정정하거나, `data-flow/6-knowledge-base.md` 의 "폐기·정정된 과거 서술" 패턴처럼 역사적 서술임을 명시(취소선 + 현재값 각주)한다.

- **[WARNING]** CHANGELOG.md 미갱신
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536/CHANGELOG.md`
  - 상세: 이 저장소는 최근 커밋들(#877, #878, #874, #501 등)마다 예외 없이 `## Unreleased — ...` 섹션을 추가해 동작 변화(특히 frontend 구독/캐시 갱신에 영향을 주는 버그 수정)를 기록하는 컨벤션을 따르고 있다. 이번 변경은 frontend 가 존재하지 않는 이벤트(`document:graph_error`)를 구독하던 dead subscription 을 제거하는 실질적 동작 변경이며, 회귀 방지 테스트까지 추가했음에도 CHANGELOG 항목이 없다.
  - 제안: 다른 "Unreleased" 항목과 동일한 형식으로 이번 fix(원인·정정 내용·SoT)를 CHANGELOG.md 에 추가한다. (단, dead subscription 제거라 사용자가 체감하는 동작 변화는 없었을 가능성이 높아 — 두 상태 다 캐시 invalidate 만 트리거하므로 — 우선순위는 CRITICAL 이 아닌 WARNING으로 판단)

- **[INFO]** `spec/5-system/8-embedding-pipeline.md:413` — 인접 문단도 stale (dead code 를 현재형으로 서술)
  - 위치: `spec/5-system/8-embedding-pipeline.md:413`
  - 상세: `kb:graph_stats_updated` 이벤트는 spec 에 포함하지 않는다. `kb-stats.helper.ts` 가 `emitExecutionEvent` 로 호출해 채널이 `execution:kb:…` 로 prefix 되어 frontend 의 `kb:` 구독에 도달하지 못하는 dead path **이며**...` — 코드(`codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:14-16`)와 `data-flow/6-knowledge-base.md §2.5`(297-301행, "dead-path 코드 제거 완료")는 이미 이 broadcast 코드가 **과거형으로 제거됐다**고 명시하는데, 이 문단만 현재형("dead path 이며")으로 남아 아직 코드가 존재하는 것처럼 읽힌다. 바로 위 줄(411행)을 고치는 김에 같은 단락이라 함께 손볼 가치가 있다.
  - 제안: `data-flow/6-knowledge-base.md §2.5` 의 note 와 동일하게 "코드 제거 완료" 과거형으로 정정.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md:276` — 권위 정의 서술 방식이 이번 diff 가 정정한 문장들과 미묘하게 어긋남 (오류는 아님)
  - 위치: `spec/5-system/8-embedding-pipeline.md:276` (§8 도입부, diff 범위 밖)
  - 상세: `backend 권위 정의는 `WebsocketService.emitKbEvent` (KbEventType union).` 로 특정 메서드명(`emitKbEvent`)까지 명시하는 반면, 이번 diff 가 고친 `6-websocket-protocol.md:722`·`data-flow/6-knowledge-base.md:288` 는 메서드명을 빼고 "`WebsocketService` 의 `KbEventType` union" 으로만 서술한다. `emitKbEvent` 메서드는 실제로 `websocket.service.ts:509` 에 존재하므로 이 줄 자체는 틀리지 않았지만, 같은 개념을 가리키는 여러 spec 문서의 표현이 이번 정정 이후 미묘하게 갈라졌다. 문서화 정합성 관점에서는 사소하나, 다음에 이 문서를 만지는 사람이 표현 통일 여부를 고민하지 않도록 낮은 우선순위로 남긴다.
  - 제안: (선택) `WebsocketService.emitKbEvent` 로 통일하거나 `WebsocketService` 로 통일 — 어느 쪽이든 무방하나 4개 spec 파일 표현을 맞추면 좋음.

## 요약

diff 가 직접 건드린 4개 파일(backend union JSDoc, frontend JSDoc 2곳 + `KB_EVENT_NAMES` 상수,
그리고 6-websocket-protocol/10-graph-rag/8-embedding-pipeline 의 해당 절)은 서로 완전히 일관되고,
실제 코드 동작(`embedding.service.ts` 의 `_retry` 경로, `graph-extraction.service.ts` 의 5개
emit 지점, 컴파일된 `dist/*.d.ts` 의 11-멤버 union)과도 정확히 일치하며, `#443`·`data-flow §2.5`
cross-reference 는 실제로 검증 가능한 내용을 가리키고 회귀 테스트까지 갖춰 이 작업 자체의
문서화 품질은 높다. 다만 이번 fix 의 존재 이유가 "count drift 문서 불일치 제거"였음에도, 정확히
같은 성격의 stale 서술이 diff 범위 밖에 두 곳 남아 있다 — `spec/2-navigation/5-knowledge-base.md:182`
(graph `_error` 가 여전히 활성 이벤트로 나열, 한 달 전 consistency-check 에서 이미 지적된 항목)와
`spec/5-system/8-embedding-pipeline.md:411`(같은 파일의 Rationale 섹션이 "12개"를 그대로 주장해
바로 위 §8.1/§8.2 와 자기모순). 이 두 곳을 놓치면 "KB WS 이벤트는 11종"이라는 이번 정정의
효과가 반쪽짜리로 남는다. CHANGELOG 미갱신은 저장소 컨벤션 대비 경미한 누락이다.

## 위험도

MEDIUM
