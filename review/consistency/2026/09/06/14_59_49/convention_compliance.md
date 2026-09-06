# 정식 규약 준수 검토 — `spec/2-navigation/`

검토 대상: `spec/2-navigation/2-trigger-list.md` · `spec/2-navigation/3-schedule.md` (번들 예산으로 전달된 두 파일 본문 기준. 나머지 15개 파일은 컨텍스트 예산 초과로 생략됨 — 해당 파일은 이번 라운드에서 판정하지 않음).

전제: 이 PR 은 `spec/2-navigation/**` 파일을 **변경하지 않았다** (diff-base `origin/main` 대비 델타 0). 다만 같은 스코프의 백엔드 diff(`triggers.service.ts`)가 이 문서가 이미 서술해 둔 계약을 **새로 구현**했으므로, 아래 발견사항은 "문서가 서술한 계약 ↔ 정식 규약(`spec/conventions/**`)" 정합성 확인이며 이 PR 이 spec 문서를 잘못 고쳤다는 뜻은 아니다.

## 발견사항

- **[WARNING]** `details.subCode` 신규 키가 확립된 `error.details[].code` 명명 관례에서 벗어남
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 "Webhook Configuration │ endpointPath" 행(94행), §3 API 하단 blockquote(164행) — "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"
  - 위반 규약: [`spec/conventions/error-codes.md §4.2`](../../../../../../spec/conventions/error-codes.md) (도메인별 세부 사유는 봉투의 `error.details[].code` 로 정규화 — 이미 같은 `triggers` 도메인의 Manual/Webhook 파라미터 검증에서 이 패턴을 쓴다), [`spec/5-system/2-api-convention.md §5.3`](../../../../../../spec/5-system/2-api-convention.md) (`details: [{ field, message, code }]`)
  - 상세: target 문서는 "세부 코드"라고만 적고 실제 wire key 를 명시하지 않는다. 이 문서의 frontmatter `code:` 가 지목하는 구현(`codebase/backend/src/modules/triggers/triggers.service.ts:1602-1619`, `rethrowEndpointPathConflict`)은 `details: { field: 'endpoint_path', subCode: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 로 **새 키 `subCode`** 를 도입했다. 그러나 저장소 전역에서 "도메인별 세부 에러 코드"라는 동일 개념은 예외 없이 **`code`** 키를 쓴다 — Manual/Webhook trigger 파라미터 검증(`error.details[].code`, error-codes.md §4.2 · error-handling.md §1.7), placeholder 검증(`details[].code = 'INVALID_FIELD'`, 15-chat-channel.md R-CC-15 (c)), 공개 user-guide MDX(`error.details[{ field, message, code }]`, `triggers.mdx`/`triggers.en.mdx`) 등. `subCode` 문자열은 저장소 전체에서 `triggers.service.ts`/`triggers.service.spec.ts` 이 신설한 이 한 곳에만 존재한다(실측: grep, 다른 매치 없음). 구현 주석은 "top-level `subCode` 를 실으면 `GlobalExceptionFilter` 가 버린다"는 이유로 `details` 안에 넣었다고 설명하지만, 그 설명은 **왜 nested 여야 하는지**만 정당화할 뿐 **왜 키 이름이 `code` 가 아니라 `subCode` 여야 하는지**는 설명하지 않는다 — nested `code` 를 썼어도 top-level `error.code`(`RESOURCE_CONFLICT`)와 이름이 겹치지 않으므로 문제가 없었다.
  - 제안: 구현의 `details.subCode` → `details.code` 로 통일해 기존 관례와 정합시키는 편을 권장한다. 의도적으로 별도 키를 두는 것이라면 `error-codes.md §4` 에 세 번째 정규화 파이프라인으로 등재하고, target 문구도 "세부 코드" 대신 실제 wire key(`details.subCode=`)를 명시해 다음 사람이 구현체를 열어보지 않아도 계약을 알 수 있게 한다.

- **[WARNING]** `botToken` 행의 "마스킹 placeholder" 서술이 확립된 write-only / `hasBotToken`-boolean 전용 규약과 자기모순
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 "Chat Channel │ botToken" 행 (106행) — `"...write-only — 응답에는 hasBotToken: boolean 만 노출 (...). 마스킹 placeholder (\"•••• <last4>\")..."`
  - 위반 규약: [`spec/conventions/swagger.md §1-5`](../../../../../../spec/conventions/swagger.md) (`writeOnly` 필드는 응답에서 자동 제외 — bot token plaintext 는 응답에 노출되면 안 된다는 명시 사용례), [`spec/5-system/15-chat-channel.md §5.4.2`](../../../../../../spec/5-system/15-chat-channel.md) (SoT: "`botTokenRef` 자체와 `botToken` plaintext 는 응답에 절대 미포함. `hasBotToken` 만 노출 — UI 는 ref 의 존재만 알면 충분")
  - 상세: 같은 셀 안에서 바로 앞 문장은 "응답에는 `hasBotToken: boolean` 만 노출"이라고 정확히 적어 놓고, 곧이어 "마스킹 placeholder ('•••• <last4>')"를 덧붙여 **한 문장 안에서 자기모순**이다. `hasBotToken` 이 boolean 뿐이라면 서버가 last4 문자를 전송할 방법이 없다 — §5.4.2 가 ref/plaintext 모두 응답 제외를 명시적으로 못 박은 필드다. 실제 구현도 이 서술을 뒷받침하지 않는다: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx` 는 `hasBotToken` 값으로 "등록됨"/"미등록" 텍스트만 렌더링하고(469-471행), rotate 입력 모달의 placeholder 는 `t("triggers.chatChannel.botTokenInputPlaceholder")` → i18n 사전 값 `"123456789:ABCdef..."` (형식 예시)이지 `"•••• <last4>"` 가 아니다(`codebase/frontend/src/lib/i18n/dict/ko(en)/triggers.ts`). AuthConfig 의 `***<last4>` 마스킹 규약([Spec 데이터 모델 §2.17.2])을 성격이 다른 Chat Channel `botToken` 필드에 잘못 차용한 것으로 보인다 — AuthConfig 쪽은 서버가 마스킹된 값을 실제로 응답에 싣지만(§2.17.2), Chat Channel 쪽은 boolean 만 싣는 **의도적으로 더 엄격한** 정책이다(secret-store.md §1.1 이 2026-09-05 자로 이 엄격함을 "응답 바디에 나가지 않는다"로 명문화).
  - 제안: "마스킹 placeholder (...)" 문구를 삭제하거나 "rotate 입력창의 placeholder 는 형식 예시(`123456789:ABCdef...`)이며 기존 값의 일부를 보여주지 않는다"로 정정한다. 이 문구를 남겨 두면 다음 구현자가 실제 last4 노출 필드를 신설해 swagger.md §1-5 / secret-store.md §1.1 을 위반할 소지가 있다.

