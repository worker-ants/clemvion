# 정식 규약 준수 검토 — `spec/5-system/`

- 검토 모드: `--impl-prep`
- 대상 범위: `spec/5-system/`
- 대상 정식 규약: `spec/conventions/**`

## 검토 범위상 제약

전달된 payload 는 `spec/5-system/` 18개 파일 중 **`1-auth.md`, `10-graph-rag.md` 2개 파일만 전문 포함**되어 있었다(payload 크기 제한으로 추정 — `grep '^#### \`spec/5-system'` 결과 2건). 나머지 16개 파일(`2-api-convention.md`, `3-error-handling.md`, `4-execution-engine.md`, `6-websocket-protocol.md`, `11-mcp-client.md`, `12-webhook.md` 등)은 payload 에 없어 본 검토에서 직접 대조하지 못했다. 다만 교차 참조 검증을 위해 리포지토리의 실제 `spec/conventions/*.md` (`error-codes.md`, `node-output.md`, `audit-actions.md`, `spec-impl-evidence.md`, `swagger.md`), `spec/5-system/8-embedding-pipeline.md`, 구현 코드(`audit-action.const.ts`, `webauthn.config.ts`)를 직접 Read 하여 대조했다. **이 커버리지 갭 자체를 INFO 로 별도 기록**한다.

---

### 발견사항

- **[INFO]** 검토 payload 가 `spec/5-system/` 전체가 아닌 2개 파일만 포함
  - target 위치: 전달된 payload 구조 (`spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` 만 전문 인용)
  - 위반 규약: 해당 없음 (payload 구성 문제, 규약 위반 아님)
  - 상세: `--impl-prep` 범위가 `spec/5-system/` 디렉토리 전체로 선언되었으나, 실제 대조 가능했던 파일은 2개뿐이었다. 나머지 16개 파일에 `error-codes.md`/`node-output.md`/`audit-actions.md` 위반이 있는지는 이번 세션에서 확인되지 않았다.
  - 제안: 후속 세션에서 나머지 파일(`2-api-convention.md`, `3-error-handling.md`, `4-execution-engine.md`, `6-websocket-protocol.md`, `11-mcp-client.md`, `12-webhook.md`, `13-replay-rerun.md`, `14-external-interaction-api.md`, `15-chat-channel.md`, `16-system-status-api.md`, `17-agent-memory.md`, `5-expression-language.md`, `7-llm-client.md`, `9-rag-search.md`)을 별도 배치로 나눠 재검토 권장.

- **[INFO]** `8-embedding-pipeline.md` §WS 이벤트 표와 `10-graph-rag.md §6` 사이의 이벤트 개수 표기 drift
  - target 위치: `spec/5-system/8-embedding-pipeline.md` (line 293 부근, "6개 이벤트가 추가 emit" 서술)
  - 위반 규약: 직접적인 `spec/conventions/**` 위반은 아니나, "출력 포맷 규약"(WS 페이로드 정확성) 관점에서 문서 간 self-consistency 이슈
  - 상세: `8-embedding-pipeline.md` 는 `document:graph_started`/`_progress`/`_completed`/`_error`/`_retry`/`_failed` **6개**가 emit 된다고 서술하지만, `10-graph-rag.md §6`(KB-GR-OB-02 항목, line 143 및 line 551)은 `document:graph_error` 가 `websocket.service.ts` 타입 union 에만 선언되고 실제로는 **emit 되지 않는(dead-declared)** 5개만 emit 된다고 명시한다. 두 문서가 동일 이벤트 패밀리를 다르게 카운트한다.
  - 제안: `8-embedding-pipeline.md` line 293 을 "6개 선언 중 5개 emit(`_error` 는 dead-declared)"로 정정하거나 `10-graph-rag.md` §6 각주를 인용하는 pointer 로 교체.

### 확인된 준수 사항 (참고, 위반 아님)

아래는 검토 중 확인한 정합 사례 — 문제 없음을 명시해 향후 재검토 시 중복 조사를 줄이기 위해 기록한다.

- **명명 규약 — 감사 액션**: `1-auth.md §4.1` 의 구현된 액션 목록(`integration.*`, `workspace.transfer_ownership`, `execution.re_run`, `auth_config.*`, `user.*`)이 `spec/conventions/audit-actions.md` §1(`<resource>.<verb>` dot-prefix, 언더스코어 토큰)·§2(시제 3분류)·§3(레지스트리)와 정확히 일치하며, 구현 코드 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 의 `AUDIT_ACTIONS` 상수와도 1:1 대조 확인됨. Planned 액션의 dot-prefix 정규화(`user.password_changed` 등, §Rationale 4.1.A)도 규약과 부합.
- **금지 항목 예외 — historical-artifact 명시**: `1-auth.md §1.5.4` 의 초대 흐름 `lower_snake_case` 에러 코드(`invitation_not_found` 등, `forbidden`/`rate_limited` 포함)는 `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에 정확히 등재되어 있고, "신규 코드는 본 예외를 선례로 삼지 않는다"는 명시적 경고까지 포함 — 규약이 요구하는 예외 처리 절차를 정확히 따름.
- **문서 구조 규약**: `1-auth.md`, `10-graph-rag.md` 모두 `## Overview` (또는 `## Overview (제품 정의)`) → 본문(`## 1.` ~) → `## Rationale` 3섹션 구조를 준수. frontmatter 도 `id`/`status`/`code`(+`status: partial` 인 `1-auth.md` 는 `pending_plans` 포함)로 `spec/conventions/spec-impl-evidence.md §2.1` 스키마를 충족하며, `pending_plans` 경로(`plan/in-progress/spec-sync-auth-gaps.md`)도 실존 확인.
- **WebSocket 이벤트 명명**: `10-graph-rag.md §6` 의 `document:graph_*` (콜론+언더스코어) 표기는 `6-websocket-protocol.md` 의 실행 채널 dot-표기(`execution.snapshot` 등)와 다르지만, 이는 규약 위반이 아니라 `8-embedding-pipeline.md` §"KB 단위→문서 단위 전환" 각주(line 411)에 문서화된 **의도적인 별도 이벤트 패밀리**(KB/embedding/graph 계열은 `document:` 콜론 표기로 이미 정착) — 두 표기 체계가 공존하는 것이 기존 결정.
- **API 엔드포인트 명명**: `1-auth.md §5`, `10-graph-rag.md §5` 의 REST 경로(`/api/auth/...`, `/api/knowledge-bases/:id/...`)는 `2-api-convention.md` 의 RESTful·kebab-case 관례와 일치.

### 요약

전달된 payload 기준으로 검토 가능했던 `spec/5-system/1-auth.md`·`10-graph-rag.md` 2개 파일은 명명 규약(감사 액션 dot-prefix/시제 3분류), 에러 코드 historical-artifact 예외 처리, 문서 3섹션 구조, frontmatter 스키마, WebSocket 이벤트 명명 등 대조 가능한 모든 항목에서 `spec/conventions/**` 와 정합했다. CRITICAL/WARNING 급 위반은 발견되지 않았다. 다만 (1) payload 가 `spec/5-system/` 전체가 아닌 2개 파일만 담아 나머지 16개 파일은 이번 세션에서 대조되지 못한 커버리지 갭이 있고, (2) `8-embedding-pipeline.md` 와 `10-graph-rag.md` 사이에 WS 이벤트 개수 표기가 사소하게 어긋나는 self-consistency 이슈가 있어 이를 INFO 2건으로 기록한다.

### 위험도

LOW
