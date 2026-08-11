# 정식 규약 준수 검토 — trigger 감사 액션 3종 신규 (2026-08-11)

대상: `spec/5-system/1-auth.md §4.1`, `spec/conventions/audit-actions.md §3`, `spec/5-system/15-chat-channel.md`,
`spec/5-system/14-external-interaction-api.md`, `spec/2-navigation/2-trigger-list.md`, `spec/data-flow/1-audit.md`
+ 구현 (`codebase/backend/src/modules/audit-logs/audit-action.const.ts`,
`codebase/backend/src/modules/triggers/{triggers.service.ts,triggers.controller.ts,*.spec.ts}`)

검토 기준: `spec/conventions/audit-actions.md` (§1 `<resource>.<verb>` 구조 + 언더스코어 토큰, §2.1
과거분사 기본, §2.2 CRUD 현재형 예외, §2.3 도메인 고유 동사) 및 `spec/5-system/2-api-convention.md §2.2`
(URL RPC sub-channel 예외).

## 발견사항

Critical 없음.

- **[INFO]** `trigger.interaction_token_revoked` 의 verb 가 "재발급" 효과의 절반만 표현
  - target 위치: `spec/conventions/audit-actions.md §3` 레지스트리 하단 note "`interaction_token_revoked` 만 `revoked` 인 것은 의도다" (신규, 2026-08-11) / `spec/5-system/1-auth.md §4.1` 동일 note / 구현 `triggers.service.ts:946` `revokePerTriggerToken`
  - 위반 규약: 없음 — `audit-actions.md §2` "분류 기준은 verb 의 성격" 원칙을 확장 해석한 **문서화된 설계 결정**이라 §1/§2 구조 자체를 어기지 않는다.
  - 상세: 실제 동작은 `revokePerTriggerToken` 이 이전 토큰을 즉시 무효화하면서 **동시에 새 `itk_*` 토큰을 발급해 평문으로 반환**한다(`triggers.service.ts:966~980`) — 기능적으로는 `notification_secret_rotated`/`chat_channel_bot_token_rotated` 와 동일하게 "구 자격증명 폐기 + 신규 발급" 이며, 유일한 차이는 **grace 유예(0h vs 24h)** 다. 그런데 액션명은 "revoked" 만 담아 신규 발급 효과를 텍스트에서 드러내지 않는다 — 이는 `auth_config.regenerate`(신규 값 생성을 verb 에 명시)와 비대칭적이다. 감사 로그만 보는 독자가 "재발급됐다"는 사실을 놓칠 수 있다.
  - 다만 이 지적은 규약 위반이 아니라 **표현의 정밀도** 문제이고, `audit-actions.md §3` 에 정확히 이 트레이드오프(24h grace 공존 vs 즉시 무효화)를 근거로 명시해 두었으므로 — 요구되는 "의도였다면 규약 자체를 갱신" 이 이미 같은 커밋에서 수행됐다. 추가 조치 불요, 참고용 기록.
  - 제안: 조치 불요. 향후 유사 사례(재발급 vs 회전) 재검토 시 이 note 를 참조점으로 삼을 것.

- **[INFO]** `trigger` 리소스 레지스트리 행이 동일 패턴(§2.1)으로 2행 분리
  - target 위치: `spec/conventions/audit-actions.md §3` 표, `trigger | 과거분사 (§2.1) | created, updated, deleted | 구현` 행과 바로 아래 `trigger | 과거분사 (§2.1) | notification_secret_rotated, ... | 구현 (2026-08-11)` 행
  - 위반 규약: 없음
  - 상세: `workspace` 의 2행 분리(§2.3 vs §2.1, 서로 다른 패턴)와 달리 `trigger` 의 2행은 **동일 패턴**(§2.1)을 두 번 쓴다. 다만 "상태" 열에 구현 일자가 다르게 기재돼(무표기 vs `2026-08-11`) CRUD 생애주기와 특권 회전/폐기 작업을 시각적으로 구분하는 의도가 읽히므로 표 구조상 문제는 아니다.
  - 제안: 조치 불요(가독성 목적의 의도적 분리로 판단).

## 정합성 확인 (근거 기록)

