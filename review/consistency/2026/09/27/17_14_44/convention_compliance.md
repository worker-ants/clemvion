# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 모드: `--impl-prep` (scope=`spec/2-navigation/`). 대상 정식 규약: `spec/conventions/**`.

## 검토 범위와 한계

`spec/2-navigation/` 은 파일 18개(`_product-overview.md`·`_layout.md`·`0-dashboard.md`·1~16 번호 파일)로
구성된다. 조립된 프롬프트는 컨텍스트 예산 때문에 **3개 파일만 전문**을 실었다
(`2-trigger-list.md` · `1-workflow-list.md` · `3-schedule.md`) — 나머지 15개는 절단 고지만 있었다.
본 검토는:

- 위 3개 파일은 **본문·Rationale 전체**를 읽고 관련 `spec/conventions/*.md` 원문과 대조했다.
- `6-config.md` 는 절단 목록에 있었으나 PATCH null 처리 plan(`patch-null-validation`, 최근 커밋
  `e76ef570e`/`6acc4dbc5`)과의 관련성이 높아 저장소에서 **직접 전문**을 읽었다.
- 나머지 14개 파일(`_product-overview.md`·`_layout.md`·`0-dashboard.md`·`4-integration.md`·
  `5-knowledge-base.md`·`7-statistics.md`·`8-marketplace.md`·`9-user-profile.md`·`10-auth-flow.md`·
  `11-error-empty-states.md`·`13-user-guide.md`·`14-execution-history.md`·`15-system-status.md`·
  `16-agent-memory.md`)는 frontmatter(`id`/`status`/`code`/`pending_plans`)와
  `../conventions/*.md` 상호참조 앵커만 grep 으로 대조했고, 본문 전체를 정독하지 않았다.
  **"이 범위에서 못 찾았다" 는 "위반이 없다" 와 다르다** — 이 14개 파일의 세부 위반 가능성은
  이 보고서로 배제되지 않는다.

## 대조한 정식 규약

`error-codes.md` · `secret-store.md` · `swagger.md`(§1-3~1-7, §5) · `chat-channel-adapter.md`(§2.3) ·
`audit-actions.md` · `review-citations.md` · `spec-impl-evidence.md`(§1·§2) · `data-hydration-surfaces.md` ·
`egress-masking.md` · `user-guide-evidence.md` · `cafe24-restricted-scopes.md` · `cafe24-api-metadata.md`.

## 발견사항

전 3개 전문 검토 파일 + `6-config.md` + 나머지 14개 파일의 frontmatter/앵커 대조에서
**CRITICAL·WARNING 급 위반을 찾지 못했다.** 아래는 실제로 대조해 **일치를 확인한** 근거이며,
동시에 검토가 실측 기반임을 보이기 위해 정리한다.

- **[INFO] 검토 범위가 3+1/18 파일로 제한됨**
  - target 위치: `spec/2-navigation/` 전체 18 파일 중 4개만 전문 검토
  - 위반 규약: 해당 없음 (범위 고지)
  - 상세: 위 "검토 범위와 한계" 참고. 나머지 14개는 frontmatter·앵커만 확인했다.
  - 제안: 이 14개 파일에 대한 정식 규약 준수 결론이 필요하면 별도 라운드에서 전문 검토가 필요하다.

- **[관찰 — 위반 아님] `secret-store.md` §1.1 (응답 바디 노출 금지) 과 완전 정합**
  - target 위치: `2-trigger-list.md` §2.3.1 Chat Channel `botToken`/`uiMapping.*` 행, §174
    "내부 ref (`botTokenRef`, `inboundSigningRef`) 는 사용자에게 노출하지 않음 — `hasBotToken: boolean` 만 응답에 포함"
  - 근거: `secret-store.md` §1.1 "ref 도 대상이다 — 평문은 아니지만 내부 저장 위치를 드러낸다" ·
    `swagger.md` §1-5 (`writeOnly`/`readOnly` 의무 패턴)
  - 실측: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 등 실제 DTO 를
    열람하지 않고도 spec 서술 자체가 규약 문언과 정확히 일치. 코드 대조도 1건 수행—
    `TriggerDto.workflow` 필드가 `@ApiPropertyOptional({ type: () => TriggerWorkflowRefDto }) workflow?: TriggerWorkflowRefDto`
    로 선언돼 있어 spec §3 "키 생략형(§5.4 기준 (b))" 서술과 `swagger.md` §1-4 의 옵셔널 필드
    선언 패턴이 코드와도 일치했다.

