# Code Review 통합 보고서

> 대상: spec-sync-audit (spec/conventions/*, spec/data-flow/* 20개 파일 동기화 갱신)
> 생성일: 2026-06-03

---

## 전체 위험도

**CRITICAL** — CI 차단 가능성이 있는 plan 파일 미신설(pending_plans 가드 fail) 1건 + 복수의 API 계약 breaking change 및 DB 레벨 무결성 갭이 병존한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CI/가드 | `user-guide-evidence.md`가 `status: partial`로 강등되며 `pending_plans:`에 `plan/in-progress/spec-sync-user-guide-evidence-gaps.md`를 선언했으나 해당 파일이 `plan/in-progress/` 및 `plan/complete/` 어디에도 부재 — `spec-pending-plan-existence.test.ts` 가드 fail로 CI 빌드 차단 예상 | `spec/conventions/user-guide-evidence.md` + `plan/in-progress/` | 동일 변경 셋 안에서 `plan/in-progress/spec-sync-user-guide-evidence-gaps.md`를 신설해야 한다. 최소 내용은 user-guide-writer agent ImplAnchor 체크리스트 미등재, `api-endpoint` kind NestJS 데코레이터 검증 미구현 두 가지 gap을 기술하는 frontmatter + 본문. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/인가 | `X-Workspace-Id` 헤더가 JWT `workspaceId` 클레임보다 우선 수용됨. RBAC 검증이 각 핸들러/서비스에서 개별 완결된다는 전제에만 의존 — 누락 시 IDOR 경로 | `spec/data-flow/12-workspace.md` Rationale | `WorkspaceId` 데코레이터 레벨에서 헤더로 지정된 workspace_id가 JWT 사용자의 멤버십에 존재하는지 일괄 교차 검증하는 미들웨어/가드 추가, 또는 §1.5 workspace switch 토큰 재발급 우선 구현 |
| 2 | DB 무결성 | `workspace.(owner_id, type) UNIQUE` 제약이 TypeORM `@Unique` 데코레이터로만 선언됨. `synchronize` 비활성 환경에서 DB 레벨 미강제 — 병렬 요청·마이그레이션 스크립트로 personal workspace 중복 생성 가능 | `spec/data-flow/12-workspace.md` Rationale | 신규 마이그레이션(`CREATE UNIQUE INDEX CONCURRENTLY`)으로 DB UNIQUE 제약 추가, 기존 데이터 중복 여부 사전 확인 필요 |
| 3 | API 계약 | 세션 취소 엔드포인트가 `DELETE /api/auth/sessions/:familyId (204)` → `POST /api/users/me/sessions/:familyId/revoke (200+body)`로 메서드·경로·응답코드 모두 변경 — 명시적 breaking change | `spec/data-flow/2-auth.md` §1.5 | 프론트엔드 API 클라이언트(`/api/auth/sessions` 호출 코드) 갱신 완료 여부 확인 |
| 4 | API 계약 | OAuth Integration 시작이 `GET /oauth/:service/start (302)` → `POST /oauth/begin {service,mode} (200 JSON {authUrl,state})`로 메서드·경로·응답 방식 모두 변경 | `spec/data-flow/5-integration.md` §1.2 | 프론트엔드 integration 연동 UI 코드 갱신 완료 여부 확인. Cafe24 Private 분기 oneOf 응답에 `ApiOkWrappedOneOfResponse` 적용 여부 확인 |
| 5 | API 계약 | 워크플로우 실행 시작 경로 `/run` → `/execute` 변경 및 인터랙션 재개 진입 `/interactions` → `/continue`(REST)+WS 이중화 — 기존 클라이언트 기능 중단 가능 | `spec/data-flow/10-triggers.md`, `spec/data-flow/3-execution.md` | 프론트엔드 API 클라이언트 전체에서 `/run` → `/execute`, `/interactions` → `/continue` 사용 여부 점검 |
| 6 | API 계약 | 초대 수락 에러 응답이 `403 INVITATION_EMAIL_MISMATCH` → `400 code=invitation_email_mismatch`로 변경, HTTP 상태코드 의미론 및 에러코드 casing 모두 변경 | `spec/data-flow/12-workspace.md` §1.3 | 기존 클라이언트가 403 분기로 처리하던 코드 확인. 에러 코드 형식 컨벤션(대문자 vs 소문자) 프로젝트 전체 통일 |
| 7 | API 계약 | 계정 잠금 응답이 `423 ACCOUNT_LOCKED` → `401 code=ACCOUNT_LOCKED`로 변경 — 클라이언트에서 "인증 실패"와 "계정 잠금"을 status code로 구분 불가 | `spec/data-flow/2-auth.md` | 프론트엔드 에러 핸들러가 `code=ACCOUNT_LOCKED`를 파싱해 잠금 안내 UI를 분기하도록 갱신됐는지 확인 |
| 8 | 아키텍처 | `schedule` 생성 시 trigger INSERT 후 schedule INSERT를 순차 수행 — 단일 트랜잭션 미보장. 중간 실패 시 고아 trigger 생성 가능. BullMQ 등록 포함 시 실패 경로가 3단계 | `spec/data-flow/10-triggers.md` §1.4 | trigger + schedule INSERT를 단일 트랜잭션으로 묶고, BullMQ 등록은 commit 후 outbox 패턴 적용. plan 추가 권장 |
| 9 | 알림/테스팅 | `user-guide-evidence.md` §4 채널 2번(user-guide-writer 자가 검증 체크리스트) 미구현이 spec에 명시됐으나 추적 plan 미존재(CRITICAL #1과 동일 근원) | `spec/conventions/user-guide-evidence.md` §4 | CRITICAL #1과 동일 조치 |
| 10 | 보안 | `alert_<rule.type>` 동적 notification type이 V052 CHECK 제약 목록 밖 — DB 레벨 열거 보호 없음, 외부 입력 파생 시 예상치 못한 값 삽입 가능 | `spec/data-flow/8-notifications.md` §1.1 | `alert_%` LIKE 패턴 추가 마이그레이션 또는 application 레이어 화이트리스트 검증 추가 |
| 11 | 문서/계약 | `spec/data-flow/11-workflow.md` API 경로 변경(`/run` → `/execute`, WebSocket → SSE 스트리밍)이 spec에만 기록 — 클라이언트 계약 동기화 여부 미검증 | `spec/data-flow/11-workflow.md` §1.1, §1.3 | 구 경로 deprecated/제거 명시 또는 changelog 항목 추가. 프론트엔드 SSE 수신 코드가 새 이벤트 타입(`text`, `tool_call`, `plan`, `usage`, `done`) 처리 여부 확인 |
| 12 | 테스팅 | DB/Email 노드 in-flight 중단 미구현(사전 abort 체크만). 이 동작을 검증하는 단위 테스트 부재 — 리팩터링 시 사전 체크 제거돼도 미감지 | `spec/conventions/node-cancellation.md` §6 | `database-query.handler.spec.ts` / `send-email.handler.spec.ts`에 `abortSignal.aborted=true` 진입 시 AbortError throw 검증 테스트 추가 |
| 13 | 문서 | `spec/data-flow/12-workspace.md` §1.5 헤더에 구현 상태를 직접 포함(`### 1.5 워크스페이스 전환 — 미구현 (Planned)`) — 마크다운 앵커 URL 변경으로 기존 cross-ref 링크 무효화 가능 | `spec/data-flow/12-workspace.md` §1.5 | 섹션 제목은 `### 1.5 워크스페이스 전환`으로 유지하고, 섹션 첫 줄에 `> **현재 미구현**` 블록 인용 사용 |
| 14 | 문서 | `spec/conventions/node-cancellation.md` §6 제목 변경(`본 PR 범위` → `구현 현황`)으로 앵커 URL 변경 — 다른 spec 파일 cross-ref dead link 가능성 | `spec/conventions/node-cancellation.md` §6 | 리포 내 `node-cancellation.md#6-본-pr` 앵커 참조 grep 후 발견 시 함께 업데이트 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | KB 삭제 시 S3 객체를 for 루프 순차 삭제 — N+1 외부 I/O 패턴. S3/MinIO Bulk Delete API 미활용 | `spec/data-flow/4-file-storage.md`, `knowledge-base.service.ts:644-658` | `s3Service.deleteMany(keys[])` 추가 후 `DeleteObjectsCommand`(최대 1000개 batch) 활용 |
| 2 | 성능 | AlertsEvaluator 5분마다 enabled rule 전체 로드 후 rule 수만큼 개별 집계 쿼리 실행 — N+1 DB 호출 패턴 | `spec/data-flow/9-observability.md` §1.3 | `GROUP BY rule_id` 배치 집계 쿼리로 전환하거나 동일 type rule을 단일 window 집계로 통합 |
| 3 | 성능 | `idx_alert_rule_enabled` partial 인덱스 spec에 기술됐으나 대응 마이그레이션 파일 존재 여부 불명 — 없으면 full table scan | `spec/data-flow/9-observability.md` §2.1 | 해당 인덱스가 포함된 마이그레이션(V번호)을 spec에 명시하고, migrations.spec.ts 가드로 인덱스 존재 검증 |
| 4 | 알림 | 단일 `notify()` 표면 미구현, WS emit 미구현, 이메일 발송 미구현이 spec에 명시됐으나 추적 plan 부재. `execution_failed`, `schedule_failed`, `marketplace_update`, `team_invite` 4개 type이 DB CHECK 허용됨에도 어떤 코드도 미발사 | `spec/data-flow/8-notifications.md` | 미구현 알림 기능에 대한 pending_plans 추가 권장 (project-planner 위임) |
| 5 | 보안 | S3 key 패턴에 workspace prefix 없어 IAM 정책 레벨 격리 불가 — presigned URL 도입 시 타 workspace 파일 접근 URL 발급 위험 | `spec/data-flow/4-file-storage.md` Rationale | presigned URL 도입 시 kbId→workspaceId 검증을 포함하는 서버사이드 게이트웨이 경유 설계 필수 |
| 6 | 보안 | `audit_log.action` 자유 문자열(VARCHAR 100) — DB CHECK 없이 typo 오염 가능, 보안 컴플라이언스 감사 시 무결성 위험 | `spec/data-flow/1-audit.md` Rationale | TypeScript enum/const object로 compile-time 타입 안전성 보장, 장기적으로 DB CHECK 제약 추가 검토 |
| 7 | 보안 | Webhook 비활성 트리거 응답 404 → 410 Gone 변경. 외부 호출자가 404로 분기하던 경우 영향 가능 | `spec/data-flow/10-triggers.md` | 외부 webhook 클라이언트 API 문서에 410 응답 케이스 명시. `hooks.service.ts/hooks.controller.ts` 코드 확인 |
| 8 | 테스팅 | AI 노드(ai-agent, text-classifier, information-extractor) signal 전파 구현 완료 표시됐으나 AbortSignal이 SDK에 전달되는지 검증하는 단위 테스트 부재 | `spec/conventions/node-cancellation.md` §6 | 각 handler spec 파일에서 `context.abortSignal`이 SDK `create()` `signal` 파라미터로 전달되는지 mock 검증 케이스 추가 |
| 9 | 테스팅 | Schedule BullMQ 이관 완료됐으나 `upsertJobScheduler`/`registerJob`/`removeJob` 동작 검증 단위 테스트 존재 여부 spec 미언급 | `spec/data-flow/10-triggers.md` §1.3, §1.4 | `SchedulesService` 단위 테스트에서 cron 변경 시 `upsertJobScheduler` 재등록, `is_active=false` 시 `removeJob` 호출 mock 검증 추가 |
| 10 | 테스팅 | 2단계 회원가입 흐름(register→verify-email) 변경 대응 테스트가 기존의 "register 시 즉시 token 반환" 가정으로 작성됐다면 현재 동작과 불일치 가능 | `spec/data-flow/2-auth.md` §1.1 | `auth.service.spec.ts` 등 회원가입 관련 기존 테스트가 2단계 흐름에 맞게 갱신됐는지 확인 |
| 11 | 유지보수 | spec 문서 다수에 라인 번호 하드코딩(`knowledge-base.service.ts:644-658`, `execution.entity.ts:97`, `alerts-evaluator.service.ts:58-103` 등) — 코드 변경마다 stale해지는 취약 참조 | `spec/data-flow/0-overview.md`, `1-audit.md`, `3-execution.md`, `4-file-storage.md`, `5-integration.md`, `9-observability.md` 외 다수 | 라인 번호 대신 함수/메서드명 참조로 대체(`remove()`, `findAll()` 등). 꼭 라인 번호 필요 시 `~` 기호로 근사치 표기 |
| 12 | 유지보수 | 구현 상태 표기가 `✓`, `**구현됨**`, `(구현됨)`, `🚧`, `— 미구현`, `미구현 (Planned)` 등 6가지 이상 혼재 | 전체 변경 파일 다수 | `spec/conventions/`에 구현 상태 표기 단일 규약(`✓ 구현됨` / `🚧 부분구현` / `— 미구현 (Planned)`) 참고 섹션 추가 |
| 13 | 유지보수 | `backlog` 가드가 "§6.3 항목" 한정에서 "0-overview.md 본문 전체 텍스트" includes 매칭으로 완화 — 향후 절 단위 전환 계획이 spec에만 기재되고 테스트 주석에 미반영 | `spec/conventions/spec-impl-evidence.md` | `spec-status-lifecycle.test.ts` `(d)` 케이스 주석에 "현재 전체 텍스트 검사, §6.3 절 단위 전환 계획" 추가 |
| 14 | DB | `secret_store` CHECK 제약 추가(V063) 시 기존 행 중 패턴 위반 row 있으면 migration 실패 위험 | `spec/conventions/secret-store.md` V063 | 배포 전 "기존 rows가 CHECK 패턴을 이미 만족함" 확인 절차 명시. `NOT VALID` + `VALIDATE CONSTRAINT` 분리 적용 고려 |
| 15 | DB | `login_history` DROP+ADD CHECK 패턴이 두 번의 `AccessExclusiveLock` 획득 — 단일 `ALTER TABLE` 문으로 묶으면 잠금 노출 최소화 | `spec/data-flow/1-audit.md` Rationale | `spec/conventions/migrations.md`에 "CHECK enum 확장은 단일 ALTER TABLE 문으로 DROP+ADD 묶기" 가이드 추가 |
| 16 | DB | DB 노드 in-flight PostgreSQL 쿼리가 AbortSignal 수신 후에도 계속 실행 — 커넥션 장기 점유 및 풀 고갈 가능성(미구현 알려진 제한) | `spec/conventions/node-cancellation.md` §6 | `client.cancel()` 구현 시 `finally` 블록에서 커넥션 풀 반환 보장 패턴을 spec에 명시 |
| 17 | 의존성 | `cron-parser` API 참조가 `parseCron()` → `CronExpressionParser.parse`로 갱신됨 — package.json의 실제 버전이 v4.x 이상인지 미확인 | `spec/data-flow/10-triggers.md` §3.2 | `package.json`에서 `cron-parser` 버전이 `CronExpressionParser` 네이밍 도입 버전으로 고정됐는지 확인 |
| 18 | 의존성 | `workflow-assistant` 모듈이 `NodesService`/`EdgesService` 의존 제거 + `ShadowWorkflow` in-memory 전환됐음이 spec에 명시 | `spec/data-flow/11-workflow.md` §1.4 | `workflow-assistant.module.ts` imports 배열에 `NodesService`/`EdgesService` 참조가 실제로 없는지 코드 레벨 확인 |
| 19 | 의존성 | `AuthConfigsService.verifyWebhookRequest` 위임으로 hooks → auth-configs 단방향 의존 생성 — 순환 의존 가능성 | `spec/data-flow/10-triggers.md` §1.2 | 서비스 간 순환 의존이 발생하지 않는지 확인 |
| 20 | 문서 | PostgreSQL 버전이 docker-compose(pg18) vs k8s overlay(pg16) 불일치가 처음 문서화됨 — 실질 호환성 이슈(pgvector 등) 가능성 | `spec/data-flow/0-overview.md` | pg18 vs pg16 불일치가 extension 버전 차이 등 실질 이슈를 유발하는지 별도 plan 항목 생성 검토 |
| 21 | 문서 | OAuth 콜백 보안 결정(URL token 노출 방지)이 blockquote 주석으로 처리됨 — 중요도가 높은 보안 결정이므로 Rationale 섹션 공식 항목 승격 고려 | `spec/data-flow/2-auth.md` | Rationale 섹션에 공식 항목으로 승격 고려 (현재 상태도 정보는 충분) |
| 22 | 문서 | `spec/data-flow/9-observability.md`의 `alert_rule.enabled` 컬럼명 변경이 `spec/1-data-model.md`에도 반영됐는지 교차 확인 필요 | `spec/data-flow/9-observability.md` | 데이터 모델 문서 교차 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| user_guide_sync | CRITICAL | pending_plans 선언 파일 미신설 → CI 가드 fail 예상 |
| security | MEDIUM | X-Workspace-Id IDOR 위험, workspace UNIQUE 미강제, 초대 엔드포인트 403→400 변경 |
| architecture | MEDIUM | X-Workspace-Id 헤더 우선 RBAC 경계 불명확, schedule 생성 비원자성, workspace UNIQUE 미강제 |
| requirement | MEDIUM | workspace UNIQUE 미강제, schedule 트랜잭션 부재, notifications 미구현 plan 미추적 |
| api_contract | MEDIUM | 세션취소·OAuth·실행시작 등 복수 breaking change API, X-Workspace-Id 인가 bypass 위험 |
| performance | LOW | S3 for루프 N+1 외부 I/O, AlertsEvaluator N+1 DB 쿼리 |
| testing | LOW | AI 노드 AbortSignal 단위 테스트 부재, DB/Email 노드 사전 abort 테스트 부재 |
| documentation | LOW | 라인 번호 기반 코드 참조 stale 위험, API 경로 변경 클라이언트 정합 미검증 |
| database | LOW | CHECK 제약 추가 migration 잠금 주의사항, DROP+ADD 이중 잠금 패턴 |
| maintainability | LOW | 구현 상태 표기 불일치, 라인 번호 하드코딩, 테이블 셀 과밀 |
| side_effect | NONE | 실행 코드 변경 없음. spec frontmatter code:/pending_plans: 경로 CI 가드 영향만 존재 |
| concurrency | NONE | 실행 코드 변경 없음. 동시성 분석 대상 없음 |
| dependency | NONE | 외부 패키지 변경 없음. 내부 모듈 의존 단순화 방향 |
| scope | 재시도 필요 | output_file 부재 — scope.md 미생성 |

---

## 발견 없는 에이전트

- **concurrency**: 실행 코드 변경 없음 — 동시성 분석 대상 없음 (NONE)
- **dependency**: 외부 패키지 변경 없음 — 내부 모듈 의존 관계 명세 변경만 (NONE)
- **side_effect**: 실행 코드 미포함 — 런타임 부작용 없음 (NONE)

---

## 권장 조치사항

1. **[즉시/CI 차단 해소]** `plan/in-progress/spec-sync-user-guide-evidence-gaps.md` 파일을 신설한다. user-guide-writer agent ImplAnchor 체크리스트 미등재 + `api-endpoint` kind NestJS 데코레이터 검증 미구현을 본문에 기술하면 `spec-pending-plan-existence.test.ts` 가드가 통과된다.
2. **[보안 우선]** `WorkspaceId` 데코레이터 레벨에서 헤더로 전달된 workspace_id가 JWT 사용자의 멤버십에 실존하는지 교차 검증하는 미들웨어/가드를 추가하거나, §1.5 workspace switch 토큰 재발급을 우선 구현하여 헤더 의존을 제거한다.
3. **[DB 무결성]** `CREATE UNIQUE INDEX CONCURRENTLY`로 `workspace(owner_id, type)` DB UNIQUE 제약을 마이그레이션에 추가한다. 기존 데이터 중복 여부 선행 확인 필수.
4. **[API 계약 검증]** 세션 취소(DELETE→POST), OAuth begin(GET→POST), 실행 시작(`/run`→`/execute`), 인터랙션 재개(`/interactions`→`/continue`) 등 spec에 기록된 breaking change가 프론트엔드 API 클라이언트에 이미 반영됐는지 일괄 점검한다.
5. **[데이터 정합성]** `schedule` 생성 시 trigger + schedule INSERT를 단일 트랜잭션으로 묶는 plan을 신설하고 project-planner에 위임한다.
6. **[성능]** `AlertsEvaluatorService` N+1 DB 쿼리와 KB 삭제 S3 순차 for루프를 개선하는 별도 task를 plan에 등록한다.
7. **[테스트 커버리지]** AI 노드 AbortSignal 전파 mock 검증, DB/Email 노드 사전 abort 체크 테스트, Schedule BullMQ 이관 단위 테스트를 각 handler spec 파일에 추가한다.
8. **[문서 유지보수]** 라인 번호 기반 코드 참조를 함수/메서드명 참조로 점진적으로 교체하고, spec/conventions/에 구현 상태 표기 단일 규약을 추가한다.

---

## 라우터 결정

라우터 미사용 — `routing=fallback-all`로 전체 reviewer가 실행됨.

- **실행(ran)**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외(skipped)**: 없음
- **강제 포함(router_safety)**: documentation, requirement

> 참고: `scope` reviewer는 ran 목록에 포함됐으나 output_file(`scope.md`)이 디렉토리에 존재하지 않아 내용을 읽을 수 없었습니다. 해당 reviewer의 발견사항은 본 보고서에 반영되지 않았습니다 (재시도 필요).