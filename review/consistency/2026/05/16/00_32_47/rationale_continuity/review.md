# Rationale 연속성 검토 결과

검토 대상: `backend/src/modules/knowledge-base/graph`
검토 모드: --impl-prep (구현 착수 전)
검토 시점: 2026-05-16

---

## 발견사항

- **[WARNING]** `kb-stats.helper.ts` 의 `emitExecutionEvent` 오용 — spec 에서 dead path 로 명시 폐기된 패턴이 코드에 그대로 잔존

  - target 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L42–49
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md § Rationale "KB 채널 단위 전환"` (2026-05-16) — `kb:graph_stats_updated` 이벤트 및 `emitExecutionEvent` 를 통한 KB 단위 통계 broadcast 시도를 **dead path** 로 규정하고 spec 에서 일괄 제거. 후속 처리를 `plan/in-progress/kb-graph-stats-dead-path.md` 에 위임.
  - 상세: spec 의 Rationale 는 `kb-stats.helper.ts:42-46` 가 `emitExecutionEvent` 에 `kb:${knowledgeBaseId}` 를 첫 인자로 넘겨 실제 채널이 `execution:kb:${knowledgeBaseId}` 로 prefix 되고, frontend `useKbEvents` 의 `kb:${documentId}` 구독에 도달하지 못한다는 사실을 명시 기록하며 이 경로를 폐기했다. 구현 대상 디렉토리인 `backend/src/modules/knowledge-base/graph` 안에 해당 dead-path 코드가 현재 그대로 존재한다. 구현 착수 시 이 코드를 다루지 않으면 spec 이 폐기된 경로를 코드가 계속 보유하는 상태가 유지된다.
  - 제안: 구현 착수 전에 `plan/in-progress/kb-graph-stats-dead-path.md` 의 옵션 A/B 결정을 먼저 완료해야 한다. 옵션 B(코드 제거) 선택 시 `kb-stats.helper.ts` L41–49 의 `try { this.websocketService.emitExecutionEvent(…) } catch {}` 블록을 제거하고, `WebsocketService` import 도 해당 파일에서 불필요해진다면 함께 정리. 옵션 A(emit 경로 수정) 선택 시 spec Rationale 의 dead-path 폐기 기술과 충돌하므로 `spec/5-system/6-websocket-protocol.md § Rationale` 를 project-planner 가 갱신(dead-path 기술 제거 및 새 경로 명시)해야 하며, 해당 갱신이 본 구현보다 선행되어야 한다.

---

- **[INFO]** `kb-stats.helper.ts` 에서 `WebsocketService` 의존성 보유 — dead path 제거 시 의존성 그래프 정리 필요

  - target 위치: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` L3, L21–22
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md § Rationale` — dead-path broadcast 코드 폐기 결정.
  - 상세: 옵션 B(코드 제거) 선택 시 `KbStatsHelper` 는 `WebsocketService` 에 대한 의존성 자체가 필요 없어진다 (`refresh` 메서드의 유일한 역할이 DB UPDATE + best-effort emit 인데 emit 블록 제거 후에는 DB UPDATE 만 남음). constructor 인자와 import 가 남아있으면 DI 그래프에 불필요한 결합이 유지된다.
  - 제안: 옵션 B 처리 시 constructor 의 `private readonly websocketService: WebsocketService` 제거 + import 라인 제거 + `knowledge-base.module.ts` 혹은 관련 module 의 provider 목록에서 해당 의존성이 여전히 필요한지 확인.

---

- **[INFO]** graph 비-목표 항목 (Apache AGE / Neo4j, community detection) — spec Rationale 에 명시된 비-목표가 구현 범위로 확대되지 않는지 점검

  - target 위치: `backend/src/modules/knowledge-base/graph` 디렉토리 전체
  - 과거 결정 출처: `spec/5-system/10-graph-rag.md § Rationale "비-목표 (이번 PRD 범위 밖)"` — Microsoft GraphRAG community detection / 글로벌 요약 (P2 이후), Apache AGE / Neo4j 도입 (데이터 규모 임계 도달 시 검토), 룰 기반 entity 추출 (LLM 추출 단일 경로) 을 명시적 비-목표로 선언.
  - 상세: 현재 코드(`graph-extraction.service.ts`, `graph-query.service.ts`)는 LLM 추출 단일 경로, PostgreSQL 기반 순수 SQL 구현을 유지하고 있어 비-목표와 충돌하지 않는다. 이번 구현 착수(dead path 처리)도 이 범위를 벗어나지 않는 것으로 보인다. 비-목표 위반 없음을 확인 차원에서 기록.
  - 제안: 별도 조치 불필요. 추후 P2 기능(community detection, graph DB 전환 등) 착수 시 spec Rationale 를 갱신하고 비-목표에서 제거하는 절차를 거쳐야 함을 상기.

---

## 요약

`backend/src/modules/knowledge-base/graph` 디렉토리는 전반적으로 `spec/5-system/10-graph-rag.md` 의 합의 원칙(LLM 단일 추출 경로, ragMode 불변 guard, PostgreSQL 기반 구현)을 준수하고 있다. 단, `kb-stats.helper.ts` 에 남아있는 `emitExecutionEvent` 호출은 `spec/5-system/6-websocket-protocol.md` Rationale 가 **dead path** 로 명시 폐기한 패턴 그대로다. spec 은 이 코드 결함의 처리를 `plan/in-progress/kb-graph-stats-dead-path.md` 에 위임했으므로, 구현 착수 전에 해당 plan 의 옵션 결정(제거 또는 경로 수정)이 선행되어야 Rationale 연속성이 유지된다. 옵션 A(경로 수정) 선택 시에는 spec Rationale 갱신이 선행 필수이며, 이는 developer 가 아닌 project-planner 의 권한 범위다.

## 위험도

MEDIUM