- **[관찰 — 위반 아님] `swagger.md` §1-7 (`Update` 접두 범위) 준수**
  - target 위치: `2-trigger-list.md` §3 "SoT: `update-trigger.dto.ts`"
  - 실측: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts` 의 클래스명은
    `UpdateTriggerDto` — top-level 요청 바디 DTO 접두 규칙과 일치.

- **[관찰 — 위반 아님] `audit-actions.md` §2·§3 (verb 시제 3분류·레지스트리) 와 문자 그대로 일치**
  - target 위치: `2-trigger-list.md` §3 API 표, "감사: `trigger.chat_channel_bot_token_rotated`" /
    "`trigger.notification_secret_rotated`" / "`trigger.interaction_token_revoked`"
  - 근거: `audit-actions.md` §3 레지스트리 행 "trigger | 과거분사 (§2.1) |
    `notification_secret_rotated`, `chat_channel_bot_token_rotated`, `interaction_token_revoked` | 구현 (2026-08-11)"
    과 정확히 동일한 세 액션명 — dot-prefix·언더스코어 토큰 구분·과거분사 규칙 모두 일치.

- **[관찰 — 위반 아님] `chat-channel-adapter.md` §2.3 `ChatChannelConfig` 필드명과 일치**
  - target 위치: `2-trigger-list.md` §2.3.1 "`uiMapping.formMode`" / "`uiMapping.visualNode`" /
    "`rateLimitPerMinute`" / "`languageHints`" 행, 각각 `../conventions/chat-channel-adapter.md#23-chatchannelconfig` 인용
  - 근거: 컨벤션 원문의 `ChatChannelConfig` interface 필드명(`uiMapping.formMode`/`visualNode`/`buttonLayout`,
    `rateLimitPerMinute`, `languageHints`)과 완전 일치, enum 값(`multi_step`/`native_modal`/`auto`,
    `text`/`photo`/`auto`)도 동일.

- **[관찰 — 위반 아님] `review-citations.md` §2 (날짜 포함 인용) 준수**
  - target 위치: `4-integration.md` 3곳의 `review/code/…`·`review/consistency/…` 인용
    (예: `review/code/2026/09/20/18_09_24 requirement INFO 6`)
  - 근거: 전부 "전체 경로"(연-월-일-시각) 형식 — bare `hh_mm_ss` 금지 규칙(§2) 위반 없음.

- **[관찰 — 위반 아님] `spec-impl-evidence.md` §2.1 `id` 충돌 회피 규칙의 실제 적용 사례**
  - target 위치: `16-agent-memory.md` frontmatter `id: nav-agent-memory`
  - 근거: 컨벤션 §2.1 이 예시로 든 그 자체 케이스("`spec/5-system/17-agent-memory.md` 가
    `agent-memory` 를 점유 → `spec/2-navigation/16-agent-memory.md` 는 `nav-agent-memory`")를
    실측으로 확인 — `spec/5-system/17-agent-memory.md` 의 `id: agent-memory` 와 충돌 없이
    분리돼 있다. `spec/2-navigation/` 의 다른 17개 파일 `id` 도 모두 basename 매칭 원칙을 따른다.

- **[관찰 — 위반 아님] `error-codes.md` §1 (의미 기반·UPPER_SNAKE_CASE) 준수**
  - target 위치: `2-trigger-list.md`/`1-workflow-list.md`/`3-schedule.md`/`6-config.md` 전역의
    `VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`RESOURCE_NOT_FOUND`·`AUTH_CONFIG_NOT_FOUND`·
    `BOT_TOKEN_INVALID`·`DUPLICATE_NODE_LABEL`·`MODEL_CONFIG_INVALID`·`ADMIN_REQUIRED`
  - 근거: 전부 `UPPER_SNAKE_CASE` + 의미 기반 명명(구현 세부·일시적 범위 미포함) — §1 원칙 위반 없음.
    `TRIGGER_ENDPOINT_PATH_CONFLICT`(§3 `details.code`)도 도메인 prefix 원칙(§1 "권장")에 부합.

## 요약

`spec/2-navigation/2-trigger-list.md` · `1-workflow-list.md` · `3-schedule.md` (전문) 와
`6-config.md` (직접 열람)를 `spec/conventions/**` (secret-store, swagger, error-codes,
audit-actions, chat-channel-adapter, review-citations, spec-impl-evidence 등)와 문장 단위로
대조한 결과, 명명·출력 포맷·문서 구조·API 문서 규약·금지 항목 다섯 관점 모두에서
**CRITICAL/WARNING 급 위반을 찾지 못했다.** 오히려 여러 지점(감사 액션명 3종, DTO 클래스명,
필드 옵셔널 선언, secret ref 비노출, `nav-agent-memory` id 충돌 회피)에서 spec 서술이 컨벤션
원문·실제 코드와 문자 그대로 일치함을 확인했다 — 이 영역은 최근 라운드에서 규약을 상당히
꼼꼼히 따라 갱신된 것으로 보인다. 다만 `spec/2-navigation/` 18개 파일 중 14개는 컨텍스트 절단으로
frontmatter·상호참조 앵커만 대조했고 본문 전체를 정독하지 못했으므로, 그 14개 파일에 대한
"위반 없음" 은 본 보고서가 보증하지 않는다 — 필요하면 별도 라운드에서 직접 열람해야 한다.

## 위험도

LOW
