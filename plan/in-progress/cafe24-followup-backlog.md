---
worktree: cafe24-backlog-e8a3b1
started: 2026-05-16
owner: project-planner / developer (분담)
---

# Cafe24 정비 follow-up 백로그

PR #52 → #85 의 7 PR 사이클로 운영 결함·Critical 22건·High 11건·Spec drift 5건·정리 4건 (총 42건) 처리 완료. 남은 follow-up 을 본 plan 에 모아 백로그로 보관. 우선순위·일정·담당자는 미정 — 사용자 의사결정 시 in-progress 항목으로 분리.

## 출처

- 2026-05-16 다관점 코드 리뷰 (`review/code/2026/05/16/cafe24-audit/` — 외부 worktree 에서 진행, main 에 머지되지 않음. 본 plan 의 백로그 항목으로 흡수)
- PR #75/#76/#79/#85 의 consistency-check INFO/WARNING 후속
- 운영 메모리 deferred task (`feedback_*`, `project_deferred_*`)

## A. Spec 결정 필요 (I-8)

### A-1. `integration_action_required` 알림 타입 신설 검토

- **출처**: PR #79 (`spec/2-navigation/4-integration.md ## Rationale "install_timeout 알림 미발사"`) 가 향후 검토로 언급.
- **결정 사항**: `error(auth_failed)` / `error(network)` / `error(insufficient_scope)` 전이 시 사용자에게 알림을 발사할지, 발사한다면 별도 type (`integration_action_required`) 을 신설할지.
- **영향 범위**: spec/2-navigation/4-integration.md §11.2, spec/1-data-model.md §2.19 Notification.type Enum, spec/data-flow/8-notifications.md §1.1, backend `Cafe24ApiClient.markAuthFailed` / `recordNetworkFailure` 분기 + notify 호출 추가, frontend 알림 표시 UI.
- **결정 후 작업 단위**: spec 갱신 + backend notify 호출 + frontend 알림 UI/표시. 기존 `integration_expired` 와 별도 type 으로 분리할지 또는 type 은 그대로 두고 메시지만 분기할지도 결정 사항.
- **추적**: 별 plan 으로 분리 시 `plan/in-progress/spec-update-cafe24-error-notification.md` 같은 이름 권장.

## B. Medium (audit review 후속)

운영 영향이 즉시는 아니나 누적되면 운영 위험이 되는 항목. 카테고리별 묶음 PR 권장.

### B-1. 보안 Medium (6건)