- **명명 구조 (§1)**: `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked` 모두 `<resource>.<verb>` — dot-prefix 필수 충족, 다어절 토큰은 전부 언더스코어(`notification_secret`, `chat_channel_bot_token`, `interaction_token`) — 하이픈·camelCase 없음. 준수.
- **시제 분류 (§2.1)**: 세 verb 모두 "목적어 + 과거분사" 합성 과거분사(`scope_changed`·`email_changed` 와 동형)이며 레지스트리도 §2.1 로 정확히 분류. `trigger` CRUD(`created`/`updated`/`deleted`)와 verb 시제가 일관돼 §2 의 "같은 resource 안 CRUD 계열 혼용 금지" 조항과도 충돌 없음(§2.2 현재형 전환 필요 없음 — 세 verb 모두 과거분사로 자연스러움).
- **`interaction_token_revoked` 만 다른 동사인 것의 정당성**: `spec/conventions/audit-actions.md §3` note 가 "24h grace 로 구·신 공존(dual-accept `_v2` 컬럼) vs per_trigger 는 유예 컬럼 없이 즉시 무효화"를 근거로 제시. 코드 실측(`triggers.service.ts` — `notification_secret_v2`/`chat_channel_token_v2` 컬럼은 존재, `interaction` 설정에는 그런 유예 컬럼이 없고 `triggerToken` 필드를 즉시 덮어씀)과 일치 — 서술이 사실에 부합.
- **액션명의 sub-channel 인코딩**: 레지스트리 note 가 "한 액션+details 로 흡수"(`integration.rotated`) 대 "대상별 개별 액션"(`user.password_changed`/`email_changed`/...) 두 선례를 모두 인용하고, 여기서는 자격증명이 3종(무효화 대상·blast radius 상이)이라 `user.*` 선례를 따른다고 명시 — 근거 있는 선택이며 규약이 어느 쪽도 강제하지 않는다는 §3 서술과 일치.
- **`chat-channel.rotate-bot-token` → `trigger.chat_channel_bot_token_rotated` 정정 (`spec/5-system/15-chat-channel.md:378`)**: 원문("이 자리에 `chat-channel.rotate-bot-token` 이라 적혀 있었다")이 지적한 3가지 위반 — (a) resource dot-prefix 미충족(하이픈 결합 `chat-channel.rotate-bot-token` 은 `<resource>.<verb>` 가 아니라 `<resource-with-hyphen>.<verb-with-hyphen>`), (b) 언더스코어 대신 하이픈 사용, (c) `chat-channel` 이 감사 모델에 존재하지 않는 resource — 는 모두 정확한 진단이다. 세 회전 엔드포인트가 전부 `/api/triggers/:id/...` 하위이므로 resource 는 `trigger` 가 맞고, 정정된 `trigger.chat_channel_bot_token_rotated` 는 실제 `AUDIT_ACTIONS.TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 상수·`triggers.service.ts:1116` 호출·`triggers.service.spec.ts:1774` 테스트와 문자열까지 정확히 일치. **정정은 옳다.**
- **URL 경로 vs 감사 액션의 표기 불일치(하이픈 vs 언더스코어)는 별도 정식 규약**: `/api/triggers/:id/chat-channel/rotate-bot-token` 등 URL 은 `spec/5-system/2-api-convention.md §2.2` 의 "RPC-style sub-channel action" 예외(케밥 케이스, 정확히 이 세 엔드포인트를 예시로 등재)를 따르고, 감사 액션은 `audit-actions.md §1` 의 언더스코어 규약을 따른다 — 서로 다른 네임스페이스에 서로 다른 정식 규약이 적용되므로 표기가 다른 것은 규약 위반이 아니다(`audit-actions.md §3` note 도 이 비대칭을 인지하고 명시).
- **구현-스펙 일치**: `AUDIT_ACTIONS` 상수 3개, `triggers.service.ts` 3개 호출부, `triggers.service.spec.ts` 3개 테스트 문자열이 spec 문서(§4.1, `audit-actions.md §3`, `2-trigger-list.md`, `14-external-interaction-api.md`, `data-flow/1-audit.md`)에 기재된 액션명과 완전히 일치. 인라인 문자열 없이 전부 `AUDIT_ACTIONS.*` 상수 경유(§1 "인라인 문자열 금지" 준수).
- **frontmatter/구조**: `audit-actions.md`(`id`/`status: implemented`/`code:` 프론트매터, Overview→본문→Rationale 3섹션) 구조 이상 없음. `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록에 이번 diff 가 건드린 `triggers.controller.ts`/`triggers.service.ts` 가 이미 등재돼 있어 갱신 불요.

## 요약

신규 감사 액션 3종(`trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`,
`trigger.interaction_token_revoked`)은 `spec/conventions/audit-actions.md` 의 구조(§1 dot-prefix·
언더스코어)·시제 분류(§2.1 합성 과거분사)를 모두 충족하며, `interaction_token_revoked` 만 다른 동사를
쓴 이유(즉시 무효화 vs 24h grace 공존)도 코드 실측과 일치하는 근거로 §3 에 명문화됐다. 액션명이
sub-channel 을 담는 설계도 기존 `user.*`/`integration.*` 두 선례 중 정당한 쪽을 택했다고 규약 자체에
근거를 남겼다. `spec/5-system/15-chat-channel.md:378` 의 `chat-channel.rotate-bot-token` → 정본 액션명
정정은 resource dot-prefix·구분자·resource 존재 여부 세 가지 위반을 정확히 진단하고 올바르게 고쳤으며,
정정된 값은 구현 상수·호출부·테스트와 문자 그대로 일치한다. URL 경로(케밥)와 감사 액션(스네이크)의
표기 차이는 서로 다른 정식 규약(`2-api-convention.md §2.2` vs `audit-actions.md §1`)이 적용된 결과라
위반이 아니다. 발견된 두 항목은 모두 INFO 등급으로, 규약 위반이 아니라 표현 정밀도에 대한 참고 기록이며
이미 같은 커밋에서 규약(Rationale)에 근거가 남아 추가 조치가 필요하지 않다.

## 위험도

NONE
STATUS: OK
