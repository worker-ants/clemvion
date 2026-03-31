파일 쓰기 권한이 필요합니다. 허용해 주시면 `review/2026-03-31_15-34-35/SUMMARY.md`에 저장하겠습니다.

그 전에 통합 보고서 내용을 먼저 공유드립니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 백엔드 신규 서비스 메서드 전체 테스트 미존재, 런타임 데이터 불일치(`triggeredAt`/`startedAt`), OAuth CSRF 보호 무효 등 즉각 조치가 필요한 이슈 다수 발견

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 백엔드 신규 서비스 메서드 전체 테스트 미존재 | `auth-configs.service.ts:getUsage`, `integrations.service.ts:reauthorize`, `schedules.service.ts:getPreview/computeNextRuns`, `statistics.service.ts:getNodeStats/exportData`, `triggers.service.ts:getHistory` | 각 서비스에 `.spec.ts` 파일 추가 또는 기존 spec 파일에 테스트 케이스 추가 |
| 2 | Testing | `importWorkflow` / `exportWorkflow` 테스트 미존재 | `workflows.service.spec.ts`, `workflows.service.ts` | 트랜잭션 롤백, 노드 인덱스 매핑, 컨테이너 참조 해결 등 핵심 케이스 커버 |
| 3 | Testing / Requirement | `computeNextRuns` 예외 미처리 — 잘못된 cron 표현식 시 HTTP 500 노출 | `schedules.service.ts:148-162`, `schedules.controller.ts:previewExpression` | `try-catch`로 감싸고 `BadRequestException`으로 변환 + 테스트 추가 |
| 4 | Scope / Requirement | 프론트엔드-백엔드 필드명 불일치 (`triggeredAt` vs `startedAt`) — 트리거 히스토리 날짜 항상 `undefined` 렌더링 | `trigger-detail-drawer.tsx:TriggerHistoryEntry` vs `triggers.service.ts:getHistory` | `TriggerHistoryEntry.triggeredAt` → `startedAt`으로 통일, 또는 백엔드 응답 alias 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Concurrency | OAuth `state` 토큰 서버 미저장 — CSRF 방어 무효화 | `integrations.service.ts:reauthorize()` | Redis에 TTL 함께 state 저장 후 OAuth 콜백에서 검증 및 삭제 |
| 2 | Security | `window.open(authUrl)` 전 URL 미검증 — Open Redirect 위험 | `integrations/page.tsx:reauthorizeMutation.onSuccess` | 허용 도메인(`slack.com`, `accounts.google.com`, `github.com`) 화이트리스트 검증 후 호출 |
| 3 | Security | 환경변수 미설정 시 빈 문자열로 OAuth URL 생성 — 설정 누락 감지 불가 | `integrations.service.ts:128` | 환경변수 미설정 시 `BadRequestException` 명시적 throw |
| 4 | Security | Import 노드 `type`/`category` 화이트리스트 검증 누락 | `import-workflow.dto.ts`, `workflows.service.ts:importWorkflow()` | `@IsIn(ALLOWED_NODE_TYPES)` 또는 `@IsEnum(NodeType)` 데코레이터 추가 |
| 5 | Security | 통계 export 파일명에 사용자 입력(`period`) 직접 삽입 — Path Traversal 잠재 위험 | `statistics.service.ts:238`, `statistics.controller.ts` | `@IsIn(['7d', '30d', '90d'])` 허용값 제한 또는 파일명 새니타이징 |
| 6 | Security | Cron Expression 사용자 입력 직접 파싱 + `count` 상한선 없음 — ReDoS / 서버 부하 | `schedules.service.ts:getPreviewFromExpression()`, `schedules.controller.ts:POST /schedules/preview` | `PreviewExpressionDto`: `@IsString() @MaxLength(100)`, `@IsInt() @Min(1) @Max(20) count` |
| 7 | Architecture | `AuthConfigsService`가 타 모듈 Repository 직접 주입 — 모듈 경계 위반 | `auth-configs.service.ts`, `auth-configs.module.ts` | `TriggersModule`, `ExecutionsModule` import 후 서비스를 통해 접근 |
| 8 | Architecture | `TriggersService`가 `Execution` Repository 직접 주입 — 모듈 경계 위반 | `triggers.service.ts`, `triggers.module.ts` | `ExecutionsModule` import 후 `ExecutionsService`를 통해 히스토리 조회 |
| 9 | Architecture / Maintainability | `SchedulesController`에 비즈니스 로직 혼입 (`runNow`) | `schedules.controller.ts:82-96` | `SchedulesService.runNow(id, workspaceId, userId)` 메서드로 로직 이전 |
| 10 | Architecture / Side Effect | `statistics.controller.ts`의 `@Res()` 직접 사용 — NestJS 인터셉터/예외 필터 비활성화 | `statistics.controller.ts:exportData()` | `@Res({ passthrough: true })` 또는 `StreamableFile` 반환 패턴 |
| 11 | Architecture / Side Effect | `layout.tsx` `"use client"` 추가 — 하위 트리 전체 클라이언트 번들 포함 | `frontend/src/app/(main)/layout.tsx:1` | `layout.tsx` 서버 컴포넌트 유지 (Sidebar가 이미 `"use client"`) |
| 12 | Performance / Database | `importWorkflow` 트랜잭션 내 노드/엣지 개별 save — N×2 DB 왕복 | `workflows.service.ts:importWorkflow()` | `manager.save(Node, nodes배열)` 벌크 저장 후 `containerId` 일괄 업데이트 |
| 13 | Performance / Database | `getUsage` 직렬 쿼리 실행 (병렬화 가능) | `auth-configs.service.ts:getUsage()` | `Promise.all([countQuery, listQuery])` 병렬 실행 |
| 14 | Performance / Database | `dashboard.service.ts` 7일/14일 카운트 쿼리 직렬 실행 | `dashboard.service.ts:runs7dPrevious` | `Promise.all` 병렬화 또는 `CASE WHEN` 단일 쿼리로 통합 |
| 15 | Performance | `exportData` — CSV 포맷 요청 시 불필요한 전체 쿼리 실행 | `statistics.service.ts:exportData()` | format에 따라 필요한 쿼리만 선택적 실행 |
| 16 | Database | `getHistory` QueryBuilder에서 스네이크케이스 컬럼명 직접 사용 (`e.started_at`, `e.duration_ms`) | `triggers.service.ts:getHistory()` | `e.startedAt`, `e.durationMs` (TypeORM 엔티티 프로퍼티명)으로 변경 |
| 17 | Maintainability | OAuth 설정 하드코딩 — 서비스 추가 시마다 코드 수정 필요 | `integrations.service.ts:oauthConfigs` | 별도 설정 파일(`oauth-providers.config.ts`) 또는 전략 패턴으로 분리 |
| 18 | Maintainability | `importWorkflow` 단일 메서드 과도한 복잡도 | `workflows.service.ts:importWorkflow()` | private 메서드(`createNodesFromImport`, `resolveContainerReferences`, `createEdgesFromImport`)로 분리 |
| 19 | Requirement | `getWorkflowIdForSchedule` — `schedule.trigger` relation 미로드 시 항상 `null` 반환 | `schedules.service.ts:getWorkflowIdForSchedule()` | `findById`에서 `relations: ['trigger']` 포함 여부 확인 |
| 20 | Scope | 백엔드 미구현 `scope` 필터 UI 추가 — 필터가 항상 `"all"`로 동작 | `integrations/page.tsx:scopeFilter` | 백엔드 scope 필드 추가 전까지 UI 제거 |
| 21 | Testing | 신규 프론트엔드 컴포넌트 테스트 미존재 | `slide-drawer.tsx`, `run-results-drawer.tsx`, `trigger-detail-drawer.tsx` | 최소한 `SlideDrawer` Escape 키 처리, body overflow 제어 테스트 추가 |
| 22 | Testing / Concurrency | `SlideDrawer` 복수 인스턴스 시 `document.body.style.overflow` 경쟁 조건 | `slide-drawer.tsx:21-29` | 전역 카운터로 마지막 Drawer가 닫힐 때만 `overflow` 복원 |
| 23 | API Contract | `GET /triggers/:id/history`, `GET /auth-configs/:id/usage` 페이지네이션 미적용 — 클라이언트 `limit` 무시 | `triggers.controller.ts`, `auth-configs.controller.ts` | `@Query('limit')` 수신 후 서비스에 전달 |
| 24 | API Contract | `POST /schedules/preview` DTO 없이 raw body — class-validator 검증 미적용 | `schedules.controller.ts:52-61` | `PreviewExpressionDto` 생성 및 적용 |
| 25 | API Contract | `integrations/:id/reauthorize` 응답 형식 불일관 (non-OAuth 시 빈 문자열 반환) | `integrations.service.ts:119-143` | 응답 타입 명시적 구분: `{ type: 'oauth', ... }` \| `{ type: 'reset', ... }` |
| 26 | Database | `getNodeStats` 집계 쿼리 인덱스 누락 가능성 | `statistics.service.ts:getNodeStats()` | `node_executions.execution_id`, `node_executions.node_id` 인덱스 확인 및 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `run-now` Rate Limiting 미적용 | `schedules.controller.ts` | `@Throttle()` 또는 Redis rate limiter 적용 |
| 2 | Security | 워크플로우 export에 민감 settings 포함 가능성 | `workflows.service.ts:exportWorkflow()` | 민감 키 마스킹 또는 import 시 재설정 유도 |
| 3 | Database | `auth-configs.service.ts`에서 `e.trigger_id` 스네이크케이스 직접 사용 | `auth-configs.service.ts:131,140` | `e.triggerId` 또는 `e.trigger.id` 사용 |
| 4 | Performance | `computeNextRuns` `count` 대용량 입력 시 CPU 블로킹 | `schedules.service.ts:computeNextRuns()` | `Math.min(count, 20)` 상한값 적용 |
| 5 | Maintainability | PostgreSQL 전용 문법 (`::int`, `FILTER (WHERE ...)`) — DB 결합도 증가 | `statistics.service.ts:getNodeStats()` | "PostgreSQL-specific" 인라인 주석 및 README 명시 |
| 6 | Maintainability | `formatLabel` `if-else` 체인 확장성 취약 | `custom-edge.tsx:formatLabel()` | `PREFIX_LABELS` Record 객체로 선언형 처리 |
| 7 | Maintainability | `?? new Date().toISOString()` fallback — dead code | `schedules.service.ts:computeNextRuns()` | fallback 제거 |
| 8 | Requirement | `runs7dChangePercent` null 시 명시적 메시지 미표시 | `dashboard/page.tsx` | null인 경우 "N/A" 메시지 표시 고려 |
| 9 | Requirement | `RunResultsDrawer` 새 실행 시작 시 `activeTab` 미초기화 | `run-results-drawer.tsx:88,161` | `startExecution` 시 `activeTab = 0` 리셋 |
| 10 | Scope | `cron-parser` v5 `interval.next().toISOString()` 호출 가능 여부 불명확 | `schedules.service.ts:L140` | v5 API 확인 후 필요 시 `.toDate().toISOString()`으로 변경 |
| 11 | Scope | `triggers/page.tsx` `active` 파라미터 백엔드 처리 여부 불명확 | `triggers/page.tsx` | `TriggersController.findAll()` 쿼리 파라미터 수신 확인 |
| 12 | Documentation | 신규 OAuth 환경변수 `.env.example` 및 README 미갱신 | `integrations.service.ts`, 프로젝트 루트 | `.env.example`에 `SLACK_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `APP_URL` 추가 |
| 13 | Documentation | `timezone` 기본값 `'Asia/Seoul'` 이유 설명 없음 | `schedules.service.ts:138` | 인라인 주석 추가 또는 환경변수 분리 |
| 14 | Documentation | `import-workflow.dto.ts` JSDoc 미존재 | `import-workflow.dto.ts` | 주요 필드에 JSDoc 추가 |
| 15 | Documentation | 프론트엔드 테스트 스크립트 추가 후 README 미갱신 | `frontend/package.json`, `README.md` | `cd frontend && npm run test` 명령 README 추가 |
| 16 | Dependency | `bullmq` 내부 `cron-parser` v4.9.0 + 최상위 v5.5.0 중복 설치 | `backend/package-lock.json` | 향후 `bullmq` 업그레이드 시 해소. 현재 동작 이상 없음 |
| 17 | Dependency | 프론트엔드 `cron-parser` 직접 사용 — 백엔드 API와 중복 | `frontend/package.json` | 백엔드 API를 통해 처리하여 번들 크기 절감 검토 |
| 18 | Dependency | `@colordx/core` 낮은 지명도 패키지 — 무결성 확인 권고 | `backend/package-lock.json` | `npm audit` 실행 (`cssnano` 전이 의존성이므로 직접 통제 밖) |
| 19 | Side Effect | `fourteenDaysAgo`/`sevenDaysAgo` 별도 생성으로 경계 미세 불일치 | `dashboard.service.ts:56-58` | `sevenDaysAgo` 먼저 생성 후 7일 빼서 파생 |
| 20 | Side Effect | `handleExport` DOM 직접 조작 | `workflows/page.tsx:handleExport()` | 유틸 함수로 분리 권장 |
| 21 | API Contract | `format` 파라미터 이중 바인딩 | `statistics.controller.ts:47-68` | `QueryStatisticsDto`에 `format` 선택적 필드 추가 |
| 22 | Database | `importWorkflow` 엣지도 개별 루프 저장 | `workflows.service.ts` edge 생성 | `manager.save(Edge, edgesArray)` 배열 일괄 저장 |
| 23 | Testing | `vitest.config.ts` / jsdom 환경 설정 파일 존재 여부 미확인 | `frontend/` 루트 | setup 파일 및 `environment: 'jsdom'` 설정 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | **HIGH** | 백엔드 신규 서비스 메서드 전체 테스트 미존재, `computeNextRuns` 예외 미처리 |
| security | **MEDIUM** | OAuth CSRF state 미검증, `window.open` URL 미검증, 환경변수 누락 시 빈 문자열 |
| scope | **MEDIUM** | `triggeredAt`/`startedAt` 필드 불일치 (CRITICAL), 미구현 scope 필터 UI |
| requirement | **MEDIUM** | getHistory 필드 불일치, CSRF state 미검증, computeNextRuns 예외 미처리 |
| architecture | **MEDIUM** | 모듈 경계 위반, 컨트롤러 비즈니스 로직 혼입, `@Res()` 직접 사용 |
| concurrency | **MEDIUM** | `SlideDrawer` DOM 경쟁 조건, OAuth state 동시 인증 플로우 충돌 |
| api_contract | **MEDIUM** | 페이지네이션 미적용, DTO 없는 raw body, 응답 형식 불일관 |
| maintainability | **MEDIUM** | OAuth 설정 하드코딩, `importWorkflow` 복잡도, `triggeredAt` 필드 불일치 |
| performance | **MEDIUM** | `importWorkflow` N×2 DB 왕복, 직렬 쿼리 병렬화 미적용 |
| database | **MEDIUM** | N+1 패턴, 직렬 쿼리, ORM 매핑 오류(스네이크케이스 컬럼명) |
| side_effect | **MEDIUM** | OAuth CSRF 무효, `layout.tsx` 서버 컴포넌트 경계 변경, `SlideDrawer` DOM 조작 |
| documentation | **MEDIUM** | 환경변수 문서화 누락, `triggeredAt` 불일치, README 미갱신 |
| dependency | **LOW** | `cron-parser` 버전 중복, 프론트엔드 중복 의존성, `@colordx/core` 신뢰도 |

## 발견 없는 에이전트
없음 (전 에이전트에서 최소 1건 이상 발견)

---

## 권장 조치사항

### 즉시 처리 (Blocking)
1. **`triggeredAt` → `startedAt` 필드명 통일** — 트리거 히스토리 날짜가 실제로 표시되지 않는 런타임 버그
2. **`computeNextRuns` try-catch 추가** — 잘못된 cron 표현식 입력 시 HTTP 500 방지
3. **백엔드 신규 서비스 메서드 단위 테스트 작성** — `getUsage`, `reauthorize`, `computeNextRuns`, `getNodeStats`, `exportData`, `getHistory`, `importWorkflow`, `exportWorkflow`

### 보안 조치 (High Priority)
4. **OAuth state 토큰 Redis 저장 및 콜백 검증 구현**
5. **`window.open(authUrl)` 전 URL 화이트리스트 검증 추가**
6. **OAuth 환경변수 미설정 시 명시적 예외 throw** + `.env.example` 갱신
7. **`PreviewExpressionDto` 추가** (`@MaxLength(100)`, `@Min(1) @Max(20) count`)
8. **Import DTO 노드 타입 화이트리스트 검증** 추가

### 구조 개선 (Medium Priority)
9. **`@Res()` → `@Res({ passthrough: true })`** (`statistics.controller.ts`)
10. **`layout.tsx`에서 `"use client"` 제거** 검토
11. **`SchedulesController.runNow` 로직 서비스 이전**
12. **모듈 경계 위반 해소** — Repository 직접 주입 제거
13. **미구현 `scope` 필터 UI 제거**

### 성능 개선 (Lower Priority)
14. **직렬 쿼리 병렬화** — `getUsage`, `dashboard.getSummary`
15. **`importWorkflow` 노드/엣지 벌크 저장**
16. **CSV export 시 불필요한 쿼리 제거**