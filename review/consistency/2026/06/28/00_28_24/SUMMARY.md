# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 모든 Critical/Warning 부재. Cross-Spec에서 다이어그램 완전성 관련 INFO 3건, Plan Coherence에서 추적 목적 WARNING 1건(target 비직접 영향).

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `spec-sync-structural-followups §B` console.warn 잔여 3건 미완료 — data-flow 폴더 내 다른 문서 대상이며 target 자체에는 영향 없음 | `spec/data-flow/0-overview.md` (간접; data-flow 폴더 진입 문서) | `plan/in-progress/spec-sync-structural-followups.md §B` (lines 63-66) — `1-ai-agent.md §6.2.c.fallback`, `0-common.md §6`, `14-external-interaction-api.md §1108` 미완료 | target에 직접 조치 불필요. plan 원본에서 추적 계속 관리. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | Mermaid 다이어그램에서 `executionEvents$` 세 번째 subscriber(`NotificationFanout`) 누락 — 텍스트 §1.2 및 EIA §R10 "세 형제 listener"와 불일치 | `spec/data-flow/0-overview.md` §1.1 Mermaid flowchart | 다이어그램에 `NFAN[NotificationFanout]` 노드 추가 + `WS -.->|executionEvents$ fan-out| NFAN` 엣지 추가 |
| 2 | Cross-Spec | §1.2 WebSocket 행에서 "NotificationDispatcher 가 구독"으로 기술 — EIA §R10은 실제 listener 가 `NotificationFanout`이고 `NotificationDispatcher`는 BullMQ enqueue-only facade임을 구분 | `spec/data-flow/0-overview.md` §1.2 WebSocket 행 | §1.2를 "… `SseAdapter`·`ChatChannelDispatcher`·`NotificationFanout`(→`NotificationDispatcher` 위임) 가 구독" 으로 정정 |
| 3 | Cross-Spec | §1.2 Object Storage와 Rationale 내 S3 key 약식/전체식 표기 혼용(`kb/{kbId}/{docId}/{filename}` vs `kb/{kbId}/{documentId}/{sanitizedFilename}`) | `spec/data-flow/0-overview.md` §1.2 Object Storage 행 및 Rationale | §1.2를 `spec/0-overview.md §2.7` 전체식 `kb/{kbId}/{documentId}/{sanitizedFilename}`으로 통일 |
| 4 | Rationale Continuity | §5 Continuation bus — 폐기된 Redis pub/sub·`pendingContinuations` fast-path 기술이 실행 엔진 Rationale과 정합 확인 | `spec/data-flow/0-overview.md` §5 | 현행 유지. 선택적으로 `spec/5-system/4-execution-engine.md §7.4/§7.5` ref 링크 추가 가능 |
| 5 | Rationale Continuity | §3.3 "migration 이 진실" 원칙이 Flyway 채택 Rationale과 일관됨 확인 | `spec/data-flow/0-overview.md` §3.3 | 현행 유지 |
| 6 | Rationale Continuity | §4 BullMQ 큐 카탈로그에 per-node task queue 부재 — 기각된 대안 미재도입 확인 | `spec/data-flow/0-overview.md` §4 | 현행 유지 |
| 7 | Rationale Continuity | §Rationale "KB 원본 문서 S3 key 구조"에서 workspaceId prefix 제외 이유가 `spec/0-overview.md §2.7` Rationale과 정합 확인 | `spec/data-flow/0-overview.md` §Rationale | 현행 유지 |
| 8 | Convention Compliance | 파일 명명(`0-overview.md`), frontmatter 면제(이중 면제), 3섹션 구조, 도메인 인덱스 15개 링크 완전성, 내부 링크 타깃 유효성 — 모두 규약 준수 확인 | `spec/data-flow/0-overview.md` 전체 | 현행 유지 |
| 9 | Plan Coherence | `exec-park-durable-resume` Phase B3 완료 서술이 target §5와 정합 확인 | `spec/data-flow/0-overview.md` §5 | 조치 불필요 |
| 10 | Plan Coherence | `exec-intake-queue-impl` PR2b(동시성 cap) 미구현 항목이 target에 노출되지 않음 — 의도적 생략 확인 | `spec/data-flow/0-overview.md` §5 | 조치 불필요 |
| 11 | Naming Collision | 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로 전 관점에서 신규 식별자 충돌 없음 확인 | `spec/data-flow/0-overview.md` 전체 | 현행 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Mermaid 다이어그램 `executionEvents$` 세 번째 subscriber 누락(INFO), NotificationDispatcher/NotificationFanout 명칭 혼용(INFO), S3 key 표기 불일치(INFO) |
| Rationale Continuity | NONE | 4개 과거 결정 모두 정합 확인. 현행 유지 권고 |
| Convention Compliance | NONE | 파일 명명·frontmatter 면제·3섹션 구조·인덱스 링크·내부 링크 전면 준수 |
| Plan Coherence | NONE | 진행 중 plan과 전반 정합. console.warn 잔여 3건은 다른 문서 대상(WARNING, target 비직접) |
| Naming Collision | NONE | 신규 식별자 미도입 문서. 6개 관점 전원 충돌 없음 |

## 권장 조치사항

1. (선택적 개선, 비차단) Cross-Spec INFO #1: `spec/data-flow/0-overview.md` §1.1 Mermaid 다이어그램에 `NotificationFanout` 노드와 `executionEvents$` fan-out 엣지 추가 — §1.2 텍스트 및 EIA §R10과 일치시키기 위해.
2. (선택적 개선, 비차단) Cross-Spec INFO #2: §1.2 WebSocket 행을 "… `NotificationFanout`(→`NotificationDispatcher` 위임) 가 구독"으로 정정 — EIA §R10 명칭 구분 반영.
3. (선택적 개선, 비차단) Cross-Spec INFO #3: §1.2 Object Storage S3 key 표기를 전체식 `kb/{kbId}/{documentId}/{sanitizedFilename}`으로 통일.
4. (추적 유지) Plan Coherence WARNING: `spec-sync-structural-followups §B` console.warn 잔여 3건(`1-ai-agent.md`, `0-common.md`, `14-external-interaction-api.md`)은 plan 원본에서 계속 관리. target `0-overview.md`에 별도 조치 불필요.