- **[INFO]** `error.details` 의 object/array 이중 형태가 `api-convention.md §5.3` 에 명문화되지 않음
  - target 위치: `2-trigger-list.md` 전반의 `details.field='X'` 인용 다수(94·105·106·157·162·163·164행)
  - 위반 규약: 직접 위반 없음 — `spec/5-system/2-api-convention.md §5.3` 의 문서화 공백
  - 상세: §5.3 은 `details` 예시를 배열(`[{ field, message, code }]`)로만 제시하지만, 실제 저장소(`triggers.service.ts` 다수 지점)와 이 target 문서가 반복 인용하는 `details.field='botTokenRef'` 류는 전부 **단일 object** 형태다(배열 아님). 두 형태가 합법적으로 공존한다는 사실 자체가 정식 규약 어디에도 명문화돼 있지 않아, 처음 읽는 사람은 §5.3 예시만 보고 "`details` 는 항상 배열"이라 오해할 수 있다. 이번 PR 이 만든 문제는 아니며 폭넓게 선재하던 패턴이다.
  - 제안: target 문서 수정은 불필요. `api-convention.md §5.3` 또는 `error-codes.md` 에 "ValidationPipe 발 다중 필드 오류는 배열, ad-hoc 도메인 예외는 단일 object"로 두 형태의 구분 기준을 명문화하는 규약 갱신을 권장.

## 확인된 양호 사례 (참고)

아래는 검토 과정에서 대조한 항목 중 정식 규약과 **정확히 일치**한 것들이다 (허위 위반 보고 방지를 위해 기록):

- 감사 액션 명명 — `trigger.deleted`/`trigger.updated`/`trigger.chat_channel_bot_token_rotated`/`trigger.notification_secret_rotated`/`trigger.interaction_token_revoked` 모두 `spec/conventions/audit-actions.md §3` 레지스트리와 1:1 일치.
- `isActive` 토글이 `PATCH /:id { isActive }` 단일 경로이고 별도 `/toggle` 서브라우트를 두지 않는 것 — `spec/5-system/2-api-convention.md §12.1` 상태 토글 패턴을 정확히 준수 (R-4/R-16).
- RPC-style sub-channel action 경로(`/api/triggers/:id/notification/rotate-secret` 등 3종)는 `api-convention.md §2.2` 가 명시적으로 예시로 든 예외 패턴과 정확히 일치.
- `hasBotToken`(`readOnly`) / `inboundSigningPlaintext`(`writeOnly`) 성격의 필드 구분은 `swagger.md §1-5` 의 writeOnly/readOnly 규약과 정합 (단 위 두 번째 발견사항의 서술 오류 제외).
- `uiMapping.formMode`/`visualNode`/`buttonLayout`, `languageHints` 키 목록(`groupChatRefusal`/`executionStarted`/`executionCompleted`/`executionStillRunning`/`help`)이 `spec/conventions/chat-channel-adapter.md §2.3`·`spec/5-system/15-chat-channel.md` 와 정확히 일치.
- frontmatter(`id`/`status: implemented`/`code:`) 가 `spec/conventions/spec-impl-evidence.md §2-§3` 스키마를 충족하고, `id` basename 충돌도 없음.
- `Trigger.endpoint_path` 워크스페이스 단위 UNIQUE 서술이 `api-convention.md §12.2` 와 일치.

## 요약

두 대상 문서(`2-trigger-list.md`, `3-schedule.md`)는 명명 규약·문서 구조(관련 문서 링크 + 본문 + Rationale)·API 문서 규약(RPC-style 예외, 상태 토글 단일 경로, writeOnly/readOnly 구분) 대부분에서 정식 규약을 견고하게 준수한다. 다만 트리거 리소스 충돌 처리의 신규 "세부 코드" 표현이 저장소 전역에서 예외 없이 쓰이는 `error.details[].code` 명명 관례 대신 새 키 `subCode` 를 도입했고(WARNING), Chat Channel `botToken` 행의 "마스킹 placeholder" 서술이 같은 문장 안에서 스스로 밝힌 boolean-only 노출 정책 및 실제 구현과 모순된다(WARNING) — 둘 다 즉각적인 시스템 파손은 없으나 방치하면 다음 변경에서 규약 위반(비표준 키 확산, 잠재적 부분 시크릿 노출)으로 이어질 수 있는 문서 정확성 결함이다. 그 외 대조한 항목들은 conventions 와 정확히 일치했다.

## 위험도

LOW
