# 정식 규약 준수 검토 — spec/5-system/

검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`)
검토 대상: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` (prompt 에 전문 번들) + 실제 diff 대상 `spec/5-system/14-external-interaction-api.md` · `spec/5-system/4-execution-engine.md` · `spec/5-system/5-expression-language.md`
대조 규약: `spec/conventions/audit-actions.md` · `spec/conventions/error-codes.md` · `spec/conventions/node-output.md` · `spec/conventions/swagger.md` · `spec/conventions/spec-impl-evidence.md` · `spec/conventions/cafe24-api-catalog/**`(prompt 번들, 참고용)

> **방법론 메모**: prompt payload 가 전문 번들한 target 은 `1-auth.md`·`10-graph-rag.md` 두 파일이었으나, `git diff origin/main -- spec/5-system/` 실측 결과 이번 PR 이 실제로 건드린 파일은 `14-external-interaction-api.md`·`4-execution-engine.md`·`5-expression-language.md`(+ scope 밖 `data-flow/7-llm-usage.md`) 였다. 두 세트 모두를 검토 대상에 포함했다.

---

## 발견사항

- **[INFO]** `2-api-convention.md` 가 다수 정식 규약의 SoT 로 인용되나 `spec/conventions/` 바깥에 위치
  - target 위치: `spec/5-system/1-auth.md` §1.4.3(`[API 규약 §5]` 링크), §5 API 엔드포인트 표 각주 다수
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — `정식 규약 → spec/conventions/<name>.md`
  - 상세: `spec/5-system/2-api-convention.md`(응답 envelope·HTTP status 선택 규칙)는 `error-codes.md §Overview`·`swagger.md §2-5·§5-2`·`audit-actions.md` 등 여러 `spec/conventions/*.md` 문서가 "SoT" 로 직접 인용하는 사실상의 정식 규약이지만, 파일 자체는 `spec/5-system/` 아래 있다. 다만 이는 이번 PR 이 새로 만든 상태가 아니라 이미 정착된 기존 배치이며, 다수의 `spec/conventions/*.md` 가 일관되게 이 위치를 참조하고 있어 실질적인 정합성 문제(dead link, 이중 SoT)는 없다.
  - 제안: 신규 위반이 아니므로 즉시 조치 불요. 다만 `project-planner` 가 향후 `spec/conventions/` 구조를 정리할 기회가 있으면 "API 응답 envelope·HTTP status" 를 `spec/conventions/api-response-format.md` 등으로 승격하는 것을 검토할 만하다 (본 검토의 CRITICAL/BLOCK 사유는 아님).