- **B-1-1. SSRF 방어 강화**: `Cafe24ApiClient.buildUrl` 의 최종 URL `hostname` 이 `*.cafe24api.com` 인지 assertion 추가. 메타데이터 오염 시나리오 대비.
- **B-1-2. install_token 로그 prefix 제거**: `tryRecoverByMallId` 의 warn 로그에서 `url_token_prefix` (앞 6자) 제거. brute-force surface 축소 (PR #67 SEC H-2 에서 일부 처리 — UUID/tokenPrefix 제거. 추가 점검).
- **B-1-3. timestamp replay 방지**: `handleInstall` 의 timestamp ±5분 윈도우만 검증 → 사용된 `timestamp:hmac` 조합을 Redis 에 10분 TTL 캐시. 또는 영향 (OAuth state 중복 생성) 을 허용 위험으로 spec 에 수용 명시.
- **B-1-4. `consumePreviewToken` ownership 을 DB 레벨로**: 현재 `DELETE … RETURNING` 후 ownership 검증 → DELETE WHERE 절에 `workspace_id` + `user_id` 추가. 소유자 아닌 자가 탈취한 토큰을 소비해 DoS 시키는 시나리오 차단.
- **B-1-5. `sanitizeSid` 충돌 공간 확장**: UUID 8자 prefix → 16자 또는 hash 기반. SaaS 규모 확장 시 도구 이름 충돌 방지.
- **B-1-6. `OAUTH_STUB_MODE` staging 제한**: production 외 staging 에서도 stub mode 활성화되면 실제 사용자 데이터에 stub token 발급 가능. `NODE_ENV=test || NODE_ENV=development` 로 제한.

### B-2. 동시성 Medium (4건)

- **B-2-1. `dispatchRepository.insert` 23505 catch 패턴 일관화**: `err.code` 만 검사하고 `err.driverError.code` 폴백 없음 → 다른 TypeORM 경로와 불일치. 공유 헬퍼로 추출.
- **B-2-2. `applicationShutdown` graceful QueueEvents close**: `Cafe24Module.onApplicationShutdown` 이 in-flight `waitUntilFinished` 가 있을 때 hang 가능. HTTP graceful timeout 과 `REFRESH_JOB_WAIT_TIMEOUT_MS` 정렬 또는 명시 대기 로직.
- **B-2-3. `Cafe24McpToolProvider.cleanup` invariant**: 같은 executionId 로 buildTools 두 번 호출 (multi-turn) 시 sidCount 음수 가능성. 회귀 테스트 추가.
- **B-2-4. `expirePendingInstalls` bulk UPDATE 격리 수준 명시**: spec 에 PostgreSQL READ COMMITTED + row-level locking 의 안전성 근거를 inline 으로 inline.

### B-3. 요구사항/API 계약 Medium (7건)

- **B-3-1. MCP error envelope `output.response` 보존**: `Cafe24McpToolProvider` 의 `Cafe24AuthFailedError` 변환 시 `responseBody` 를 `output.response` 에 포함. 노드 경로와 일관.
- **B-3-2. `buildRequestParts` path placeholder 미치환 hard-fail**: `{product_no}` 미치환 시 `CAFE24_UNRESOLVED_PATH_PARAM` throw. 메타데이터 오류 silent 동작 방지.
- **B-3-3. `Cafe24Handler.validate()` operation 메타데이터 lookup**: 캔버스 배지가 잘못된 operation 선택에 즉시 경고 가능.
- **B-3-4. `markIntegrationCallbackError.statusReason` union type 고정**: snake_case 허용값 union + 알 수 없는 코드는 `unknown_error` fallback.
- **B-3-5. `OAuthBeginDto.integrationId` IsUUID**: class-validator 에 IsUUID 추가.
- **B-3-6. `RequestScopesDto.scopes` MaxLength**: `OAuthBeginDto.scopes` 와 동일하게 `@MaxLength(128, { each: true })` 추가.
- **B-3-7. cursor pagination 명시**: `Cafe24CallOptions.pagination.cursor?` 가 Cafe24 Admin API 미지원. 메타데이터에서 제거 또는 spec 에 limit/offset 만 허용 명시.

### B-4. 데이터베이스 Medium (5건)

- **B-4-1. `pruneUsageLogs` status 인덱스 활용**: `WHERE status='pending_install'` 부분 인덱스 추가.
- **B-4-2. `run()` N+1 user.find**: 만료 스캐너 안에서 N개 통합 각각에 대해 user.find 호출 → workspaceId 집합으로 일괄 로드.
- **B-4-3. `refreshAccessToken` SELECT FOR UPDATE**: BullMQ jobId dedup 외 DB 레벨 row lock 추가 (defense-in-depth).
- **B-4-4. `tryRecoverByMallId` mallId 단독 인덱스**: V046 partial UNIQUE 의 선두 컬럼이 workspace_id 라 mall_id 단독 조회에서 활용 안 될 수 있음. partial index `(mall_id) WHERE service_type='cafe24'` 추가 또는 회복 흐름 빈도 낮아 무시.
- **B-4-5. `INSERT ON CONFLICT DO NOTHING` 패턴**: `claimThreshold` 의 try/catch 23505 → ON CONFLICT 로 교체. 예외 비용 감소.

### B-5. 테스트 Medium (8건)

- **B-5-1. refreshViaQueue status=error,statusReason=network_timeout 케이스**: PR #67 의 `error(auth_failed)` 외 다른 reason 검증.
- **B-5-2. handleInstall pending_install → OAuth state.integrationId 연결**: end-to-end 흐름 검증.
- **B-5-3. rate-limit 2회 retry + 3번째 성공 경계값**: `res.retries === 2` 검증.
- **B-5-4. Cafe24McpToolProvider sidCount race**: B-2-3 와 동반.
- **B-5-5. `Cafe24TransportFailedError` envelope 변환 케이스**: MCP provider 의 classifyError 검증.
- **B-5-6. `Cafe24Handler.logUsage` failure swallow**: db 다운 시 result port 검증.
- **B-5-7. provider_mismatch 분기**: state.provider != route provider 케이스.
- **B-5-8. e2e**: backend/test/ 에 Cafe24 OAuth + handleInstall + handleCallback + BullMQ refresh 통합 시나리오 추가.

## C. 운영 점검 (deferred)

### C-1. 프로덕션 DB unencrypted credentials 점검 — PR #81 배포 전 의무

- **출처**: `/Users/gehrig/.claude/projects/-Volumes-project-private-clemvion/memory/project_deferred_db_check.md`.
- **점검 내용**: PR #81 배포 전 prod DB 의 credentials JSONB 컬럼에 `enc:` prefix 없는 plaintext 잔존 행이 있는지 확인. 발견 시 마이그레이션 또는 수동 정리.
- **방법**: `SELECT id, service_type FROM integration WHERE credentials::text NOT LIKE 'enc:%'` 같은 쿼리. encryptedJsonTransformer 가 적용된 후 INSERT 된 행은 모두 `enc:` prefix.
- **완료 시**: 메모리 항목 제거.

## 진행 순서

본 plan 은 백로그 — 항목 처리 시 별 plan 으로 분리해 in-progress 로 이동.

- [ ] A-1: integration_action_required — 사용자 결정 필요
- [x] B-1: 보안 Medium 6건 — 묶음 PR (2026-05-16, B-1-1/2/4/5/6 처리, B-1-3 은 spec 명문화만 + Redis nonce cache 는 별 plan 으로 잔여)
- [ ] B-1-3 follow-up: timestamp replay nonce cache — Redis DI + 운영 비용 평가 필요
- [x] B-2: 동시성 Medium 4건 — 묶음 PR (2026-05-16, B-2-1/2/3/4 모두 처리)
- [x] B-3: 요구사항/API Medium 7건 — 묶음 PR (2026-05-16, B-3-1~7 모두 처리)
- [ ] B-4: 데이터베이스 Medium 5건 — 묶음 PR (별 마이그레이션 필요)
- [x] B-5: 테스트 Medium 8건 — 묶음 PR (2026-05-16, B-5-1/2/3/4/5/6/7 처리. B-5-8 e2e 는 별 plan 으로 잔여)
- [ ] B-5-8 follow-up: Cafe24 OAuth + handleInstall/handleCallback + BullMQ refresh e2e — docker-compose.e2e.yml 풀-스택 부팅 필요
- [ ] C-1: prod DB 점검 — 운영 task

## Cafe24 정비 사이클 (참고 — 완료)

| PR | 주제 |
| --- | --- |
| #52 | proactive refresh canonical column fix |
| #56 | BullMQ token refresh queue + 백그라운드 갱신 |
| #67 | Critical 11 + High 11 (PR #56 의 Phase 2 복구 포함) |
| #75 | Spec drift 정리 (REQ HIGH-2 + SPEC-1~4) |
| #76 | overview / notification 정책 명시 |
| #79 | install_timeout 알림 미발사 명문화 |
| #85 | spec/data-flow/ 12 파일 명명 규약 정합화 (F-1) |
