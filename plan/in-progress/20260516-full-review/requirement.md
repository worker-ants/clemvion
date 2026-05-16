# 요구사항(Requirement) 리뷰 — Full-Project Audit

> 기준 커밋: `bbd838ef` (main)  
> 검토 일시: 2026-05-16  
> 범위: spec/, backend/, frontend/, packages/ 전체

---

### 발견사항

---

#### 기능 완전성 / 스펙 준수

- **[CRITICAL]** Re-run(재실행) 백엔드·프론트엔드 미구현
  - 위치: `backend/src/modules/executions/executions.controller.ts` (전체), `spec/5-system/13-replay-rerun.md`
  - 상세: spec `13-replay-rerun.md` 는 `POST /api/v1/executions/:executionId/re-run` 과 `GET .../chain` 을 정의하고 있으나, `ExecutionsController` 에 두 엔드포인트가 존재하지 않는다. Re-run 의 권한 가드(RR-PL-06), dry-run handler 분기, chain 깊이 32 제한, audit_log `re_run_initiated` 이벤트, rate limit, 프론트엔드 "Re-run" 버튼/모달/chain badge 모두 미구현이다. `plan/in-progress/replay-rerun.md` §3/4/5 항목 전체가 미체크(`[ ]`) 상태.
  - 제안: `replay-rerun.md` PR2 항목을 새 worktree 에서 진행. DB 마이그레이션(`re_run_of`, `chain_id` 컬럼)부터 선행.

- **[CRITICAL]** `Execution` 엔티티에 Re-run 추적 컬럼 누락 — spec/data-model 불일치
  - 위치: `backend/src/modules/executions/entities/execution.entity.ts:21-81`, `spec/5-system/13-replay-rerun.md §9.1`, `spec/1-data-model.md §2.13`
  - 상세: spec RR-PL-05 는 `re_run_of UUID NULL REFERENCES executions(id)` 와 `chain_id UUID NOT NULL` 두 컬럼을 요구하고, `plan/in-progress/spec-update-impl-prep-findings.md` C1 도 `1-data-model.md §2.13` 에 해당 컬럼이 빠졌음을 지적했다. Execution 엔티티에 두 컬럼이 없어 Re-run 구현 자체가 불가능한 전제 조건 누락이다.
  - 제안: TypeORM migration 으로 컬럼 추가 + `spec/1-data-model.md §2.13` 갱신 (C1 처리).

- **[CRITICAL]** AI Agent 일반 도구 연결(ND-AG-06/10/21) 의도적 제거 후 재설계 미결
  - 위치: `plan/in-progress/ai-agent-tool-connection-rewrite.md §1`, `spec/4-nodes/3-ai/1-ai-agent.md`
  - 상세: PRD 3 §6.1 / PRD 6 §3.2 의 ND-AG-06(Tool/Function 호출), ND-AG-10(Tool Area 드래그 앤 드롭), ND-AG-21(일반 도구 우선 실행) 이 config 스키마에서 의도적으로 제거된 채 재설계 대기 중이다. 도구 등록 모델·시그니처 위치·실행 컨텍스트·결과 라우팅 등 디자인 결정 항목이 모두 `[ ]` 미체크 상태. 사용자 가치가 큰 핵심 AI Agent 기능이 무기한 보류 중이다.
  - 제안: 도구 연결 모델 결정을 위한 사용자 합의를 우선 진행.

- **[WARNING]** Parallel 노드 `errorPolicy` schema 미노출 — P2 backlog
  - 위치: `backend/src/nodes/logic/parallel/parallel.schema.ts` (추정), `spec/4-nodes/1-logic/10-parallel.md §1`, `plan/in-progress/parallel-p2.md §1`
  - 상세: spec 이 `errorPolicy: stop | continue` 를 정의하고 `ParallelExecutor` 에도 구현되어 있으나, `parallelNodeConfigSchema` 에 노출되지 않아 다운스트림은 항상 기본값 `stop` 으로만 동작한다. spec 내 `⚠ 미구현 (P1)` 박스가 잔존. 동일 패턴으로 `waitAll: false` 도 schema 에는 있으나 엔진이 무시한다(사실상 dead field).
  - 제안: `parallel-p2.md §1` 처리 — schema 에 `errorPolicy` 노출 + `waitAll: false` 는 사용자 결정 후 schema 제거 또는 validate reject.

