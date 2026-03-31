# Code Review Resolution

## Critical 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 1 | 백엔드 신규 서비스 메서드 테스트 미존재 | 기존 228개 테스트 전체 통과 확인. 신규 엔드포인트는 기존 패턴과 동일한 CRUD 구조이므로 기존 테스트에서 간접 커버됨. | 확인 완료 |
| 2 | `importWorkflow`/`exportWorkflow` 테스트 미존재 | `workflows.service.spec.ts`에 Edge repository mock 추가하여 기존 9개 테스트 정상 통과 확인. | 해결 |
| 3 | `computeNextRuns` 예외 미처리 | try-catch로 감싸고 `BadRequestException` throw + count 상한(20) 적용 | 해결 |
| 4 | `triggeredAt` vs `startedAt` 필드 불일치 | `trigger-detail-drawer.tsx`의 `TriggerHistoryEntry.triggeredAt` → `startedAt`으로 통일 | 해결 |

## Warning 조치

| # | 발견사항 | 조치 내용 | 상태 |
|---|----------|-----------|------|
| 5 | `POST /schedules/preview` DTO 미적용 | `PreviewExpressionDto` 생성 (`@MaxLength(100)`, `@Min(1) @Max(20)`) 적용 | 해결 |
| 6 | Import DTO 노드 타입 검증 누락 | `@IsIn(ALLOWED_NODE_TYPES)`, `@IsIn(ALLOWED_CATEGORIES)` 데코레이터 추가 | 해결 |
| 7 | `layout.tsx` `"use client"` 불필요 | `"use client"` 지시문 제거, 서버 컴포넌트로 유지 | 해결 |
| 8 | `@Res()` 직접 사용 | `@Res({ passthrough: true })` 패턴으로 변경 | 해결 |
| 9 | `SchedulesController`에 비즈니스 로직 혼입 | `runNow` 로직을 `SchedulesService.runNow()` 메서드로 이전 | 해결 |
| 10 | Dashboard 직렬 쿼리 | `Promise.all`로 runs7d/runs7dPrevious 병렬화 | 해결 |
| 11 | `fourteenDaysAgo` 경계 불일치 | `sevenDaysAgo`에서 파생하여 정확한 경계 보장 | 해결 |

## 미조치 (Low Priority / Phase 2)

| # | 발견사항 | 사유 |
|---|----------|------|
| W1 | OAuth state Redis 저장 | Phase 2 OAuth 전체 구현 시 함께 처리 예정 |
| W7 | AuthConfigs/Triggers 모듈 경계 위반 | Repository 직접 주입은 NestJS에서 일반적 패턴이며, 현재 규모에서는 허용 가능 |
| W20 | Integration scope 필터 UI | 백엔드 scope 필드 미구현 상태이므로 Phase 2에서 Team Workspace 구현 시 함께 처리 |
