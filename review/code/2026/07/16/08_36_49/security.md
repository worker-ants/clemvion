# 보안(Security) Review

대상: AI Agent 도구 payload 예산 저장 시점(config-time) graph warning — `workflows.service.ts`/`.controller.ts`/`.module.ts`, `tool-payload-save-warning.ts`(신규), `tool-payload-budget.ts`(`toolBudgetStrictSave`), cafe24/makeshop tool-provider pure 함수 추출, e2e/spec/i18n 갱신.

## 발견사항

- **[WARNING]** saveCanvas 트랜잭션 내부에서 미배칭·미제한 순차 Integration 조회(+ 자격증명 복호화)가 실행됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas()` (L426 `this.dataSource.transaction(...)` 내부 L450 `await this.evaluateToolPayloadWarningsAndThrow(savedNodes, workspaceId)`) → `evaluateToolPayloadWarnings` → `tool-payload-save-warning.ts` `reproduceConfigToolDefs()` 의 `for (const ref of extractMcpServers(config))` 순차 루프 → `loadIntegrationForBudget()` → `integrationRepository.findOne(...)` (AES-256-GCM 복호화 트랜스포머 자동 적용).
  - 상세: `SaveCanvasDto`(`codebase/backend/src/modules/workflows/dto/save-canvas.dto.ts`)는 `nodes` 배열과 `config`(`@IsObject()`, 임의 shape)에 개수 상한이 없다. `config.mcpServers[]` 의 `integrationId` 개수만큼 **노드마다 순차적으로** `integrationRepository.findOne` 이 실행되며, 각 호출은 credentials JSONB 를 AES-GCM 복호화한다. 이 전체 루프가 `manager.save(Workflow/Node/Edge)` 가 이미 실행된, 아직 커밋되지 않은 **오픈 트랜잭션 안**에서 수행된다 — 게다가 `integrationRepository` 는 `manager`(트랜잭션 QueryRunner)가 아니라 클래스-레벨 기본 Repository 라 트랜잭션 커넥션과 별개의 풀 커넥션을 매 조회마다 사용한다. 코드 주석 자체가 "통합 조회는 트랜잭션 밖 커밋 데이터에 대한 read-only 라 rollback 무관" 이라고 명시하는데, 실제로는 트랜잭션 **밖이 아니라 안**에서 실행돼 커밋 전까지 Workflow/Node/Edge 행 잠금을 불필요하게 오래 유지한다. 동일 `integrationId` 가 여러 ai_agent 노드에서 재참조돼도 evaluation 1회 안에서 캐시/dedup 되지 않아 N+1 로 반복 복호화된다. 전역 body 파서는 100KB 로 제한되어 있고(`main.ts`) `saveCanvas` 는 `editor` role, 전역 100req/min throttle 이 걸려 있어 무제한 증폭은 아니지만, 100KB 페이로드 하나로도 수백 건의 `{integrationId: "<uuid>"}` 참조를 패킹해 단일 요청으로 수백 회의 순차 DB 왕복 + 복호화를 오픈 트랜잭션 안에서 유발할 수 있다. 동일 N+1 패턴이 `getGraphWarnings`(`viewer` role, GET, 조회 endpoint)에도 그대로 존재해 낮은 권한의 워크스페이스 멤버가 반복 호출로 부하를 유발할 수 있다(단, 저장 시 페이로드 상한으로 인해 이미 영속된 그래프 규모 자체는 간접적으로 bounded).
  - 제안: (1) 이 read-only 평가를 실제로 트랜잭션 **밖**(commit 이후 혹은 트랜잭션 진입 전 검증 단계)으로 이동 — 주석의 의도와 코드를 일치시킨다. (2) `mcpServers[].integrationId` 를 그래프 전체에서 한 번 수집해 `In()` 절 단일 쿼리로 배치 조회 + 평가 호출 내 메모이즈. (3) `SaveCanvasDto.nodes`/`config` 크기에 합리적 상한(`@ArrayMaxSize` 등)을 두어 단일 요청 비용의 상한을 명시적으로 보장.

- **[INFO]** `viewer` 권한 조회 endpoint 가 워크스페이스 통합 자격증명 복호화를 트리거
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` `graphWarnings()` (`@Roles('viewer')`) → `getGraphWarnings(id, workspaceId)` → `loadIntegrationForBudget`.
  - 상세: 이번 변경으로 `GET /workflows/:id/graph-warnings` (viewer 이상 누구나 호출 가능) 가 connected cafe24/makeshop 통합의 `credentials` 컬럼을 (기존 AES-256-GCM 트랜스포머로) 복호화해 메모리에 로드하게 됐다. 응답(`GraphWarningRuleResult[]`)에는 `credentials` 자체나 scope 목록이 포함되지 않고 byte 수·tool 수·provider group key(`mcp:<sid16>` — 기존에 이미 워크플로 config 에 노출된 integrationId 의 16자 prefix 재사용, 신규 정보 노출 아님)만 담겨 실질적 데이터 유출은 확인되지 않았다. 다만 이전에는 이 endpoint 가 통합 테이블을 전혀 건드리지 않았는데, 지금은 viewer 권한만으로도 반복 호출해 워크스페이스 내 모든 connected 통합의 자격증명 복호화를 유발할 수 있는 새로운 경로가 생겼다 — 크래시 덤프·에러 텔레메트리 등 2차 채널을 통한 노출 반경이 넓어질 여지가 있는지 확인 권장.
  - 제안: 현재 로직대로면 즉시 조치는 불필요하나, 향후 이 evaluation 결과에 필드를 추가할 때 `credentials`/`scopes` 원본이 실수로 흘러들어가지 않도록 회귀 테스트(현재 `tool-payload-save-warning.spec.ts` 는 `params` shape 만 검증)에 "credentials 미노출" 어서션을 명시적으로 추가하면 좋다.