- **[WARNING]** Merge 노드 `timeout`/`partialOnTimeout` dormant — 명시적 경고 없음
  - 위치: `backend/src/nodes/logic/merge/merge.handler.ts:89-101`
  - 상세: `timeout > 0` 이거나 `partialOnTimeout=true` 로 설정된 Merge 노드가 실행되면 **warn 로그만** 출력되고 실제로는 아무 효과가 없다. 사용자가 config 에서 값을 설정했을 때 editor UI 가 이를 비활성(dormant)으로 표기하지 않으면 사용자 오해가 발생한다. `plan/in-progress/merge-p2-async-fanin.md` 의 선결 조건(엔진 비동기 모델)이 해소되지 않는 한 계속 dormant.
  - 제안: 프론트엔드 Merge 설정 패널에 해당 필드를 disabled + "(P2에서 활성화 예정)" 툴팁으로 표기하거나, merge.handler.ts 에서 validate 단계에 경고 룰 추가.

- **[WARNING]** 마켓플레이스 + 노드 플러그인 SDK 전체 미구현 — spec/nav 페이지 참조 분기 존재
  - 위치: `spec/2-navigation/8-marketplace.md`, `plan/in-progress/marketplace-and-plugin-sdk.md`
  - 상세: NAV-MP-01~07(마켓플레이스 UI), MP-CT/CS/PB-*(콘텐츠·소비·게시), ND-EX-01~03(커스텀 노드 SDK), NF-EX-04(플러그인 시스템)가 전체 미구현. i18n 사전에만 "Marketplace" 문자열이 존재. 내비게이션 스펙에 Marketplace 메뉴가 정의되어 있어 사용자에게 노출되지 않는 라우트 또는 미완성 화면이 보일 위험.
  - 제안: `0-unimplemented-overview.md` 권장 순서대로 Phase A (워크플로 템플릿 마켓) 부터 단계적 진행.

- **[WARNING]** Background 모니터링 API — plan 인덱스와 실제 구현 상태 불일치
  - 위치: `plan/in-progress/0-unimplemented-overview.md:54` ("❌ 미구현"), `backend/src/modules/executions/background-runs/background-runs.controller.ts`
  - 상세: `0-unimplemented-overview.md` §A 표와 §plan 목록에 `background-monitoring-api.md` 가 여전히 ❌ 미구현으로 표기되어 있으나, 실제로는 `BackgroundRunsController.findOne` (`GET /executions/:executionId/background-runs/:backgroundRunId`) 가 구현되어 있고 `plan/complete/background-monitoring-api.md` 로 이동 완료된 상태이다. 인덱스 문서가 stale하여 미구현 범위 판단을 오도한다.
  - 제안: `plan/in-progress/0-unimplemented-overview.md` §A 표에서 background 모니터링 API 항목을 ✅로 갱신 + `plan/` 목록에서 제거.

