# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 대상 변경 set

`main...HEAD` (branch `claude/ai-agent-tool-payload-followups-6472a9`, 커밋 60a80fda2·7231f7006·e9d7f676d·808017aaf) — 19개 파일. AI Agent "도구 정의 payload 예산" 의 **저장 시점(config-time) graph warning** (`ai_agent:tool-payload-budget`) 신설. 순수 backend 로직(WorkflowsService async 통합 조회, cafe24/makeshop provider 의 pure 함수 추출) + i18n 매핑 + spec 정합 + e2e. frontend TSX/dict/docs MDX 파일은 이번 변경 set 에 전혀 포함되지 않음.

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 19개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (118~140행) 을 SoT 로 사용.

## 발견사항

없음 — 매트릭스 trigger 매칭 결과 CRITICAL/WARNING 급 동반 갱신 누락을 찾지 못함. 아래는 매칭 검토 상세.

### 매칭된 trigger와 검증 결과

- **`new-warning-code` / "신규 warningCode 발행"** (semantic) — 이 변경은 정확히는 `warningRules` mini-DSL 이 아니라 cross-node `graphWarningRules` 메커니즘(`GraphWarningRuleResult`, ruleId `ai_agent:tool-payload-budget`)을 신설한다. 동일 원칙(영문 SoT → ko 매핑 필수)이 적용되는 대응 맵은 `WARNING_KO` 가 아니라 `GRAPH_WARNING_KO` (`codebase/frontend/src/lib/i18n/backend-labels.ts:643`) 이며, 이 changeset 안에서 이미 등록됨:
  - `codebase/backend/src/nodes/ai/ai-agent/tool-payload-save-warning.ts:38` — `AI_AGENT_TOOL_PAYLOAD_BUDGET_RULE_ID = 'ai_agent:tool-payload-budget'`
  - `codebase/frontend/src/lib/i18n/backend-labels.ts:643` — `GRAPH_WARNING_KO["ai_agent:tool-payload-budget"]` 한국어 템플릿(`{{node}}`/`{{bytes}}`/`{{toolCount}}`/`{{budget}}` 보간) 등록
  - `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:304` — `BACKEND_ONLY_GRAPH_WARNING_RULE_IDS` 명시 목록에 동일 ruleId 등록 (P3-C-1 가드가 `GRAPH_WARNING_RULES_BY_TYPE` 자동 스캔 사각지대를 이 수동 목록으로 커버)
  - 세 위치의 문자열이 정확히 일치함을 grep 으로 확인. `npx vitest run backend-labels.test.ts spec-frontmatter.test.ts spec-code-paths.test.ts` 793 테스트 전부 통과.
  - 결론: 누락 없음.

- **`spec-major-change` / "spec 신규/대규모 변경"** (glob `spec/4-*/**`, `spec/conventions/**`) — `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/cross-node-warning-rules.md` 갱신됨. `cross-node-warning-rules.md` 는 `status: partial → implemented` 로 승격하며 `code:` 글로브에 신규 파일 `tool-payload-save-warning.ts` 를 추가(≥1 매치 보장), `pending_plans:` 에서 완료된 plan 항목 제거. `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` 통과 확인. 두 spec 문서 모두 "⚠ 구현 현황(Planned)" 문구를 제거하고 실제 배선(`getGraphWarnings` append / `saveCanvas` 차단)을 정확히 서술 — 텍스트 갱신 확인.

### 매칭되지 않거나 회색지대로 판단해 제외한 trigger

- **`new-node` / `node-schema-change`** (glob `codebase/backend/src/nodes/**`) — 변경 파일이 이 glob 에 다수 매치하지만(`tool-payload-budget.ts`, `tool-payload-save-warning.ts`, `tool-providers/{cafe24,makeshop}-mcp-tool-provider.ts`), 실질은 (a) provider 내부에서 인스턴스 메서드였던 스키마 빌더를 module-level pure 함수로 승격한 리팩터(`buildCafe24JsonSchema`, `buildCafe24ToolDefsForIntegration` 등)와 (b) 신규 backend-only async warning 평가 로직 추가다. `ai_agent.schema.ts` / `ai_agent.component.ts` 는 diff 에 없음(`git diff main...HEAD` 로 확인) — 노드의 필드·라벨·placeholder 는 전혀 바뀌지 않았다. PROJECT.md 가 명시한 "노드 내부 helper 만 변경" 회색지대 예시에 해당해 FieldTable(`02-nodes/ai.mdx`)·dict 갱신 의무는 발생하지 않는 것으로 판단.
- **`new-ui-string`** — 이번 changeset 에 `*.tsx` 파일 없음. i18n Principle 3-C(동적 메시지 params)는 `GRAPH_WARNING_KO` 항목으로 적용됐고 위에서 확인.
- **`integration-provider-change`** — cafe24/makeshop provider 파일이 바뀌었지만 provider 자체의 동작(연결·인증·스코프)이 아니라 기존 도구 정의 매핑을 pure 함수로 추출한 리팩터이며 `06-integrations-and-config/{cafe24,makeshop}.mdx` 가 다루는 사용자 절차(연결 방법·스코프 안내)에는 영향이 없다. 미매칭으로 판단.
- **`new-userguide-section-dir`**, **`auth-session-flow-change`**, **`expression-language-change`**, **`run-debug-flow-change`**, **`AuthConfig type enum 변경`**, **`new-bullmq-queue`**, **`new-cross-cutting-enum`**, **`new-backend-ui-zod-value`**, **`new-handler-output-field`** — 해당 경로/의미 모두 미매칭.
- **`new-error-code`** — `GRAPH_VALIDATION_FAILED` 는 기존 코드 재사용(신규 `ErrorCode` enum 값 아님). `error-codes.ts` 는 diff 에 없음. 미매칭.

## 요약

매트릭스 19개 trigger 중 이번 changeset 에 실질 매칭된 것은 `new-warning-code`(변형: graphWarningRules) 1건과 `spec-major-change` 1건이며, 두 trigger 모두 middle column 이 요구하는 동반 갱신(`GRAPH_WARNING_KO` ko 매핑 + P3-C-1 가드 목록 등록, spec frontmatter `status`/`code`/`pending_plans` 정합)이 **동일 changeset 안에서 이미 완료**돼 있고 관련 guard test(`backend-labels.test.ts`, `spec-frontmatter.test.ts`, `spec-code-paths.test.ts`) 793건이 실측 통과했다. `node-schema-change`/`new-node`/`integration-provider-change` 는 glob 상 스친 파일이 있으나 실질 내용(내부 helper 리팩터, 신규 backend-only warning)이 사용자 가시 필드/라벨/절차를 바꾸지 않아 미해당으로 판단했다. frontend TSX·dict·docs MDX·locale.ts 파일이 changeset 에 전혀 없어 i18n parity·신규 섹션 등록 관점의 위험도 없음. 누락 0건.

## 위험도

NONE
