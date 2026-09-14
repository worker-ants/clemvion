# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep, trigger-config-lost-update)

## 검토 범위와 방법

전달된 `_prompts/convention_compliance.md` 번들은 컨텍스트 예산 초과로 `spec/5-system/` 17개 파일 중
**12개**(`4-execution-engine.md`·`6-websocket-protocol.md`·`7-llm-client.md`·`8-embedding-pipeline.md`·
`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·
`15-chat-channel.md`·`17-agent-memory.md`·`_product-overview.md`·`5-expression-language.md`·
`11-mcp-client.md`·`16-system-status-api.md` = 실제 15개)의 본문이 "의도된 절단"으로 생략됐고,
`spec/conventions/**` 도 `audit-actions.md`·`cafe24-api-catalog/_overview.md`·`category.md` 를 제외한
대부분(특히 이번 작업과 가장 밀접한 `chat-channel-adapter.md`·`secret-store.md`·`redis-keys.md`·
`node-cancellation.md`·`migrations.md` 등)이 생략됐다.

프롬프트 자체가 "생략 = 내용 없음의 근거로 삼지 말 것, 관련되면 Read 로 직접 열 것"을 명시하므로,
이번 작업(`trigger.config` 동시 PATCH lost-update)과 직결되는 아래 파일은 **워크트리에서 직접 Read** 했다:

- `spec/5-system/15-chat-channel.md` (전문 중 §4.1·§5.4·§5.4.1·§5.4.1.1·§5.4.1.2·Rationale R-CC-10~R-CC-24)
- `spec/conventions/chat-channel-adapter.md` (§1~§2.4)
- `spec/conventions/audit-actions.md`, `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`,
  `spec/conventions/spec-impl-evidence.md` (전문)
- 번들에 완전 포함된 `spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`

나머지 10개 이상의 stub 파일·수십 개의 stub convention(특히 cafe24/makeshop API 카탈로그 하위 트리
전부)은 이번 패스에서 **검증하지 못했다** — 아래 "요약"에 이 한계를 반영한다.

## 발견사항

검토한 범위 안에서는 **CRITICAL/WARNING 급 정식 규약 위반을 발견하지 못했다.** 아래는 확인한 근거와
INFO 성격의 관찰이다.

- **[INFO] 번들 예산 절단이 이 checker 의 커버리지를 구조적으로 제한한다**
  - target 위치: 전달 프롬프트 전체 (`spec/5-system/*.md` 15개, `spec/conventions/**` 대부분)
  - 위반 규약: 해당 없음 — 이것은 spec 위반이 아니라 **검토 파이프라인(오케스트레이터 번들링)의 한계**다
  - 상세: `feedback_consistency_spec_mode_budget.md` 에 기록된 것과 같은 클래스의 절단이 `--impl-prep`
    모드에도 나타난다. 이번 작업과 가장 밀접한 `chat-channel-adapter.md`(전 컨벤션)와
    `15-chat-channel.md`(전 spec)가 모두 stub 였다 — 직접 Read 로 우회했지만, 그 우회를 하지 않았다면
    이 checker 는 이번 작업의 핵심 표면을 전혀 보지 못하고 "위반 없음"을 거짓으로 보고했을 것이다.
  - 제안: 오케스트레이터가 `--impl-prep` 번들을 짤 때, 대상 작업의 plan 본문이 명시적으로 인용하는
    spec/convention 파일(`15-chat-channel.md`, `chat-channel-adapter.md` 등)은 예산 절단 우선순위에서
    **최후순위로 미루거나 별도 청크로 강제 포함**하는 것을 검토할 가치가 있다 (규약 자체보다 하네스
    개선 항목).

- **[INFO] 검증한 표면은 정식 규약과 정합** (구체 근거)
  - 감사 액션: `trigger.updated`·`trigger.chat_channel_bot_token_rotated`·`user.email_changed` 모두
    `spec/conventions/audit-actions.md` §1(`<resource>.<verb>`, 언더스코어 구분자)·§3 레지스트리(라인
    50/57/58)와 일치.
  - 에러 코드: `15-chat-channel.md` §5.4 표의 `VALIDATION_ERROR`·`RESOURCE_NOT_FOUND`·
    `WORKSPACE_ID_REQUIRED`·`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED` 등은
    `error-codes.md` §1 의미 기반 명명(UPPER_SNAKE_CASE, 구현 세부 비-각인) 원칙을 따르고,
    폐기된 `WORKSPACE_REQUIRED`(→`WORKSPACE_ID_REQUIRED`, `error-codes.md` §5 표)를 재사용하지
    않는다.
  - `field`/`code` 동반 규칙: `details.field` 를 실을 때 `details[].code`(`INVALID_FIELD`) 도 함께
    싣는다는 `2-api-convention.md §5.3` 규칙이 `15-chat-channel.md` §5.4.1·§5.4.1.1·§5.4.1.2 전
    지점에서 일관되게 인용·적용됨 (`#1317` 배선 전/후 상태를 명시적으로 구분해 문서화).
  - `code:` frontmatter 커버리지: `15-chat-channel.md` frontmatter 의
    `codebase/backend/src/modules/triggers/chat-channel-*.ts` glob 이 이번 작업이 건드릴
    `chat-channel-binder.service.ts` 를 실제로 매치함 (파일시스템 확인 완료) —
    `spec-impl-evidence.md` §3 `status: partial` 의 `code:` ≥1 매치 의무 준수.
  - DTO 명명: `chat-channel-adapter.md` §2.3~2.4, `15-chat-channel.md` §5.4.2 가 언급하는
    `ChatChannelConfigDto`/`ChatChannelUpdateConfigDto`/`ChatChannelRotateBotIdentityDto` 류는
    `swagger.md §1-7`(top-level `Update` 접두 vs nested `<Domain><Role>Dto` 로컬 패턴) 및 §5-1
    (응답 DTO 클래스명 전역 유일성) 규칙과 정합.
  - 문서 3섹션 구조: 직접 확인한 `2-api-convention.md`(Overview §~Rationale) ·
    `audit-actions.md`/`error-codes.md`/`swagger.md`/`spec-impl-evidence.md`(모두 `## Overview` ~
    `## Rationale`) 는 CLAUDE.md 가 권장하는 Overview/본문/Rationale 3섹션 구조를 따른다.
  - `pending_plans` 오분류 없음: 이번 작업의 plan(`trigger-config-lost-update.md`, `spec_impact: none`)
    이 `15-chat-channel.md` frontmatter `pending_plans:` 에 없는 것은 위반이 아니다 —
    `spec-impl-evidence.md §2.1`의 `pending_plans` 는 "그 spec 이 아직 구현 안 된 surface 를
    책임지는 plan"만 의무 대상이고, 이번 plan 은 **이미 구현된 기능의 동시성 버그 수정**(신규
    surface 약속 아님)이라 대상 범주가 다르다.

## 요약

이번 패스에서 실제로 열람·대조한 표면(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 전문,
`15-chat-channel.md`·`chat-channel-adapter.md`·`audit-actions.md`·`error-codes.md`·`swagger.md`·
`spec-impl-evidence.md` 직접 Read)에서는 명명·에러 코드·감사 액션·DTO 패턴·frontmatter 커버리지·
문서 3섹션 구조 어느 축에서도 정식 규약 위반을 찾지 못했다. 다만 오케스트레이터가 전달한 번들
자체가 `spec/5-system/` 15개 파일과 `spec/conventions/` 대부분(특히 카탈로그 하위 트리 전량)을
예산 초과로 절단했기 때문에, 이번 보고는 "절단된 나머지 표면까지 위반이 없다"를 보장하지 못한다 —
가장 관련 높은 두 파일(`15-chat-channel.md`, `chat-channel-adapter.md`)만 직접 Read 로 보완했다.

## 위험도

LOW