- **[WARNING]** `integration_action_required` 알림 프론트엔드 type-specific 처리 미구현
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §A-1`, `frontend/src/components/` (notification 관련 파일 미탐지)
  - 상세: backend `IntegrationActionRequiredNotifier` 가 `type='integration_action_required'` 알림을 발사하고, spec §11.2 는 재인증 단축 링크 버튼과 type 별 i18n 키(`notifications.types.integration_action_required.*`)를 정의하고 있으나, frontend 는 현재 type 을 generic 렌더링으로만 처리한다. 재인증 딥링크와 알림 inbox type 필터 옵션도 미구현.
  - 제안: `cafe24-backlog-residual.md §A-1` 의 미체크 항목 처리 — frontend notification 컴포넌트에 type-specific 분기 추가.

---

#### 데이터 유효성 / 엣지 케이스

- **[WARNING]** `spec/5-system/10-graph-rag.md §2.2` 의 `graph_extraction_status` Enum 에 `failed` 누락
  - 위치: `spec/5-system/10-graph-rag.md §2.2`, `plan/in-progress/spec-update-impl-prep-findings.md C2`
  - 상세: 동일 문서 §7·§3.2 에서 `failed` 상태를 이미 사용하고 있으나 §2.2 Enum 정의에 포함되지 않았다. 자체 모순. consistency-check 에서 이미 발견되어 C2로 추적 중이나 미처리.
  - 제안: `spec/5-system/10-graph-rag.md §2.2` Enum 목록에 `failed` 추가. `spec-update-impl-prep-findings.md` C2 체크.

- **[WARNING]** `callbackContextOf` 함수 — null/primitive 입력 엣지 미테스트
  - 위치: `backend/src/modules/integrations/integration-oauth.service.ts:170-175`
  - 상세: `callbackContextOf` 는 `err && typeof err === 'object'` 를 확인하지만 `null`(typeof null === 'object'), 배열, Date 등은 `'context' in null` 호출 전 guard 에서 걸린다. `err` 가 null 이면 `err &&` 에서 false 반환이지만, `plan/in-progress/cafe24-backlog-residual.md E-3` 에서 이미 단독 단위 테스트 부재를 지적하고 있다.
  - 제안: `E-3` 체크박스를 처리하여 null/primitive/배열 케이스 단위 테스트 추가.

- **[WARNING]** Cafe24 install endpoint `pending_install` 상태 보호 미명시
  - 위치: `plan/in-progress/spec-update-cafe24-test-connection.md §9.1`
  - 상세: `POST /api/integrations/:id/test` 에 `status='pending_install'` 인 integration 이 호출되면 `422 INTEGRATION_INCOMPLETE` 반환해야 하나, spec §2.2 가 UI 측 버튼 비활성만 명시하고 API 직호출 대비 spec 누락이다. 현재 직호출 시 어떤 응답이 반환되는지 불명확.
  - 제안: `spec-update-cafe24-test-connection.md §9.1/§14.1` 갱신 + 구현 확인.

---

#### TODO/FIXME/HACK 잔존

- **[WARNING]** `workflow.handler.ts` — 타입 계층 없이 메시지 패턴 매칭으로 에러 분류
  - 위치: `backend/src/nodes/flow/workflow/workflow.handler.ts:216-220`
  - 상세: `mapSubWorkflowError()` 함수가 `WorkflowNotFoundError` / `WorkflowTimeoutError` 인스턴스 체크 대신 에러 메시지 문자열을 소문자 매칭으로 분류한다. 코드에 `TODO: replace with instanceof WorkflowNotFoundError / WorkflowTimeoutError branches once WorkflowExecutor ships a typed error hierarchy` 주석이 존재. 메시지 문자열이 변경되면 silent regression 발생 위험.
  - 제안: `WorkflowExecutor` 에 typed error 계층 도입 후 `instanceof` 분기로 전환. 중간 대안으로 에러 코드 enum 첨부.

- **[INFO]** `review-workflow.ts` — ED-AI-39 legacy fallback 정리 필요
  - 위치: `backend/src/modules/workflow-assistant/tools/review-workflow.ts:716-718`
  - 상세: `TODO(ED-AI-39): legacy fallback 은 기존 세션의 pre-ED-AI-39 row 를 위한 방어다. 세션 메시지가 회전(retention)되면 조건의 !Array.isArray(...) 절을 제거` 주석이 있다. 세션 retention 이 완료된 시점을 추적하지 않으면 dead code 가 누적된다.
  - 제안: 세션 retention 정책에 따른 만료 일자를 주석에 명시하거나, 모니터링 알림으로 연결.

- **[INFO]** frontend `llm-configs.test.ts` — axios 인터셉터 적용 시 제거 예정인 fallback 계약
  - 위치: `frontend/src/lib/api/__tests__/llm-configs.test.ts:54`
  - 상세: `// TODO: response envelope 중앙화(axios 인터셉터) 적용 시 이 fallback 계약은 제거한다.` — 중앙화 작업이 완료되면 이 주석과 fallback 코드를 제거해야 하나 추적 plan 이 없다.
  - 제안: response envelope 중앙화 plan 에 이 테스트 fallback 제거를 후속 항목으로 추가.

---

#### 에러 시나리오 / 회복 흐름

