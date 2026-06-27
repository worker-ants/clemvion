# Rationale 연속성 검토 결과

검토 대상: `spec/data-flow/0-overview.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-06-28

---

## 발견사항

### INFO — §5 Continuation bus 인용 정확성

- target 위치: `spec/data-flow/0-overview.md` §5 "Continuation bus" 단락
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Durable Continuation & Graceful Shutdown", §Rationale "park 즉시 해제 + slow-path 일원화"
- 상세: target 이 "옛 Redis pub/sub `execution:continuation` 채널은 폐기", "옛 `pendingContinuations` fast-path 는 제거됐다", "재개는 §7.5 rehydration **단일 경로**" 세 가지를 모두 올바르게 인용하고 있다. 실행 엔진 Rationale "Durable Continuation" 의 at-most-once 문제 해소 결정 및 full B3(Phase B 완료 — pendingContinuations/firstSegmentBarriers 완전 제거) 결정과 정합한다.
- 제안: 현행 유지. 개선 가능성이 있다면 `spec/5-system/4-execution-engine.md §7.4 / §7.5` 링크를 ref 로 추가해 두 번 설명하지 않도록 하는 정도다 (이미 "(... `spec/5-system/4-execution-engine.md §7.4 / §7.5 / §Rationale "Durable Continuation"`)") 로 적절히 달려 있어 문제 없음).

### INFO — §3.3 "migration 이 진실" 원칙 명문화 확인

- target 위치: `spec/data-flow/0-overview.md` §3.3 Schema 매핑 표 마지막 문장
- 과거 결정 출처: `spec/0-overview.md` Rationale "DB 마이그레이션 도구로 Flyway 채택 (§2.8)" — Flyway SQL 이 운영 DB 에 적용되는 SQL 을 PR 에서 리뷰 가능하고, entity 와 migration SQL 이 이중으로 존재하는 것은 받아들인 비용으로 명시했다.
- 상세: target 의 "두 소스가 충돌하면 **migration 이 진실**" 원칙은 Flyway 채택 Rationale 와 일관된다 — entity TypeScript 가 아닌 SQL migration 이 실제 DB schema 의 단일 진실이라는 확립된 결정을 정확히 반영한다.
- 제안: 현행 유지.

### INFO — §4 BullMQ 큐 카탈로그에 per-node task queue 부재

- target 위치: `spec/data-flow/0-overview.md` §4 BullMQ 큐 카탈로그 (17개 큐 목록)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md` Rationale "per-node task queue → execution-level intake 큐 (§4 재정의, 2026-06-04 결정)"
- 상세: 카탈로그에 per-node task queue 가 없다는 것 자체가 기각된 대안(per-node task queue, 1 Worker = 1 NodeExecution)이 재도입되지 않았음을 보여준다. 노드 dispatch 는 `execution-run` / `execution-continuation` / `background-execution` 세 execution-level 큐로만 관리되며, 실행 엔진 Rationale 의 기각 결정을 올바르게 유지한다.
- 제안: 현행 유지.

### INFO — §Rationale "KB 원본 문서 S3 key 구조" 에서 workspaceId prefix 제외 이유 인용

- target 위치: `spec/data-flow/0-overview.md` §Rationale "KB 원본 문서 S3 key 구조"
- 과거 결정 출처: `spec/0-overview.md` Rationale "S3 객체 키 prefix 설계 — KB 원본 키에서 workspaceId 제외 (§2.7)"
- 상세: target 의 Rationale 항목은 `spec/0-overview.md` §2.7 Rationale 에서 명시적으로 채택된 "KB 원본 문서는 `kb/{kbId}/{documentId}/...` 로 두고 workspaceId prefix 미사용" 결정을 정합하게 유지한다. "워크스페이스 격리는 DB 권한 검증으로 보장" 설명도 동일 Rationale 의 trade-off 설명과 일치한다.
- 제안: 현행 유지.

---

## 요약

`spec/data-flow/0-overview.md` 는 관련 spec Rationale 들과 전반적으로 잘 정합한다. 명시적으로 기각된 대안(per-node task queue, Redis pub/sub continuation 채널, workspaceId-prefix KB S3 키, Prisma migrate, undo 스크립트)이 재도입된 사례가 없고, 합의된 설계 원칙(migration 이 진실, BullMQ 영속 큐 단일 재개 경로, execution-level 세그먼트 큐)을 준수하고 있다. 발견된 항목들은 모두 현행 유지를 권고하는 INFO 수준으로, 기존 결정과의 충돌 없이 올바르게 정합하고 있음을 확인하는 내용이다.

---

## 위험도

NONE
