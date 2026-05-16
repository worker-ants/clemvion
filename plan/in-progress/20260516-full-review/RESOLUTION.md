---
worktree: full-review-fixes-a1b2c3
started: 2026-05-16
owner: developer
---

# Full-Review Resolution — 2026-05-16

> 기준 보고서: `plan/in-progress/20260516-full-review/SUMMARY.md`
> 작업 worktree: `.claude/worktrees/full-review-fixes-a1b2c3` / branch `claude/full-review-fixes-a1b2c3`
> 사용자 요청: "우선순위가 높은 순서대로 의사결정이 필요 없는 부분을 순차적으로 경고 단계까지 모두 처리해줘"
> 검증: 백엔드 단위 테스트 3,762/3,762 통과, `tsc --noEmit -p tsconfig.build.json` 통과

본 문서는 위 SUMMARY 의 발견사항 중 "의사결정 불필요 + 위험도 Critical~Warning" 항목을 1회 작업으로 일괄 처리한 결과를 기록한다. 후속 의사결정이 필요한 항목과 deferred 항목은 마지막 두 절에서 명시한다.

---

## 처리 완료 (Critical)

| # | 위치 | 변경 |
|---|------|------|
| C-5 | `backend/src/modules/execution-engine/execution-engine.service.ts:3637,3679,3735` | `planContainerBody` 안의 `allNodes.find()` 를 함수 도입부에서 1회 생성한 `nodeMap` 의 `nodeMap.get()` 호출로 전환. 동일 `nodeMap` 을 반환 plan 에 재사용해 중복 Map 생성 제거 |
| C-7 | spec/*.md 11곳 | `11-mcp-client.md#23-internal-bridge` 깨진 앵커를 실제 헤딩(`### 2.3 Internal Bridge (in-process)`) 의 GFM slug `#23-internal-bridge-in-process` 로 일괄 치환 |
| C-9 | `backend/migrations/V052__notification_type_integration_action_required.sql` (신규) | `notification.type` CHECK 제약에 `integration_action_required` 추가. `IntegrationActionRequiredNotifierService` INSERT 가 check_violation 으로 실패하던 결함 해소 |
| C-11 (부분) | `backend/src/main.ts`, `backend/src/modules/hooks/hooks.service.spec.ts` | `NestFactory.create(AppModule, { rawBody: true })` 적용 (HMAC 서명 검증 활성화). HMAC + bearer 경로 단위 테스트 9건 추가 (length mismatch / equal-length mismatch / valid match / missing signature / missing rawBody / signature mismatch / valid sha256 / unsupported algorithm 등) |
| C-13 | `backend/package.json` | `overrides` 에 `protobufjs ^7.5.6`, `fast-uri ^3.1.2` 추가. `npm audit` 결과 fast-uri/protobufjs 다중 CVE 해소 (잔여: hono via @modelcontextprotocol/sdk W-57, OTel breaking W-54/W-56 — deferred) |
| C-14 | `spec/conventions/conversation-thread.md:3` | `[Spec AI 공통 §11](.../0-common.md#11-conversation-context)` → `[Spec AI 공통 §10](.../0-common.md#10-conversation-context-자동-컨텍스트-주입)`. 실제 헤딩 번호 10 과 동기화 |
| C-15 | `spec/2-navigation/4-integration.md:951` | `[Spec Cafe24 API 메타데이터 §6](.../cafe24-api-metadata.md#6-allowlist-와의-관계)` → `§7` / `#7-allowlist-와의-관계`. 실제 헤딩 번호 7 과 동기화 |

W-60 (V049 파일-디렉토리 충돌) 은 현 base 커밋(`3f5457aa`) 에 빈 V049 디렉토리가 존재하지 않아 별도 조치 없이 already-resolved 로 분류한다.

---

## 처리 완료 (Warning)

| # | 위치 | 변경 |
|---|------|------|
| W-2 | `backend/src/modules/hooks/hooks.service.ts:18,159` | HMAC 알고리즘 허용 목록 `Set(['sha256','sha512'])` 신설. `verifyAuth` 안에서 외부 입력 algorithm 을 허용 목록 외 값일 때 `UnauthorizedException`. 단위 테스트 1건 추가 |
| W-15 | `spec/5-system/10-graph-rag.md:236` | `graph_extraction_status` Enum 값에 `failed` 추가 + 부연 설명. §7/§3.2 의 영구 실패 분기와 자체 모순 해소 |
| W-21 | `backend/src/modules/statistics/statistics.service.ts:80` | `getSummary` 의 unconditional 워크스페이스 집계 쿼리 + workflowId 별 재집계 패턴을 단일 QueryBuilder 로 통합. workflowId 가 있을 때만 `andWhere` 추가, 첫 쿼리 결과 폐기 제거 |
| W-22 | `backend/src/modules/executions/executions.service.ts:20,127` | `executionPath` 조회에 `MAX_EXECUTION_PATH_ROWS=10000` 상한 (`take`). 대규모 ForEach 로그 행 메모리 적재량 안전망. 관련 spec 테스트 갱신 |
| W-25 | `backend/src/modules/websocket/websocket.service.ts:92` | `sanitizePayloadForWs` 가 자식 mutation 없는 경우 원본 참조를 반환하도록 변경. GC pressure 감소 + emit hot path 의 객체 할당 제거 |
| W-31 (5건) | `backend/src/modules/integrations/services/credentials-transformer.ts`, `backend/src/modules/integrations/integrations.service.ts:702`, `backend/src/modules/integrations/integration-oauth.service.ts:282,307`, `backend/src/nodes/presentation/table/table.handler.ts:264` | `console.warn` / `console.error` 5곳을 NestJS `Logger` 인스턴스로 교체. 모듈 수준 인스턴스가 필요한 곳은 `new Logger('<name>')` 로 import |
| W-37 | `backend/src/modules/hooks/hooks.service.spec.ts` | `constantTimeEquals` 분기 (length mismatch / equal-length / 성공) 단위 테스트가 bearer + HMAC 시나리오로 9건 추가 (C-11 와 합쳐 한 번에 작성) |
| W-41 | `backend/test/webhook-trigger.e2e-spec.ts:74,95,112,134` | `e2e-X-${Date.now()}` 4곳을 `crypto.randomBytes(8).toString('hex')` 기반으로 전환. 동시 e2e 실행 시 endpointPath 충돌 방지 |
| W-46 | `backend/src/common/dto/pagination.dto.ts:11,53` | `PaginationQueryDto.sort` 에 `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 적용. 서비스별 `getSortColumn()` 화이트리스트를 보조하는 DTO 레벨 1차 차단 |
| W-55 | `backend/package.json` | C-13 와 함께 `fast-uri` overrides 추가. `npm audit` GHSA-q3j6-qgpj-74h6 / GHSA-v39h-62p7-jpjc 해소 |
| W-63 | `backend/migrations/V053__notification_workspace_type_resource_idx.{sql,conf}` (신규) | `notification(workspace_id, type, resource_id, created_at DESC)` 복합 인덱스를 `CONCURRENTLY` 로 추가. `NotificationsService.hasRecentByResource` idempotency 쿼리 hot path 인덱스 보강 |
| W-68 | `backend/src/modules/websocket/websocket.gateway.ts:217` | `authorize()` await 경계 이후 `clientSubs.size >= MAX_SUBSCRIPTIONS_PER_CONNECTION` 재검사 추가. 동시 subscribe 가 한도 검사를 interleave 하는 race 해소 |
| W-69 | `spec/4-nodes/4-integration/4-cafe24.md:23,90` | `pagination` 필드의 `cursor?: string` 제거 + 사유 문구 추가. §3, §4.2 의 cursor 언급 동시 삭제 |
| W-77 | `frontend/README.md:7` | `yarn dev` / `pnpm dev` / `bun dev` 명령 제거. 루트 CLAUDE.md "패키지 매니저" 규약(npm 전용) 과 정합 |
| W-79 | `packages/expression-engine/README.md`, `packages/node-summary/README.md` (신규) | 두 패키지의 목적·빌드·사용·boundary 를 정리한 최소 README 작성 |
| W-80 | `README.md:333` | h1 `# integration (SSO)` 을 h2 로 강등. 직속 자식 `## Google OAuth 연동 설정` 도 h3 로 동시 강등 |

> 자료의 단일 진실 원칙 상, 본 표의 변경은 모두 동일 branch (`claude/full-review-fixes-a1b2c3`) 의 단일 작업 단위로 묶여 있다.

---

## 의사결정 보류 (사용자/스펙 합의 필요)

| # | 사유 |
|---|------|
| C-1 / C-2 | Re-run 기능 백엔드·프론트엔드 완전 미구현. 신규 worktree 에서 `replay-rerun.md` PR2 단위로 별도 진행 필요 |
| C-3 | AI Agent 일반 도구 연결 모델 결정 — 사용자 합의 필요 |
| C-4 | `sanitizePayloadForWs` 설정 레이어 이동 — emit hot path 의 trust boundary 재설계 필요 (allowlist 정의가 의사결정 사안) |
| C-6 | `ExecutionEngineService` God-Object 분해 — 4단계 분리안 (`AiConversationOrchestrator` 등) 별도 plan 으로 진행 |
| C-8 | README 포트 혼재 — 환경별(host dev=3000 vs docker fullstack=3012) 매핑 정확도 확인이 필요 |
| C-10 | `AuthConfig.config` 평문 → encryptedJsonTransformer + 평문 행 마이그레이션 스크립트 — 데이터 마이그레이션 절차 사용자 합의 필요 |
| C-12 | Cafe24 OAuth callback/refresh e2e — HTTP stub 컨테이너 추가가 e2e 인프라 변경 사안 |
| W-1 | WebSocket CORS `*` → frontendUrl 화이트리스트 — 환경 분기(`NODE_ENV==='production'`) 외의 조건 결정 필요 |
| W-3 | DOMPurify `ALLOWED_ATTR` 의 `style` 제거 — CSS 정책 결정 필요 |
| W-4 / W-5 | DNS rebinding / DB 호스트 SSRF — 보안 정책 결정 필요 |
| W-6 | sub-workflow workspace 격리 — 엔진 invariant 변경, 별도 plan 권장 |
| W-7~W-14 | 요구사항 항목 (`errorPolicy`, marketplace SDK, integration_action_required UI 등) — 각각 별도 plan |
| W-16 | API 경로 prefix `/api/v1/` vs `/api/` — 정책 확정 필요 |
| W-18 | spec §2.2 API 직호출 대비 — 별도 spec 보강 |
| W-19 | i18n parity main 병합 여부 확인 (다른 worktree 상태 검증) |
| W-23 | `deriveContainerAssignments` 16 패스 — 자료구조 재설계 필요 |
| W-24 | `appendExecutionPath` 배치 INSERT 전환 — 별도 PR 권장 |
| W-26 / W-27 | expression-resolver/ws snapshot 캐시 — 별도 PR 권장 |
| W-28 / W-29 / W-30 / W-33~W-36 | 대형 파일 분해·헬퍼 단일화 리팩토링 — 영역별 별도 PR |
| W-44 / W-47 / W-48 | API 계약 변경 (controller 단 IDOR 보강, throttle, PATCH 패턴) — 호환성·spec 동시 갱신 필요 |
| W-49~W-53 | 아키텍처 디커플링 (DI 토큰, 순환 의존 해소, common/shared 경계, Cafe24ApiClient 분해) — 별도 plan |
| W-54 / W-56 | OpenTelemetry 0.76.0 업데이트 — breaking change, 호환성 검증 필요 |
| W-57 | `@modelcontextprotocol/sdk` 최신화 → hono 취약점 해소 — SDK breaking 확인 필요 |
| W-58 / W-59 | Playwright/MinIO 이미지 버전 정렬 — 사용자 환경 검증 |
| W-61 / W-62 / W-64 | DB·entity·service 변경 — 호출자 영향 확인 필요 |
| W-65 / W-66 / W-67 | 동시성 (boot race, schedule runner, foreach context clone) — invariant 변경, 별도 PR |
| W-70 / W-71 | 커밋 원자성 원칙 수립 — 프로세스 차원의 합의 |
| W-72 / W-73 / W-74 / W-75 | 부작용 (redis config 확장, OnModuleDestroy, OAUTH_STUB_MODE 가드 통합, mock 보강) — 영향 범위 확인 필요 |
| W-76 | `INTEGRATION_ENCRYPTION_KEY` README 보강 — C-8 README 포트 결정과 함께 처리 권장 |
| W-78 | spec Rationale 56개 보강 — 우선순위별 별도 plan |

---

## 검증

```bash
cd backend
npx tsc --noEmit -p tsconfig.build.json   # exit 0 (src 빌드 그래프 클린)
npx jest --no-coverage --silent           # 210 suites / 3,762 tests / all passed
npm audit                                 # fast-uri / protobufjs CVE 해소 (잔여: hono via mcp/sdk W-57, OTel W-54/W-56)
```

후속 작업으로 commit + PR 작성은 사용자 confirm 후 진행한다.