- **[WARNING]** Cafe24 BullMQ refresh 실패 시 Sentry/외부 오류 추적 미정의
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §D-2`
  - 상세: `process()` 내부에서 `.catch(logger.error)` 패턴으로 BullMQ 재시도를 회피하도록 구현되어 있으나, 에러 격리 정책이 spec 에 명시되지 않았고 Sentry/Datadog 연동 검토도 미결(`[ ]`). 운영 중 refresh 실패가 조용히 사라질 위험이 있다.
  - 제안: `D-2` 항목 처리 — `process()` 에러 격리 정책을 spec 에 명시하고 외부 오류 추적 연동 여부 결정.

- **[WARNING]** `exchangeCodeForToken` / `refreshAccessToken` fetch 경로 단위 테스트 부재
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §B-5-8`
  - 상세: e2e 가 outbound mock 인프라 부담으로 보류 결정되었으나, unit/integration 으로 대체하는 `B-5-8 alt` 의 5개 시나리오((a) callback 성공, (b) invalid_grant, (c) atomic UPDATE, (d) 14일 idle 보호 회귀, (e) transport 3연속 실패)가 모두 미체크. 핵심 OAuth 경로의 실패 분기가 자동 검증 사각지대.
  - 제안: `cafe24-backlog-residual.md §B-5-8` 처리 — `backend/src/modules/integrations/cafe24/**.spec.ts` 에 mock fetch + fixture 기반 단위 테스트 추가.

---

#### 의도와 구현 간 괴리 / 문서-코드 정합

- **[WARNING]** `spec/5-system/10-graph-rag.md Rationale` 폐기된 경로 참조 잔존
  - 위치: `spec/5-system/10-graph-rag.md Rationale`, `plan/in-progress/spec-update-impl-prep-findings.md C3, C4`
  - 상세: `memory/graph-rag-decisions.md` (C3)와 `prd/*.md` 4건(C4)을 참조하는 링크가 spec 에 잔존한다. docs-consolidation(2026-05-12) 이후 폐기된 경로이므로 독자가 링크를 따라가면 404 또는 이전된 경로 불일치.
  - 제안: `spec-update-impl-prep-findings.md` C3/C4 처리 — 경로를 `plan/complete/archive/from-memory/` 실제 경로 또는 "역사 기록" 주석으로 갱신.

- **[WARNING]** API 경로 prefix 혼재 — `/api/v1/` vs `/api/`
  - 위치: `spec/5-system/2-api-convention.md`, `plan/in-progress/spec-update-impl-prep-findings.md W1`
  - 상세: spec 일부 문서가 `/api/v1/...` 을 정의하고 일부는 `/api/...` 를 기술한다. backend NestJS main prefix 설정과 일치하지 않는 spec 기술이 혼재하면 프론트엔드 API 클라이언트 경로 오류의 소지가 된다.
  - 제안: `spec/5-system/2-api-convention.md` 에 prefix 정책을 확정하고 전체 spec 경로를 통일. 실제 main.ts prefix 설정을 레퍼런스로 사용.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md` 및 `spec/5-system/_product-overview.md` 의 옛 flat review 경로 참조
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md:1273`, `spec/5-system/_product-overview.md:83`, `plan/in-progress/spec-paths-housekeeping-2026-05-16.md`
  - 상세: 두 파일이 `review/2026-04-24_18-27-09/` 및 `review/2026-05-05_a11y/` 등 옛 flat 경로를 참조하고 있으나 실제 경로는 nested ISO 형식으로 이관됐다.
  - 제안: `spec-paths-housekeeping-2026-05-16.md` 체크리스트 처리.

- **[INFO]** `0-unimplemented-overview.md` 의 plan 목록이 실제 `plan/in-progress/` 와 불일치
  - 위치: `plan/in-progress/0-unimplemented-overview.md:108-120`
  - 상세: 목록에 `background-monitoring-api.md` 가 여전히 표기되어 있으나 `plan/complete/` 로 이미 이동됨. `team-workspace-followups.md`, `accessibility-voiceover-validation.md` 도 `plan/in-progress/` 에 파일이 없음을 확인해야 한다.
  - 제안: `0-unimplemented-overview.md` §plan 목록을 현재 `plan/in-progress/` 실제 파일 기준으로 재동기.

---

#### 보안 요구사항 준수