- **[INFO]** cafe24/makeshop pure 추출 함수의 동작 동치성은 회귀 테스트로 보장됨 (참고, 조치 불필요)
  - 위치: `cafe24-mcp-tool-provider.ts`/`.spec.ts`, `makeshop-mcp-tool-provider.ts`/`.spec.ts` — `buildCafe24ToolDefsForIntegration`/`buildMakeshopToolDefsForIntegration` 추출.
  - 상세: cafe24 의 granted-scope 필터(`extractGrantedScopes`/`scopeForOperation`)가 신규 pure 함수에도 그대로 유지되어 있어, config-time 재현이 "권한 없는 scope 의 도구까지 노출"하는 사고는 없다. `buildTools`(런타임)과 `buildCafe24ToolDefsForIntegration`(config-time) 이 동일 tools 를 낸다는 회귀 테스트(`produces the exact same tools as buildTools for a connected integration`)가 drift 를 차단한다. makeshop 은 scope 축이 없다는 기존 설계(spec §8)를 그대로 따름 — 신규 취약점 아님.

- **[INFO]** best-effort fail-open 은 런타임 가드로 백스톱됨 (참고, 조치 불필요)
  - 위치: `tool-payload-save-warning.ts` `reproduceConfigToolDefs()` 의 `try { integration = await deps.loadIntegration(...) } catch { integration = null; }`.
  - 상세: Integration 조회 실패 시 해당 서버의 도구를 카운트에서 제외("best-effort skip")하는 fail-open 설계라, DB 일시 장애·malformed id 등으로 저장 시점 경고/차단(STRICT_SAVE)을 우회당할 수 있다. 그러나 실질 안전망은 별도로 존재하는 런타임 fail-fast(`TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `tool-payload-budget.ts`)이며 이는 이번 변경의 영향을 받지 않는다. 저장 시점 경고는 처음부터 "근사치 사전 경고"로 명시돼 있어(spec §4.2/§10) 설계 의도와 일치 — 보안 결함으로 분류하지 않음.

## 요약

이번 변경의 핵심 보안 통제(테넌트 격리)는 견고하다 — `getGraphWarnings`/`saveCanvas` 양쪽 모두 `workspaceId` 를 `loadIntegrationForBudget` → `integrationRepository.findOne({ where: { id, workspaceId } })` 까지 일관되게 전달해 워크스페이스 간 통합(IDOR) 조회를 차단하며, 이는 `workflows.service.spec.ts` 에 명시적으로 단위 테스트돼 있다. SQL 인젝션·하드코딩된 시크릿·인증 우회·불안전한 암호화 등 전통적 OWASP Top 10 항목에서는 문제를 발견하지 못했으며, 신규 코드는 기존 AES-256-GCM 자격증명 트랜스포머와 role 가드(`@Roles('editor'|'viewer')`)를 그대로 재사용한다. 다만 저장(`saveCanvas`) 트랜잭션 내부에서 미배칭·미상한(unbounded) 순차 Integration 조회+복호화를 수행하는 패턴이 새로 추가되어, 100KB body cap·throttle 등 기존 완화 장치로 인해 심각도는 낮지만 단일 요청 비용 증폭(락 보유 시간 연장, N+1 복호화) 관점의 자원 소모 이슈가 있다 — 병합 전 필수 차단 사유는 아니나 후속 개선을 권고한다.

## 위험도

LOW
