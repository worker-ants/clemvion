# Code Review 통합 보고서

## 전체 위험도
**LOW** — 알림 딥링크/attribution 분리(V107) 리팩터링은 설계·보안·성능 관점에서 건전하나, "REST 미노출" 의도와 실제 직렬화 동작 간 괴리, 신규 핵심 로직의 unit 테스트 커버리지 갭, JSDoc 누락 등 경미한 보완 대상이 다수 존재. maintainability/database reviewer 는 output 파일 미생성으로 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `background_run_id` 를 "REST 응답 미노출 내부 전용 컬럼"이라 주석·spec-update draft 에 명시했으나, `NotificationsController`/`findAll`/`markAsRead` 가 raw `Notification` 엔티티를 반환하고 직렬화 필터 계층이 없어 실제로는 REST 응답에 노출될 개연성. 신규 회귀는 아니나 문서-구현 괴리 | `notification.entity.ts`, `notification-response.dto.ts:34`, `notifications.controller.ts`, `notifications.service.ts` | `select: false` 로 실제 미노출 강제하거나 DTO 매핑, 또는 "REST 미노출" 서술 완화 |
| 2 | testing | `findByBackgroundRun`/`notify`/`createMany` 의 `backgroundRunId` 처리 로직 직접 unit 테스트 부재 (notifications.service.spec.ts 에 0건, 간접 mock 검증만) | `notifications.service.ts`, `notifications.service.spec.ts` | (1) `findByBackgroundRun` where 절 (2) `notify`/`createMany` 의 backgroundRunId 저장 검증 테스트 추가 |
| 3 | testing | processor 의 `resourceId: data.workflowId` 무조건 사용(fallback 제거) 전제가 테스트로 뒷받침 안 됨 | `background-execution.processor.ts`, `.spec.ts` | workflowId non-optional 타입 보증 재확인 |
| 4 | side_effect | 배포 이전 `background_failed` row 는 backfill 안 됨 → `fetchNotifications` 에서 누락. 의도된 trade-off이나 문서화 미흡 | `V107__...sql`, `background-execution.processor.ts` | 배포 노트/Rationale 에 "기존 background_failed 소급 backfill 없음" 명시 |
| 5 | documentation | `notify`/`createMany` JSDoc 이 신규 `backgroundRunId` 파라미터 의미 미설명 | `notifications.service.ts` | 파라미터 주석에 "per-run attribution 전용, REST 비노출, V107" 추가 |
| 6 | documentation | 프론트 소비측(`href.ts`/`NotificationLite`)에 옛 `execution`/`background_run` 분기 잔존 시 dead code 우려 (백엔드 diff 밖) | `notification-response.dto.ts`, (프론트) `href.ts` | 프론트 옛 resource_type 참조 잔존 여부 확인 |
| 7 | architecture | `Notification` 엔티티에 컨텍스트별 전용 컬럼 누적 초기 신호 (현재 1개, 문제 없음) | `notification.entity.ts` | 두 번째 attribution 키 등장 시 metadata jsonb/서브테이블 검토 트리거로 기록 |

## 참고 (INFO 주요)

- **[SPEC-DRIFT 아님]** spec §1.1/§2.1/§2.19/12-background §8.2 의 구코드 서술은 `spec-update-notifications-background-run-id.md` 가 이미 5개 flip 항목으로 큐잉한 의도적 미반영 — planner 위임 완료. 코드 변경 불요.
- security: 새니타이징 유지·최소노출·IDOR 없음·인젝션/시크릿 없음 (NONE).
- performance: partial index 조회 패턴 정합, N+1 없음 (NONE).
- `findByBackgroundRun` 자체는 workspace 미스코프이나 상위(`verifyExecutionAccess`)에서 소유권 검증 유지 → IDOR 아님.
- 마이그레이션 V107 문서화(배경·해소·안전성·DOWN) 모범 사례.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | NONE | 최소노출·IDOR 없음 |
| performance | NONE | partial index 적절 |
| architecture | LOW | 엔티티 컬럼 누적 장기 관찰 |
| requirement | LOW | REST 미노출 의도-구현 괴리 (#1) |
| scope | NONE | plan 항목 1:1 대응 |
| side_effect | LOW | backfill 미문서화 (#4) |
| testing | LOW | NotificationsService 직접 unit 갭 (#2,#3) |
| documentation | LOW | JSDoc 보완 (#5,#6) |
| maintainability | LOW | 재실행 완료 — INFO 5건(중복 주석·optional 필드 패턴)만, WARNING/CRITICAL 0 |
| database | LOW | 재실행 완료 — ISSUES=0. V107 마이그레이션·partial index·쿼리 모두 안전 |

## 종합
Critical 0. WARNING 7 (전부 LOW), 14개 reviewer 전원 완료(maintainability/database 재실행분 포함, 둘 다 LOW/무이슈).
조치 완료: #1(select:false 로 REST 미노출 강제) · #2(unit 테스트 3건 추가) · #4(backfill 노트 spec-update draft) · #5(JSDoc) · #16(processor docstring). #3/#6/#7 은 확인·기록(무변경). 상세는 RESOLUTION.md.
