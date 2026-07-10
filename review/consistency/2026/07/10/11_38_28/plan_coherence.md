# Plan 정합성 검토 — kb-ws-event-drift-3f4536

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- diff: `origin/main..HEAD` (base=2aa4c8093, HEAD=31bbd1d3a)
- 변경 요약: KB WebSocket `KbEventType` union 이 이미 #443 에서 `document:graph_error` 를 제거해 11종(embedding 6 + graph 5)인데, frontend `useKbEvents` 구독 목록과 4개 spec 문서(`6-websocket-protocol.md`, `8-embedding-pipeline.md`, `10-graph-rag.md`, `2-navigation/5-knowledge-base.md`) 일부가 여전히 "12개/12종" 또는 죽은 `graph_error` 구독을 남기고 있던 drift 를 정정. 코드 동작(런타임) 변경 없음 — frontend 의 죽은 `graph_error` 리스너 제거(no-op, backend 가 애초에 emit 안 함) + JSDoc/spec 텍스트 정정 + parity 회귀 테스트 추가.

## 조사 방법

1. `git diff origin/main..HEAD --stat` 로 변경 파일 8개 확인 (backend JSDoc, frontend 훅 + 신규 테스트, spec 4종, CHANGELOG).
2. `plan/in-progress/**` 전체에서 `kb|knowledge.base|graph.rag|embedding|websocket` 키워드로 1차 스크리닝 → 관련 후보(`spec-sync-websocket-protocol-gaps.md`, `rag-quality-improvement.md`, `rag-dynamic-cut.md`, `spec-sync-data-flow-8-notifications-gaps.md`) 전문/발췌 확인.
3. `plan/in-progress/**` 전체에서 `graph_error|embedding_error|KbEventType|KB_EVENT_NAMES` 리터럴 grep → **0건**. 즉 어떤 진행 중 plan 도 이 이벤트 집합/카운트를 전제하거나 논의하지 않음.
4. `git log --oneline --all | grep 443` + `grep -rn "#443"` 로 union 에서 `graph_error` 제거가 이미 2026-06-03 PR #443(`spec-code-cross-audit`/`spec-sync-structural-followups` 계열)에서 확정·완료됐고, `spec/data-flow/6-knowledge-base.md §2.5`(diff 밖, 이미 11개로 기술)가 기존에도 권위였음을 확인. 본 변경은 그 기존 결정을 뒤집는 게 아니라 **다른 4개 spec 문서·frontend 구독의 stale 표기를 사후 정정**하는 것.
5. backend `websocket.service.ts` 의 실제 `KbEventType` union 타입 정의(라인 342~352)를 읽어 diff 밖에서도 이미 11개(embedding_error 포함, graph_error 미포함)임을 재확인 — 이번 diff 는 그 위의 JSDoc 주석만 갱신, 타입 자체는 무변경.

## 발견사항

없음 — 등급 부여 대상 발견사항 없음.

### 참고 (등급 없음, 정보용)

- **관련 plan 부재 확인** — `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 는 §4.3 KB 이벤트가 아니라 §1.3/§4.2/§4.5/§5/§7 (in-band 토큰 갱신, execution.start/stop WS 명령, auth.token_expired, server ping, rate-limit) 를 다루며 KB 이벤트 union 카운트와 무관. `rag-quality-improvement.md`·`rag-dynamic-cut.md` 는 검색/청킹/리랭킹 설계(P0~P6)를 다루며 WS 이벤트 이름·개수에 대한 언급이 전혀 없음. `spec-sync-data-flow-8-notifications-gaps.md` 는 `notifications:{userId}` 채널(별개 도메인)만 다룸. 사용자가 미리 언급한 `spec-sync-mcp-client-gaps.md` 는 `spec/5-system/11-mcp-client.md` 전용으로 완전 무관 — 확인대로 충돌 없음.
- **선행 plan 필요 없음** — 이번 변경이 전제하는 "graph `_error` 는 union 에 없다"는 사실은 이미 2026-06-03 PR #443 에서 코드·`spec/data-flow/6-knowledge-base.md §2.5` 양쪽에 확정돼 있던 기존 결정이다. 이번 diff 는 새 결정을 내리는 것이 아니라, 그 결정이 아직 반영되지 않았던 나머지 4개 spec 문서 표기와 frontend 죽은 구독을 사후 동기화하는 순수 drift-정정이다. 따라서 "미해결 결정 우회"에 해당하지 않는다.
- **후속 항목 없음** — 이 변경으로 무효화되거나 새로 만들어야 할 다른 plan 의 후속 항목이 없다. `graph_error`/`embedding_error` 관련 리터럴을 참조하는 진행 중 plan 이 전무하기 때문에 후속 항목 갱신 누락 리스크도 없다.

## 요약

이번 변경은 이미 2026-06-03 PR #443 에서 코드·`spec/data-flow/6-knowledge-base.md`(diff 밖) 양쪽에 확정돼 있던 "graph `_error` union 제거" 결정을, 아직 그 결정이 반영되지 않고 있던 4개 spec 문서(`6-websocket-protocol.md`/`8-embedding-pipeline.md`/`10-graph-rag.md`/`2-navigation/5-knowledge-base.md`)와 frontend `useKbEvents` 구독 목록에 사후 동기화하는 순수 drift-정정이다. `plan/in-progress/**` 전체를 `kb|knowledge-base|graph-rag|embedding|websocket` 키워드 및 이벤트 리터럴(`graph_error`/`embedding_error`/`KbEventType`/`KB_EVENT_NAMES`)로 스크리닝한 결과 이 이벤트 집합·카운트를 전제하거나 논의하는 진행 중 plan은 하나도 없었고, 후보로 지목됐던 `spec-sync-websocket-protocol-gaps.md`(§4.3 외 항목만 다룸)·`rag-quality-improvement.md`/`rag-dynamic-cut.md`(검색 로직만 다룸)·`spec-sync-data-flow-8-notifications-gaps.md`(별개 채널)·`spec-sync-mcp-client-gaps.md`(완전 무관 spec)도 모두 충돌 없음을 확인했다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 세 관점 모두 문제 없음.

## 위험도

NONE