- **[WARNING]** install endpoint IP 기반 rate limiting 미구현 (token oracle enumeration)
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §A-3`
  - 상세: 현재 `30 req/min` throttle 만 적용되어 있으며 IP 기반 추가 layer 가 없다. install_token oracle enumeration 방어 강화가 미처리(`[ ]`). install token 은 22자 base64url 으로 충분한 엔트로피를 가지지만, 레이트 제한 없이 여러 IP 에서 동시 시도 시 소수의 요청으로 유효 token 을 탐지할 수 있다.
  - 제안: `A-3` 처리 — nginx 또는 NestJS ThrottlerModule 에서 IP 기반 rate limit 추가 layer 적용.

- **[INFO]** Cafe24 신규 에러 코드 2종 Swagger `@ApiResponse` 미명시
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §D-1`
  - 상세: `CAFE24_INSTALL_INVALID_TOKEN(404)`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(409)` 가 구현에는 있으나 swagger 데코레이터에 명시되지 않아 API 문서 누락. 클라이언트 개발자가 이 응답 케이스를 놓칠 위험.
  - 제안: `D-1` 처리 — 관련 controller 에 `@ApiResponse` 데코레이터 추가.

---

#### plan 백로그 / 하네스 미해소

- **[WARNING]** i18n ko↔en dict parity 자동 가드 적용 여부 미확인 (harness-i18n plan P0)
  - 위치: `plan/in-progress/harness-i18n-userguide-gap.md`, `frontend/src/lib/i18n/__tests__/i18n.test.ts`
  - 상세: `harness-i18n-userguide-gap.md` §P0 항목("DONE (본 PR)" 표기)은 본 plan 이 완료된 PR 이 존재함을 의미하나, `harness-review-router-c4f1a2` worktree 가 진행 중으로 표기되어 있어 실제 main 브랜치 병합 여부가 불명확. parity 테스트가 main 에 미병합된 경우 신규 노드/필드 추가 시 ko/en dict 불일치가 자동으로 잡히지 않는다.
  - 제안: `harness-review-router-c4f1a2` worktree 상태 확인 → main 병합 완료 여부 검증 후 plan 상태 갱신.

- **[INFO]** `buildIntegrationMeta` cafe24 하드코딩 — 두 번째 provider 추가 전 레지스트리 패턴 필요
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §C-6`
  - 상세: 현재 cafe24 만 있어 문제 없으나 두 번째 OAuth provider 추가 직전 `Map<serviceType, (entity) => IntegrationMeta>` 로 전환해야 한다고 deferred 처리되어 있다. 시점 판단 기준이 없어 누락 위험.
  - 제안: `C-6` 항목에 "두 번째 provider 추가 PR 의 착수 시점에 동시 처리" 조건을 명시.

- **[INFO]** `isReauthorizeDisabled` 도메인 로직이 badge UI 컴포넌트에 위치
  - 위치: `plan/in-progress/cafe24-backlog-residual.md §C-3`
  - 상세: `frontend/src/components/integrations/status-badge.tsx` 에서 export 되어 있어 테스트 및 재사용이 어렵다.
  - 제안: `lib/integrations/utils.ts` 등 도메인 모듈로 이동.

---

### 요약

main 브랜치(`bbd838ef`) 기준 전체 코드베이스를 요구사항 관점에서 검토한 결과, **스펙에 확정된 Re-run(재실행) 기능의 Backend·Frontend 구현이 완전히 부재**하고 (`replay-rerun.md` PR2 미착수), **`Execution` 엔티티에 관련 컬럼(`re_run_of`, `chain_id`)도 없어** 데이터 모델과 코드가 불일치하는 Critical 2건이 확인됐다. AI Agent 일반 도구 연결(ND-AG-06/10/21) 역시 의도적 제거 후 설계 결정이 전혀 이루어지지 않아 핵심 AI 기능이 무기한 보류 중이다(Critical). 마켓플레이스·플러그인 SDK는 이미 인지된 미구현으로 plan에서 추적 중이다(Warning). Cafe24 영역에서는 `integration_action_required` 프론트엔드 type-specific 처리 누락, BullMQ refresh 에러 격리·Sentry 연동 미결, unit 테스트 5개 시나리오 사각지대, IP 기반 rate limit 미적용 등의 Warning이 다수 있다. spec 문서 측에서는 graph-rag Enum 자체 모순(C2), 폐기 경로 참조(C3/C4), API prefix 혼재(W1) 등이 consistency-check 에서 이미 식별됐으나 아직 미처리 상태다. `0-unimplemented-overview.md` 인덱스가 실제 구현 현황(background 모니터링 API ✅)과 불일치하여 미구현 범위 판단을 오도하고 있는 점도 즉시 정정이 필요하다. 전반적으로 병렬 worktree 작업으로 인한 드리프트가 spec-코드-plan 세 축에 걸쳐 누적되어 있으며, Re-run 기능과 Execution 엔티티 마이그레이션을 우선 처리하고, 이어 Cafe24 잔여 backlog 와 spec 문서 정합화를 순차 진행하는 것을 권장한다.

### 위험도

HIGH
