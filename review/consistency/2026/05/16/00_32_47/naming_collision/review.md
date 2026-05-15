# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `backend/src/modules/knowledge-base/graph`

---

## 발견사항

### 신규 식별자 없음 — 충돌 검토 해당 없음

이번 구현 대상은 dead-path 코드 **제거** 작업이다. 새로 도입하는 식별자가 존재하지 않으므로 아래 6개 점검 관점 모두 해당 없음으로 처리한다.

| 점검 관점 | 결과 |
|-----------|------|
| 요구사항 ID 충돌 | 해당 없음 — 신규 ID 없음 |
| 엔티티/타입명 충돌 | 해당 없음 — 신규 타입 없음 |
| API endpoint 충돌 | 해당 없음 — 신규 endpoint 없음 |
| 이벤트/메시지명 충돌 | 해당 없음 — 신규 이벤트 없음 |
| 환경변수·설정키 충돌 | 해당 없음 — 신규 ENV/config key 없음 |
| 파일 경로 충돌 | 해당 없음 — 신규 파일 없음 |

---

### [INFO] 제거 대상 이벤트 식별자 `kb:graph_stats_updated` 의 현 상태 확인

- target 신규 식별자: (없음 — 제거 대상)
- 기존 사용처: `backend/src/modules/knowledge-base/graph/kb-stats.helper.ts:44` — `'kb:graph_stats_updated' as never`
- 상세: 해당 이벤트 이름은 `KbEventType` union (`websocket.service.ts:113-125`) 에 존재하지 않으며, `as never` 강제 캐스트로만 컴파일을 통과하고 있다. `emitExecutionEvent` 경유로 실제 broadcast 채널이 `execution:kb:${knowledgeBaseId}` 가 되어 frontend `useKbEvents` 의 `kb:` 구독에 도달하지 못하는 dead path 상태다. spec 3개 파일(`spec/5-system/6-websocket-protocol.md:642`, `spec/5-system/8-embedding-pipeline.md:355`, `spec/data-flow/knowledge-base.md:202`)에서 이미 폐기 처리되었고, `plan/in-progress/kb-graph-stats-dead-path.md` 가 코드 측 처리를 dev 에 위임하고 있다.
- 제안: 이 식별자를 **제거**하는 것이 이번 작업의 목적이며, 충돌 위험은 없다. `KbStatsHelper` 클래스 자체는 `GraphExtractionService` 와 `GraphQueryService` 가 의존하므로 클래스 제거가 아닌 `try { emitExecutionEvent(…) } catch {}` 블록(lines 41-49)만 삭제하는 방향이 안전하다.

---

## 요약

`backend/src/modules/knowledge-base/graph` 영역에 대한 이번 구현 착수는 dead-path 코드 제거가 목적이며 새로 도입되는 식별자(요구사항 ID, 엔티티명, API endpoint, 이벤트명, ENV 변수, 파일 경로)가 전혀 없다. 신규 식별자 충돌 관점에서 검토할 대상이 없으므로 이슈 없음으로 판정한다. 다만 제거 대상인 `kb:graph_stats_updated` 이벤트 broadcast 블록이 `KbEventType` union 에도 미존재·`as never` 캐스트 상태임을 확인하였으며, spec 상 폐기 처리가 이미 완료된 상태로 코드 제거 진행에 충돌 위험이 없다.

## 위험도

NONE
