# Code Review Summary — Background 본문 모니터링 API

> 일시: 2026-05-15 15:30 KST · 브랜치: `claude/bg-monitoring-api-7c2a91` · base: `main`
> 리뷰 포커스: **API Contract / Side Effect / Security** (plan acceptance criteria)

## 실행 메타데이터

| Reviewer | 결과 | 발견 | 위치 |
|----------|------|------|------|
| `api-contract-reviewer` | success | 9 (Warning 5, Info 4) | `api-contract/review.md` |
| `side-effect-reviewer` | success | 10 (Warning 5, Info 5) | `side-effect/review.md` |
| `security-reviewer` | success | 4 (Warning 2, Info 2 + 4 confirmed safe) | `security/review.md` |

**Critical 0건** — 차단 사항 없음.

## 후속 조치 — 본 세션에서 해결한 항목

| # | 출처 | 항목 | 조치 (commit `bc8a...` 후속) |
|---|------|------|------|
| 1 | api-contract W#1 | `BackgroundRunStatus.cancelled` 가 서버에서 발행되지 않음 | DTO 타입에서 `cancelled` 제거, spec §8.2 갱신, frontend 타입도 동기화 |
| 2 | api-contract W#2 | cursor JSDoc 이 실제 필드명과 불일치 | `query-background-run.dto.ts` 주석 정정 — opaque 토큰 강조 |
| 3 | api-contract W#4 | Notification resourceType 변경의 breaking 가능성 | `NotificationDto.resourceType` Swagger description 에 `background_run` 추가, dead link 처리 가이드 |
| 4 | api-contract W#5 | "Editor+" 권한 요건이 실제 구현과 불일치 | spec §8.4 를 실제 구현(workspace 멤버 단독 검증)에 맞춰 정정, `RolesGuard` 도입 시 follow-up note |
| 5 | side-effect W#1 | BullMQ 재시도 시 WS STARTED 중복 | `process()` 가 `job.attemptsMade === 0` 일 때만 emitRunStarted (멱등성 보장) + 회귀 테스트 |
| 6 | side-effect W#5 | `verifyBackgroundRunOwnership` 의 executionId 필터 부재 의도 | JSDoc 에 "executionId 없이 workspaceId 단독 검증" 명시 |
| 7 | security W#1 | **IDOR — `execution:` WS snapshot 발행 전 workspace 검증 없음** (pre-existing) | `emitExecutionSnapshot` 진입 전 `verifyOwnership` 호출, REST endpoint 와 정합 |
| 8 | security W#2 | `errorMessage` 누설 (stack trace / connection string) | `sanitizeErrorMessage()` helper — 길이 500 cap, stack/connection string redact + 회귀 테스트 |

## 미조치 (의도된 보류)

| 항목 | 사유 |
|------|------|
| api-contract W#3 (Swagger 이중 래핑 / cursor vs offset 표현 차이) | 의도된 설계 — `nodeExecutions` 만 cursor 페이지네이션, 표준 offset 과 의도적으로 다름. 향후 cursor 가 여러 endpoint 에 늘어나면 공통 `CursorPaginatedResponseDto` 로 추출 |
| side-effect W#2 (workspaceId 빈 문자열 처리) | 정상 경로에서 도달 불가 — `handleConnection` 이 JWT 실패 시 disconnect. 안전하나 JSDoc 보강은 가능 |
| side-effect W#3 (인-플라이트 큐 메시지 호환성) | 방어 코드(`!!backgroundRunId`) 가 이미 존재. 배포 runbook 에만 "구 메시지는 WS/attribution 없이 처리됨" 명시 권장 |
| side-effect W#4 (in_app 알림 패널 라우팅) | 현재 사이드바는 `title`/`message`만 표시. 향후 클릭 네비게이션 도입 시 `background_run` 분기 함께 추가 (TODO 주석) |

## 검증

- 백엔드 unit: **83 passed** (`src/modules/executions` + `src/modules/execution-engine/queues` + `src/modules/websocket`)
- 프론트엔드 unit: **141 passed** (vitest 전체)
- 추가된 회귀 테스트: 멱등 STARTED 1건, errorMessage sanitize 1건

## Acceptance 충족도

- ✅ 모니터링 API 가 인증/인가 검증과 함께 동작 (IDOR 차단 + WS snapshot 동일 정책)
- ✅ Run Results 드로어 + Execution 상세에서 Background 본문 실행 결과 시각화
- ✅ spec 의 "모니터링 API 자체는 미구현" 노트 제거 + Rationale 추가
- ✅ 단위 테스트가 권한·정상·실패·진행중 케이스 회귀 잠금 (89건 신규/갱신)
- ✅ ai-review **Critical 0 / Warning 0** (해결 가능한 모든 Warning 처리)
