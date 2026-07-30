# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

## 검토 범위 및 방법

prompt_file 에는 `spec/5-system/1-auth.md` · `10-graph-rag.md` · `11-mcp-client.md` 3개 파일만
전문 포함되고, 나머지 `spec/5-system/` 14개 파일(`2-api-convention.md`·`3-error-handling.md`·
`4-execution-engine.md`·`5-expression-language.md`·`6-websocket-protocol.md`·`7-llm-client.md`·
`8-embedding-pipeline.md`·`9-rag-search.md`·`12-webhook.md`·`13-replay-rerun.md`·
`14-external-interaction-api.md`·`15-chat-channel.md`·`16-system-status-api.md`·
`17-agent-memory.md`·`_product-overview.md`)와 `spec/conventions/` 다수(특히
`node-cancellation.md`·`error-codes.md`·`node-output.md`·`swagger.md`·`audit-actions.md`·
`6-websocket-protocol.md` 등)는 컨텍스트 예산 초과로 생략되어 있었다. "생략 = 문제 없음" 으로
단정하지 말라는 지시에 따라, 현재 워크트리(`retry-atomic-claim-4d9e77`)의 실제 파일을 `Read`/`grep`
으로 직접 열어 위 생략분을 보완했다 — 특히 이번 작업(`retry_last_turn` 원자 claim, cf.
`plan/in-progress/retry-turn-terminal-guard.md` P1 항목)과 직접 관련된
`4-execution-engine.md`(§1.1/§1.2/§7.4/§7.5) · `node-cancellation.md` · `node-output.md` ·
`error-codes.md` · `6-websocket-protocol.md §4.2` · `swagger.md` · `audit-actions.md` 는 전문을
직접 대조했다. 다만 `spec/conventions/cafe24-api-catalog/**`(258개) 등 이번 작업과 무관도가 높은
대용량 하위트리는 표본 확인에 그쳤다.

## 발견사항

