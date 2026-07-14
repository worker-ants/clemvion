# 테스트(Testing) 리뷰

대상: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` (F-4 신규 테스트 2건),
`codebase/backend/src/modules/chat-channel/shared/markdown-v2.ts` (주석만 변경),
`plan/in-progress/eia-command-waiting-surface-guard.md` (문서 갱신)

## 발견사항

- **[WARNING]** 신규 두 테스트가 `maybeNotifyIgnored` 의 분기 선택(어떤 안내 문구가 나갔는지)을 실제로 검증하지 않음
  - 위치: `hooks.service.spec.ts` — `F-4 — parseUpdate null + private unsupported → unsupportedMessageKind 안내 발송` (신규), 및 인접한 기존 `F-4 — parseUpdate null + group chat → groupChatRefusal 안내 발송` 테스트
  - 상세: `maybeNotifyIgnored` 구현은 `isGroup` 여부에 따라 서로 다른 두 기본 문구 중 하나를 고른다.
    ```ts
    const announcement = isGroup
      ? (config.languageHints?.groupChatRefusal ?? '이 봇은 1:1 대화만 지원합니다\\.')
      : (config.languageHints?.unsupportedMessageKind ?? '지원하지 않는 메시지 형식입니다\\.');
    ```
    그런데 두 테스트 모두 `expect.objectContaining({ conversationKey, body: expect.objectContaining({ kind: 'text' }) })` 로만 검증한다. `kind: 'text'` 는 두 분기 모두 동일하므로, 삼항 조건이 뒤바뀌거나(예: private 케이스에 `groupChatRefusal` 문구가 나가는 회귀) 두 기본 문구 리터럴이 서로 뒤섞여도 이 테스트들은 여전히 통과한다. 즉 "unsupportedMessageKind 분기 테스트 추가"라는 본 델타의 목적에 비해 실제로 그 분기가 선택한 텍스트를 고정(lock-down)하지 못한다.
    같은 파일의 `surfaceMismatch` 안내 테스트(1170행 부근)는 `body: { kind: 'text', text: SURFACE_MISMATCH_DEFAULTS.ko }` 로 정확한 텍스트까지 단언해 대비된다.
  - 제안: 두 테스트(및 기존 group 테스트)에 `text: '지원하지 않는 메시지 형식입니다\\.'` / `text: '이 봇은 1:1 대화만 지원합니다\\.'` 같은 정확한 문구 단언을 추가해 분기 선택 자체를 회귀 가드로 고정한다. 리터럴 반복이 부담스러우면 `unsupportedMessageKind`/`groupChatRefusal` 기본값 상수를 소스에서 export 해 재사용하는 방법도 있다(F-2 의 `SURFACE_MISMATCH_DEFAULTS` 패턴과 동일).

- **[INFO]** 신규 두 테스트가 `handleWebhook` 전체 반환값(`{ executionId: 'ignored' }`)을 단언하지 않음
  - 위치: `hooks.service.spec.ts` F-4 신규 2건 (`private unsupported`, `is_bot=true`)
  - 상세: `sendMessage` 호출/미호출만 검증하고 `service.handleWebhook(...)` 의 반환값은 확인하지 않는다. 같은 `describe` 블록의 다른 `parseUpdate null` 계열 테스트(예: 최초 CCH-AD-04 무시 경로 테스트)는 `res.toMatchObject({ executionId: 'ignored' })` 까지 검증한다. 델타의 핵심은 안내 발송 여부이므로 치명적이진 않으나, 반환 계약까지 같은 테스트에서 고정하면 완결성이 높아진다.
  - 제안: `const res = await service.handleWebhook(...)` 후 `expect(res).toMatchObject({ executionId: 'ignored' })` 를 추가.

- **[INFO]** `maybeNotifyIgnored` 의 나머지 guard 분기(전부 pre-existing, 이번 델타 범위 밖) 일부가 여전히 미커버
  - 위치: `hooks.service.ts` L798–806 (`maybeNotifyIgnored`)
  - 상세: `!chat?.id` 조기 return(예: `chat.id` 누락 또는 falsy), `isGroup` 판정에 포함된 `'channel'` 타입(Telegram broadcast channel), `from` 필드 자체가 없는 경우(옵셔널 체이닝으로 정상 통과되지만 명시 테스트 없음) 는 어느 테스트에서도 직접 커버되지 않는다. `rawBody`/`message` 가 객체가 아닌 조기 return 은 기존 "parseUpdate 가 null 반환 시 { executionId: 'ignored' } 반환" 테스트가 `chatInput` 의 기본 `body`(=`message` 필드 없음)로 암묵적으로 지나가지만, `sendMessage` 미호출을 명시적으로 단언하지 않는다.
  - 제안: 필수는 아니나, 실제 운영에서 `channel` 타입 포스트나 `chat.id` 누락 payload 가 관측된다면 회귀 가드로 케이스를 추가할 가치가 있음. 이번 델타(unsupportedMessageKind + is_bot) 자체의 완결성엔 영향 없음.

- **[INFO]** `config.languageHints` override(커스텀 `unsupportedMessageKind`/`groupChatRefusal`) 경로는 여전히 default 경로만 테스트됨
  - 위치: `hooks.service.spec.ts` 전체 — `unsupportedMessageKind`/`groupChatRefusal` 를 grep 하면 이번 테스트 이름 외 다른 참조 없음
  - 상세: F-5 는 이 두 키를 raw-send 검증 대상(`LanguageHintsRawSendValidator`)에 포함시켰고 DTO 단위 테스트로 검증하지만, `maybeNotifyIgnored` 가 `config.languageHints?.unsupportedMessageKind` override 값을 실제로 우선 사용해 발송하는지의 종단 테스트는 없다(`sendSurfaceMismatchNotice` 쪽은 override 경로가 별도 커버되어 있는지 미확인). default-fallback(`??`) 로직 자체는 간단해 리스크는 낮음.
  - 제안: 우선순위 낮음. 필요시 `config.languageHints.unsupportedMessageKind = 'custom text'` 를 설정한 케이스를 한 건 추가해 override 우선순위를 명시적으로 고정.

## 요약

`maybeNotifyIgnored` 의 `unsupportedMessageKind`(private/unsupported) 및 `is_bot` silent-skip 두 분기에 대해 신규 유닛 테스트가 적절한 위치(`Chat Channel 분기` describe 블록)에 추가되었고, mock 구성·테스트 격리·네이밍은 파일의 기존 관례와 일관되며 회귀 위험도 없다. 다만 두 신규 테스트(및 인접한 기존 group 테스트)가 `body.kind === 'text'` 만 확인하고 실제 발송된 안내 문구(텍스트)까지는 단언하지 않아, 이 델타가 원래 노리는 "어떤 분기가 선택됐는지" 를 완전히 고정하지 못한다는 것이 가장 중요한 갭이다 — 삼항 조건이 뒤집혀도 테스트가 여전히 통과할 수 있다. 그 외 guard 분기(chat.id 누락, channel 타입, languageHints override)의 잔여 커버리지 갭은 이번 델타 범위 밖의 pre-existing 사항으로 우선순위가 낮다.

## 위험도
LOW
