# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done)

검토 범위: 프롬프트 번들이 전문을 준 `spec/2-navigation/2-trigger-list.md`(frontmatter+본문+Rationale 전체) ·
`spec/2-navigation/3-schedule.md`(동일). 나머지 15개 영역 파일(`1-workflow-list.md`, `4-integration.md`,
`5-knowledge-base.md`, `6-config.md`, `8-marketplace.md`, `9-user-profile.md`, `_layout.md`,
`_product-overview.md` 등)은 컨텍스트 예산 절단으로 본문이 프롬프트에 없었으므로, 필요한 대목은
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/user-entity-column-defense`)에서 절대경로로
직접 `Read`/`grep` 해 확인했다 — 해당 파일들에 대해 "위반 없음"을 확보 없이 단언하지 않는다.

전제: 이 PR 은 `spec/2-navigation/**` 을 **변경하지 않았다**(diff-base `origin/main` 대비 델타 0개
파일 — 정상, 코드 전용 PR). 다만 같은 스코프의 백엔드 diff(`triggers.service.ts`,
`workspace-response.dto.ts` 등)가 이 문서들이 이미 서술해 둔 계약을 구현/보강했으므로, 아래는
"문서가 서술한 계약 ↔ `spec/conventions/**` 정식 규약" 정합성 확인이며 이 PR 이 spec 문서를 잘못
고쳤다는 뜻이 아니다.

이 세션은 이미 다수 라운드(`00_01_16`~`15_53_00`)의 `/consistency-check` 를 거쳤다. 직전 라운드
(`15_53_00`)가 남긴 결론(LOW, CRITICAL 없음, 개방 항목은 전부 `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 등재)을 1차로 재확인하고, 그 사이 새 커밋이 target scope 에 신규 규약 위반을 추가했는지를
2차로 확인했다. 결론: **신규 위반 없음**. 기존 개방 항목은 전부 여전히 미수정 상태로 남아 있고
(developer 는 `spec/` 쓰기 권한이 없어 정상), 전량 plan 에 정확히 추적돼 있다.

## 발견사항

- **[WARNING]** frontmatter `status: implemented` 가 본문 §3 의 미구현 자백과 모순 (재확인 — 기존 개방)
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter 3행(`status: implemented`, `pending_plans:` 없음) vs §3 API 표 151행 "⚠️ `PaginationQueryDto` 가 `sort`/`order` 를 받긴 하나 `findAll` 은 이를 무시하고 `created_at DESC` 로 고정 정렬한다. sort/order 반영은 미구현/Planned"
  - 위반 규약: [`spec/conventions/spec-impl-evidence.md §3`](../../../../../../spec/conventions/spec-impl-evidence.md) — `status: implemented` 는 "모든 약속 구현 완료"를 요구하고 `pending_plans:` 는 없어야 한다. 본문이 자백하는 미구현 surface(sort/order)가 있으면 `status: partial` + `pending_plans:` 이어야 한다.
  - 상세: 자매 문서 `3-schedule.md` 가 정확히 같은 상황(§4 GET /api/schedules sort/order)을 이미 겪었고, Rationale "sort/order 쿼리 반영 — '미구현/Planned' 표기 해제 (2026-06-10)"에서 **구현을 마친 뒤에야** Planned 표기를 해제했다 — 이것이 올바른 선례다. `2-trigger-list.md` 는 아직 그 반대쪽(구현 전에 `implemented` 로 표기)에 머물러 있다. `spec-status-lifecycle.test.ts` 가드는 `partial`의 `pending_plans` 누락만 검사하고 "`implemented`인데 본문이 미구현을 자백"하는 이 형태는 잡지 못하므로, 자동 가드가 아니라 사람이 잡아야 하는 자리다.
  - 이미 추적됨: `plan/in-progress/spec-draft-nullable-notation-followups.md` 507~516행 (planner 턴, `review/consistency/2026/09/06/15_31_00` W3 인용).
  - 제안: `status: partial` + `pending_plans:` 등록, 또는 sort/order whitelist 정렬을 구현하고 `implemented` 를 유지 — 어느 쪽이든 다음 planner 턴에서 처리.

- **[WARNING]** `### R-2`(Webhook HMAC secret 입력/rotate 이원 설계)가 폐기됐는데도 취소선·정정 콜아웃 없이 원문 그대로 남음 (재확인 — 기존 개방)
  - target 위치: `spec/2-navigation/2-trigger-list.md` 226~236행 `### R-2` 전체 — `PATCH /api/triggers/:id { config.hmacSecret }` 인라인 필드를 v1 계약으로 서술
  - 위반 규약: 직접 조문은 없으나, 이 저장소의 `spec/conventions/**` 자신이 반복 실천하는 **문서 구조 관례** — 과거 결정이 후속 결정으로 대체되면 원문을 지우지 않고 `~~취소선~~` + `> **정정 (날짜)**:` 콜아웃을 붙인다(선례: `review-citations.md` "Rationale" 절, `spec-impl-evidence.md §2.1` `code:` 필드 정의의 "정정 (2026-09-06)" 콜아웃). CLAUDE.md 의 "자기-반증형 소정정" 조항도 동일 취지(원문은 취소선으로 남기고 정정만 국지적으로 추가)다.
  - 상세: R-2 는 `config.hmacSecret` 인라인 필드 편집을 전제로 하지만, 같은 문서의 §2.3.1 Auth Config 행·R-14·§3 각주는 모두 "인증 관련 inline 키(`hmacSecret` 등)는 제거됨 — 인증은 `authConfigId` binding 으로만"이라 못박는다. `5-system/15-chat-channel.md` R-CC-10 은 지금도 R-2 를 "현재 유효한 설계"로 인용하고 있어(대조군), 파급이 문서 밖으로도 나간다. R-2 를 안 고치면 이 문서를 처음 읽는 사람은 R-2 와 R-14 중 어느 것이 유효한지 본문만으로 판단할 수 없다.
  - 이미 추적됨: 같은 plan 파일 490~505행 (planner 턴, `review/consistency/2026/09/06/15_31_00` W1 인용) — R-2 본문에 취소선 + 정정 콜아웃, `15-chat-channel.md` R-CC-10 인용문 동시 갱신 지시.
  - 제안: 조치 불필요(추적됨). 다음 planner 턴에서 두 파일 동시 처리.

- **[WARNING]** `botToken` 행의 "마스킹 placeholder" 서술이 같은 문장 안에서 스스로 밝힌 boolean-only 노출 정책과 자기모순 (재확인 — 기존 개방)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 "Chat Channel │ botToken" 행 (현재 157행) — `"...write-only — 응답에는 hasBotToken: boolean 만 노출 (...). 마스킹 placeholder (\"•••• <last4>\")..."`
  - 위반 규약: [`spec/conventions/swagger.md §1-5`](../../../../../../spec/conventions/swagger.md) (`writeOnly` 필드는 응답에서 자동 제외 — plaintext 비노출의 명시 근거), [`spec/5-system/15-chat-channel.md §5.4.2`](../../../../../../spec/5-system/15-chat-channel.md) (SoT: "`botTokenRef` 자체와 `botToken` plaintext 는 응답에 절대 미포함. `hasBotToken` 만 노출"), [데이터 모델 §2.17.2](../../../../../../spec/1-data-model.md) 의 `***<last4>` 마스킹은 **AuthConfig** 전용(서버가 실제로 마스킹된 값을 응답에 싣는 경우)이라 전제가 다름.
  - 상세: `hasBotToken` 이 boolean 뿐이라면 서버가 last4 문자를 보낼 방법이 없다 — 같은 셀 안에서 앞 문장이 이미 그렇게 적어 놓고 곧이어 last4 placeholder 를 덧붙인 자기모순이다. 실제 구현도 이 서술을 뒷받침하지 않는다 — rotate 입력 모달의 placeholder 는 `i18n` 형식 예시(`"123456789:ABCdef..."`)이지 `"•••• <last4>"` 가 아니다. AuthConfig 의 `***<last4>` 마스킹 관례를 성격이 다른(더 엄격한, 완전 비노출) Chat Channel 필드에 잘못 차용한 것으로 보인다. 방치하면 다음 구현자가 실제 last4 노출 필드를 신설해 `swagger.md §1-5`/`secret-store.md §1.1` 을 위반할 소지가 있다.
  - 이미 추적됨: `plan/in-progress/spec-draft-nullable-notation-followups.md` 564~577행 (planner 턴, `review/consistency/2026/09/06/14_59_49` W2 인용, "이 PR 이 만든 결함이 아니다. 게이트가 넓어지며 드러났다"고 명시).
  - 제안: 조치 불필요(추적됨). "마스킹 placeholder" 문구를 삭제하거나 "rotate 입력창의 placeholder 는 형식 예시이며 기존 값의 일부를 보여주지 않는다"로 정정.

- **[INFO]** `error.details` 의 object vs array 이중 컨테이너 형태가 `api-convention.md §5.3` 에 아직 명문화되지 않음 (재확인 — 문서 공백, target 은 위반 아님)
  - target 위치: `2-trigger-list.md` §3 하단 blockquote(현재 213행 부근) "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"
  - 상세: 이번 라운드에서 diff 를 직접 재확인한 결과, 이전 라운드(`14_59_49`)가 WARNING 으로 지적했던 `details.subCode`(비표준 키) 는 **이미 `details.code` 로 수정돼 있다** — `triggers.service.ts` `rethrowEndpointPathConflict()` 가 `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 던진다. 이는 `error-codes.md §4.2` 의 기존 관례(`error.details[].code`)와 정확히 정합하고, target 문서가 §3 에 선언한 계약과도 문자 그대로 일치한다. 남은 것은 §5.3 표준 예시(`details: [{field, message, code}]`, 배열)와 이 object 형태 사이 어느 쪽이 "기본"인지 규약이 아직 답하지 않는다는 문서 공백뿐 — target 문서의 위반이 아니다.
  - 이미 추적됨: 같은 plan 파일 544~562행 (planner 턴, "도메인 세부 에러 코드의 표현 방식을 정식화한다", `review/consistency/2026/09/06/14_59_49` W1 인용).
  - 제안: target 문서 수정 불필요. `api-convention.md §5.3` 갱신은 별도 planner 항목으로 이미 등재됨.

## 확인된 양호 사례 (참고 — 신규 diff 대상 중심)

- `triggers.service.ts` 의 `rethrowEndpointPathConflict()` 신규 구현 — target 문서 §3/§2.3.1 이 이미 선언한 "409 `RESOURCE_CONFLICT` + `details.field='endpoint_path'` + `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`" 계약을 정확히 구현. 상수 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_workspace_endpoint'` 도 `migrations/V002__indexes.sql` 의 실제 인덱스명과 일치(grep 확인) — 명명 드리프트 없음.
- `TRIGGER_ENDPOINT_PATH_CONFLICT` — 도메인 prefix(`TRIGGER_`) + `UPPER_SNAKE_CASE` 로 `error-codes.md §1` 의미 기반 명명 원칙에 부합.
- `isActive` 토글이 `PATCH /:id { isActive }` 단일 경로이고 별도 `/toggle` 서브라우트를 두지 않는 것(R-4/R-16) — `api-convention.md §12.1` 상태 토글 패턴을 정확히 준수. 실제 DTO(`update-trigger.dto.ts`/`update-schedule.dto.ts` 등)도 `isActive` camelCase 로 일치.
- RPC-style sub-channel action 경로(`/api/triggers/:id/notification/rotate-secret`, `.../chat-channel/rotate-bot-token`, `.../interaction/revoke-token`) — `api-convention.md §2.2` 가 명시한 예외 패턴과 정확히 일치.
- `workspace-response.dto.ts` 신규 `WorkspaceMemberDto.joinedAt` 필드 — `@ApiProperty({ nullable: true, type: String, format: 'date-time' })` + `field: string | null` 조합은 `api-convention.md §5.4` 기본형(상시 존재 + null)을 정확히 준수. 내부 서사(실측·리뷰 인용)를 JSDoc 이 아니라 `//` 주석에 둔 것도 `swagger.md §3`·`review-citations.md §3`(DTO JSDoc 은 공개 OpenAPI 로 나가므로 리뷰 인용 비대상)을 정확히 지킨다. (이 필드는 `spec/2-navigation/2-trigger-list.md`/`3-schedule.md` 의 서술 대상이 아니라 별도 판정.)
- 감사 액션 명명 — `trigger.deleted`/`trigger.updated`/`trigger.chat_channel_bot_token_rotated`/`trigger.notification_secret_rotated`/`trigger.interaction_token_revoked` 모두 `audit-actions.md §3` 레지스트리와 1:1.
- `@workflow/chat-channel-validation` 패키지명 인용 — 실제 `package.json` name 필드와 일치.
- frontmatter(`id`/`status`/`code:`) 스키마 자체는 `spec-impl-evidence.md §2` 요건(구조상)을 충족 — 위반은 §3 라이프사이클 값 쪽(위 첫 WARNING)에 있다.

## 요약

`spec/2-navigation/` 스코프 델타는 이번 PR 에서 0이고, 이번 라운드에서 직접 재확인한 결과 **신규
규약 위반은 없다** — 관련 백엔드 diff(`triggers.service.ts` 의 `rethrowEndpointPathConflict`,
`workspace-response.dto.ts` 의 `joinedAt`)는 target 문서가 이미 선언한 계약을 그대로, 그리고 정식
규약(`error-codes.md`·`swagger.md`·`api-convention.md`)에 맞게 구현했다. 이전 라운드가 지적한
`details.subCode` 비표준 키는 이미 `details.code` 로 수정 확인됨. 반면 `2-trigger-list.md` 문서
자체에 이전부터 있던 세 건의 내부 정합성 결함(frontmatter status 오표기, 폐기된 R-2 미정정,
botToken 마스킹 서술 자기모순)은 이번 라운드에도 그대로 남아 있으나 전부
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 정확한 인용과 함께 planner 턴
항목으로 등재돼 있어 — `developer` 는 `spec/` 쓰기 권한이 없으므로 이 라운드에서 고칠 수 없는 것이
정상이다 — 미추적 리스크는 없다. CRITICAL 없음.

## 위험도
LOW