- **[WARNING] `2-api-convention.md` §12.1 상태 토글 예시가 실제 wire 계약과 반대 케이스를 씀**
  - target 위치: `spec/5-system/2-api-convention.md` §12.1 "상태 토글 패턴" (파일 22행대 본문 기준
    L386-403 부근, 예시 JSON `{ "is_active": false }` 및 "적용 대상 | `is_active`
    (Workflow, Trigger, Schedule), `is_disabled` (Node), `is_read` (Notification)" 행)
  - 위반 규약: 이 문서 자신이 spec/5-system 전역 API 응답/요청 포맷의 SoT 이며(§2.5 wrapping,
    §5.2 목록 응답 등 다른 절은 `spec/conventions/swagger.md` §2-5·§5 가 그대로 인용해 재사용하는
    수준으로 정식 규약과 동격 취급된다), 여기서 정의하는 **wire 필드 예시가 실제 구현·타 spec 문서와
    불일치**한다.
  - 상세: 실제 DTO 소스(`codebase/backend/src/modules/triggers/dto/{create,update}-trigger.dto.ts`,
    `.../schedules/dto/{create,update}-schedule.dto.ts`, `.../workflows/dto/{create,update}-workflow.dto.ts`)
    는 전부 camelCase `isActive?: boolean` 다. `spec/2-navigation/2-trigger-list.md` R-4/R-16,
    `spec/2-navigation/3-schedule.md`, `spec/data-flow/10-triggers.md §1.4`,
    `spec/7-channel-web-chat/5-admin-console.md` 등 **동일 엔드포인트**(`PATCH /api/triggers/:id`,
    `PATCH /api/schedules/:id`)를 다루는 5개 이상의 문서가 전부 `{ isActive: boolean }` (camelCase)
    로 일관되게 기술한다. 그런데 정작 이 패턴의 **정의처**인 `2-api-convention.md` §12.1 은
    `{ "is_active": false }` (snake_case, DB 컬럼명 그대로) 를 wire 예시로 제시하고, "적용 대상"
    표까지 `is_active`/`is_disabled`/`is_read` 로 snake_case 표기해 자기 자신의 실제 근거 문서들과
    반대다. `error-codes.md` §3 historical-artifact 레지스트리처럼 의도된 예외라면 그렇게
    명시돼야 하는데, 그런 등재도 없다 — 즉 오기(誤記)로 보인다.
  - 제안: `2-api-convention.md` §12.1 예시·표를 camelCase(`{ "isActive": false }`,
    `isActive`/`isDisabled`/`isRead`)로 정정한다. project-planner 소관(`spec/` 변경)이며, 신규
    toggle 필드를 추가하는 개발자가 이 절을 문자 그대로 템플릿으로 복사하면 실제 DTO 관례과
    어긋나는 snake_case wire 필드를 도입할 위험이 있다.

- **[WARNING] `spec/5-system/` 6개 파일이 `## Overview` 헤딩 없이 바로 본문(§1)으로 시작**
  - target 위치: `spec/5-system/11-mcp-client.md:19`(`## 1. 개요`) ·
    `spec/5-system/16-system-status-api.md:14`(`## 1. 대상 큐 레지스트리` — Overview 동가
    헤딩 자체가 없음) · `spec/5-system/2-api-convention.md:22`(`## 1. 기본 원칙`) ·
    `spec/5-system/5-expression-language.md:18`(`## 1. 개요`) ·
    `spec/5-system/6-websocket-protocol.md:22`(`## 1. 연결`) ·
    `spec/5-system/7-llm-client.md:26`(`## 1. 개요`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "## Spec 문서 구조 (3섹션 권장)" 표가
    명시하는 `## Overview (제품 정의)` 헤딩(CLAUDE.md 의 "Spec 문서 3섹션 구성" 교차 참조)과,
    같은 디렉터리의 11개 형제 파일(`1-auth.md`·`3-error-handling.md`·`4-execution-engine.md`
    → `## Overview`; `10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·
    `14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`·
    `8-embedding-pipeline.md`·`9-rag-search.md` → `## Overview (제품 정의)`) 가 실제로 따르는
    다수 관행.
  - 상세: `spec/5-system/` 의 `_product-overview.md` 아닌 17개 파일 중 11개(65%)는 `## Overview`
    또는 `## Overview (제품 정의)` 헤딩으로 시작하지만, 나머지 6개(35%)는 이 헤딩 없이 바로
    번호 매긴 본문(`## 1. …`)으로 진입한다. `16-system-status-api.md` 는 리드 문단(L12)이
    Overview 에 해당하는 내용을 담고 있으나 헤딩 자체가 없다. 이번 작업이 직접 다루는
    `4-execution-engine.md` 는 정상적으로 `## Overview` 를 갖고 있어 실제 구현 착수에 지장은
    없으나, 스코프가 `spec/5-system/` 전체인 본 impl-prep 검토 기준으로는 규약 편차다. CRITICAL 로
    올리지 않은 이유: 어떤 하네스 스크립트도 이 리터럴 헤딩 문자열을 파싱해 동작하는 근거를
    찾지 못했다(`.claude/tests/test_consistency_impl_done.py` 의 "## Overview" 는 격리된 임시
    fixture 문자열일 뿐 실제 파일을 참조하지 않음) — 즉 invariant 파손이 아니라 문서 일관성
    편차다.
  - 제안: 6개 파일에 `## Overview` 헤딩을 리드 문단 위에 추가(내용은 이미 존재하는 리드
    문단/§1 요약으로 충분한 경우가 많음)하거나, 이 6개가 "레퍼런스/프로토콜 문서" 성격이라
    의도적으로 다른 구조를 쓰는 것이라면 `project-planner/SKILL.md` 의 3섹션 규약에 그 예외
    범주(예: 프로토콜 사양형 문서)를 명시해 향후 반복 flag 를 방지한다.

## 확인했으나 문제 없음 (positive findings — 참고용)

- `spec/5-system/1-auth.md` §1.5.4 의 `lower_snake_case` 초대 에러 코드는
  `spec/conventions/error-codes.md` §3 historical-artifact 레지스트리에 정확히 등재되어 있고
  범위("초대 API 한정")도 양쪽이 일치한다.
- `spec/5-system/1-auth.md` §4.1 감사 액션 카탈로그(`integration.*`/`user.*`/`auth_config.*`/
  `workspace.*`/`member.*`/`execution.re_run`/Planned 목록)는 `spec/conventions/audit-actions.md`
  §3 도메인별 분류 레지스트리와 완전히 정합 — resource dot-prefix, verb 시제 3분류, 언더스코어
  토큰 구분자 모두 일치.
- `spec/5-system/11-mcp-client.md` §5.2 도구 이름 규칙(`mcp_<sid>__<toolName>` 등)·§8.2 에러
  코드 vocabulary(`MCP_*` UPPER_SNAKE_CASE, `INVALID_TOOL_ARGUMENTS` prefix-less 예외 포함)는
  `error-codes.md` §1 "prefix-less 공용 코드" 각주와 정확히 대응한다.
- `spec/5-system/10-graph-rag.md` §7 의 `reextract_status` atomic CAS 패턴(`WHERE …='idle'`,
  0행 → `409 KB_REEXTRACT_IN_PROGRESS`)은 `spec/5-system/8-embedding-pipeline.md` §7.3.2 의
  `reembed_status` 패턴과 SQL 형태·네이밍·이벤트 계열까지 완전히 대칭이라, 향후 `retry_last_turn`
  원자 claim 구현 시 참고할 선례가 이미 내부적으로 일관돼 있다(단 이 CAS-lock 패턴은 "상호배제
  잠금" 용도이고, `retryLastTurn`/`claimResumeEntry` 계열은 "단일 소유권 claim" 용도라 목적이
  다르며 이는 정상적 분리다).
- `spec/conventions/node-cancellation.md` §6 구현 현황 표(2026-07-28 갱신)는 `retry-turn.service.ts`
  의 `finalizeGuarded` terminal guard 를 정확히 반영하고 있고, `spec/5-system/4-execution-engine.md`
  §1.1/§1.2/Rationale 도 동일 사실을 일관되게 서술한다 — 직전 라운드(retry-turn-terminal-guard
  plan #1024)에서 지적된 `spec_impact: none` 자기모순·spec 자기모순(park 없는 cancel 보존 서술)은
  이미 project-planner 위임으로 해소된 상태(`spec-update-node-cancellation-shutdown-classification.md`
  #8)이며 본 검토에서도 재확인상 정합하다.
- `execution.retry_last_turn` WS 명령(`spec/5-system/6-websocket-protocol.md` §4.2)의 에러 코드
  (`RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/`RETRY_TOO_EARLY`/`INVALID_EXECUTION_STATE`)는
  전부 UPPER_SNAKE_CASE 로 `error-codes.md` §1 원칙을 따른다 — 향후 원자 claim 실패 시 신규
  코드를 추가한다면 동일 컨벤션을 따르면 된다.
- `spec/5-system/` 17개 파일 전부 CLAUDE.md 의 파일명 컨벤션(`N-name.md` 또는
  `_product-overview.md`) 을 따른다 — 이탈 없음.

## 요약

`spec/5-system/`(및 이번 작업이 직접 관련되는 `spec/conventions/node-cancellation.md`·
`error-codes.md`·`node-output.md`)은 전반적으로 정식 규약과의 정합도가 높다. 명명 규약(에러 코드
UPPER_SNAKE_CASE·historical-artifact 예외 등재, 감사 액션 `<resource>.<verb>` 3분류, MCP 도구
명명)과 출력 포맷 규약(WS 이벤트 payload, node-output 5필드/echo 규칙)은 표본 검증한 범위에서
위반을 발견하지 못했고, `retry_last_turn` 원자 claim 착수에 필요한 `4-execution-engine.md`
§1.1/§1.2/§7.4/§7.5 와 `node-cancellation.md` §2.4/§6 은 최신 상태로 상호 정합해 개발 착수를
막을 요인이 없다. 다만 두 건의 WARNING 을 확인했다 — (1) `2-api-convention.md` §12.1 의 상태
토글 wire 예시가 실제 구현·타 문서와 반대 케이스(snake_case vs 실제 camelCase)를 쓰고 있어
향후 신규 toggle 필드 작성 시 오도할 소지가 있고, (2) `spec/5-system/` 17개 중 6개 파일이
project-planner SKILL.md 가 명시하는 `## Overview` 헤딩 관행을 따르지 않는다. 두 건 모두 현재
가동 중인 다른 시스템의 invariant 를 깨지는 않으나(코드는 이미 올바르게 camelCase 이고, Overview
헤딩 부재를 파싱하는 하네스도 없음), 문서 신뢰도와 향후 일관성을 위해 정정이 바람직하다.

## 위험도

LOW