- **[INFO]** `deepRedactSecrets` 재사용 확인 — 신규 재구현 아님 (긍정 확인, 조치 불요)
  - target 위치: `spec/5-system/14-external-interaction-api.md` (diff) — "`nodeOutput.conversationConfig` + terminal `result`/`error`" 항목
  - 위반 규약: 없음 — 오히려 준수 사례
  - 상세: 이번 diff 가 `getStatus` REST 응답의 terminal `result`/`error` 마스킹에도 `deepRedactSecrets` 를 재사용한다고 명시한다. `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`SECRET_LEAK_PATTERNS` 보유 SoT)에 정의된 동일 함수이며, `ai-turn-orchestrator.service.ts`·`interaction.service.ts`·`thread-renderer.ts` 등 기존 호출자와 동일 경로다. 사용자 메모리 규약("에러 메시지 토큰 마스킹은 `sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` 재사용, 새로 구현 금지")을 정확히 따른다.
  - 제안: 없음 (준수 확인용 기록).

---

## 준수 확인 항목 (위반 아님 — 대조 근거 기록)

아래는 검토 관점 1~5 에 대해 명시적으로 대조·확인했으며 **위반이 발견되지 않은** 항목이다. False negative 방지를 위해 근거를 남긴다.

1. **문서 구조 (Overview/본문/Rationale)** — `1-auth.md`(`## Overview` → `## 1~5` 본문 → `## Rationale`)·`10-graph-rag.md`(`## Overview (제품 정의)` → `## 1~8` 본문 → `## Rationale`) 모두 `project-planner/SKILL.md §Spec 문서 구조` 의 3섹션 패턴 준수. `10-graph-rag.md` 의 `## Overview (제품 정의)` 표기는 SKILL.md 예시 표기와 문자 그대로 일치. `## 1. 개요` 중복처럼 보이는 헤더는 `11-mcp-client.md`·`5-expression-language.md`·`8-embedding-pipeline.md`·`7-llm-client.md`·`9-rag-search.md` 등 `spec/5-system/` 전역에서 반복되는 확립된 하우스 스타일(Overview 섹션 = PRD, `## 1. 개요` = 기술 본문 도입)이라 이탈 아님.
2. **Frontmatter (spec-impl-evidence.md)** — `1-auth.md` (`status: partial` + `pending_plans: [plan/in-progress/spec-sync-auth-gaps.md]`, 파일 실존 확인)·`10-graph-rag.md` (`status: implemented`, `code:` 다수 매치)는 §2/§3 스키마·라이프사이클 규칙을 만족.
3. **감사 액션 명명 (audit-actions.md)** — `1-auth.md §4.1` "현재 구현된 액션"·"Planned" 두 표의 모든 액션(`integration.*`/`workspace.*`/`member.*`/`execution.re_run`/`auth_config.*`/`user.*`/Planned `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)이 `audit-actions.md §3 도메인별 분류 레지스트리` 와 **1:1로 정확히 일치** (verb 시제 분류·언더스코어 토큰 구분자 포함). dot-prefix 누락 없음.
4. **에러 코드 명명·historical-artifact 등록 (error-codes.md)** — `1-auth.md §1.5.4` 의 `lower_snake_case` 초대 흐름 에러 코드(`invitation_not_found` 등, `forbidden`/`rate_limited` 포함)는 `error-codes.md §3 Historical-artifact 예외 레지스트리` 에 정확히 등재·상호 링크되어 있다. 그 외 신규 코드(`WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`, `NOT_A_MEMBER`, `KB_REEXTRACT_IN_PROGRESS` 등)는 모두 `UPPER_SNAKE_CASE` + 의미 기반 명명(§1) 준수.
5. **API 응답 envelope / 비-페이징 고정 컬렉션** — `1-auth.md` `GET /api/auth/2fa/webauthn/credentials` 의 `{ data: { items: [...] } }` 응답과 `/auth/2fa/webauthn/availability` 의 `{ enabled }` → `TransformInterceptor` 래핑 서술은 `swagger.md §2-5·§6·Rationale`(비-페이징 고정 컬렉션 pass-through) 및 `2-api-convention.md §5.2` 와 정합.
6. **WebSocket 이벤트 명명·payload 캐이싱 (node-output.md 인접 관례)** — `10-graph-rag.md §6` 의 `document:graph_started/_progress/_completed/_retry/_failed` 는 기존 `document:embedding_started/_progress/_completed/_retry/_failed`(`8-embedding-pipeline.md`) 와 동일한 `<resource>:<domain>_<verb>` 패턴·camelCase payload 키(`documentId`, `entityCount` 등)를 그대로 따른다. `document:graph_error` 가 union 타입에만 선언되고 실제 emit 되지 않는다는 사실을 spec 이 스스로 명시(dead-declared 고지)해 은폐 없음.
7. **Swagger/DTO 표기 규약과의 상충 없음** — target 문서는 스펙 산문이라 데코레이터·DTO 코드는 직접 포함하지 않으나, 서술된 계약(`writeOnly`/`readOnly` 패턴이 필요한 비밀번호·토큰류를 요청 바디로만 언급, 응답 DTO 에는 마스킹된 필드만 언급)이 `swagger.md §1-5·§5-1` 의무와 상충하지 않는다.
8. **문서 제목 규약** — `# Spec: <이름>` 프리픽스가 `1-auth.md`/`10-graph-rag.md`/`9-rag-search.md`/`8-embedding-pipeline.md`/`2-api-convention.md` 전역에서 일관.
9. **cafe24-api-catalog 번들 대조** — prompt 가 함께 번들한 `spec/conventions/cafe24-api-catalog/**` 는 target(`spec/5-system/`)과 도메인이 무관하여 직접 대조 대상이 아니었다(리소스 카탈로그 자체 정합성은 자체 sync 테스트 `catalog-sync.spec.ts` 소관). target 문서에서 cafe24 카탈로그 명명 패턴을 오용하거나 혼동한 사례는 없다.

---

## 요약

`spec/5-system/1-auth.md`·`10-graph-rag.md` 를 중심으로 명명 규약(감사 액션·에러 코드)·출력 포맷 규약(API 응답 envelope·WebSocket 이벤트 payload)·문서 구조 규약(Overview/본문/Rationale, frontmatter lifecycle)·API 문서 규약(swagger 응답 래퍼 패턴)·금지 항목(dot-prefix 누락, non-UPPER_SNAKE 신규 코드) 다섯 관점을 모두 대조했다. 감사 액션 카탈로그는 `audit-actions.md` 레지스트리와 완전히 일치하고, 초대 흐름의 `lower_snake_case` 에러 코드는 `error-codes.md` 의 historical-artifact 예외로 정확히 등재·상호 링크돼 있으며, WebSocket 이벤트·응답 envelope 표기도 기존 확립 패턴(`document:embedding_*`, 비-페이징 고정 컬렉션 pass-through)을 그대로 따른다. 실제 diff 대상(`14-external-interaction-api.md` 등)도 신규 마스킹 유틸을 만들지 않고 기존 `deepRedactSecrets`(SECRET_LEAK_PATTERNS SoT)를 재사용해 사용자 규약을 준수했다. CRITICAL/WARNING 급 위반은 발견하지 못했으며, `2-api-convention.md` 가 `spec/conventions/` 바깥에서 사실상 정식 규약 SoT 역할을 하는 점만 구조적 INFO 로 기록한다(신규 위반 아님, 기존 정착 배치).

## 위험도

NONE
