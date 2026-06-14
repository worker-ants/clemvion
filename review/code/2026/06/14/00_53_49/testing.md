# Testing Review — impl-discord-gaps

## 발견사항

### [INFO] dispatcher.ts: `pendingFormModal.title` 전파 경로 통합 테스트 없음
- 위치: `chat-channel.dispatcher.ts` 변경부 (extractFormTitle IIFE 블록)
- 상세: `extractFormTitle(modalFormConfig)` 결과를 `pendingFormModal.title` 에 저장하는 경로 자체는 `form-mode.spec.ts` + `discord.adapter.spec.ts` 로 unit 커버되지만, Dispatcher → conversationService.upsert → HooksService.openFormModal 까지 title 이 실제로 전달되는 end-to-end 경로를 검증하는 통합 테스트가 존재하지 않는다. `hooks.service.ts` 변경(`pendingFormModal.title` 조건부 스프레드)도 단위 테스트 대상이 아니다. 현재 테스트 체계(unit only)에서는 이 연결 고리를 검증할 수 없어, 리팩토링 시 silent regression 위험이 있다.
- 제안: `chat-channel-dispatcher.spec.ts` 또는 `hooks.service.spec.ts` 에서 `pendingFormModal.title` 을 포함한 `conversationService.upsert` mock 호출 인수 검증을 추가한다. 우선순위는 WARNING 에 못 미치지만, 향후 통합 테스트 추가 시 이 경로를 포함할 것.

---

### [WARNING] `extractFormTitle` — 우선순위 충돌 케이스 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` — `describe('extractFormTitle')` 블록
- 상세: 현재 테스트는 (a) `{ title }` 직접 shape, (b) `{ config: { title } }` wrapping, (c) 빈/비문자열/null 만 검증한다. `extractFormTitle` 구현은 `direct ?? nested` 우선순위를 사용하는데, **양쪽 모두 값이 있는 경우**(`{ title: 'A', config: { title: 'B' } }`)에 `direct`(`'A'`)가 우선함을 검증하는 케이스가 없다. 구현 로직의 `??` 분기가 의도대로 동작하는지 확인할 수 없다.
- 제안: 아래 케이스를 `extractFormTitle` describe 에 추가한다.
  ```ts
  it('title 과 config.title 동시 존재 → 직접 title 우선', () => {
    expect(extractFormTitle({ title: 'Direct', config: { title: 'Nested' } })).toBe('Direct');
  });
  ```

---

### [WARNING] `openFormModal` — `languageHints.formModalTitle` 경로 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts` — `describe('§4.1 openFormModal')` 블록
- 상세: `discord.adapter.ts` 의 `rawTitle` 결정 로직은 3단계 우선순위(`params.title → languageHints.formModalTitle → '양식'`)를 가진다. 현재 테스트는 (1) `title` 미지정 → `'양식'` 기본값, (2) `title` 지정 + 45자 truncate 만 커버한다. 중간 경로인 `params.title` 미지정 + `languageHints.formModalTitle` 설정 시 해당 hint 가 사용되는지 검증하는 케이스가 없다. 향후 누군가 우선순위 순서를 변경해도 테스트가 통과한다.
- 제안: 아래 케이스를 추가한다.
  ```ts
  it('§3.3 title 미지정 + languageHints.formModalTitle → hint 사용', async () => {
    const adapter = new DiscordAdapter(new DiscordClient(), makeSecretsMock());
    const result = await adapter.openFormModal({
      config: { ...DISCORD_CONFIG, languageHints: { formModalTitle: '승인 요청' } },
      openContext: { interactionId: 'I1', interactionToken: 'tok' },
      fields: [{ name: 'name', label: 'Name', type: 'text' }],
      conversationKey: 'C1',
      nodeId: 'n1',
    });
    const modal = result.httpResponse as { data: { title: string } };
    expect(modal.data.title).toBe('승인 요청');
  });
  ```

---

### [WARNING] `extractFormFields` — `minLength=0` 경계값 처리 불명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/shared/form-mode.spec.ts` — `describe('extractFormFields')` 내 `§3.3` 테스트
- 상세: 구현(`form-mode.ts`)은 `minLength >= 0` 조건으로 0을 허용하지만 `maxLength > 0` 조건으로 0을 거부한다. 현재 테스트의 "무효 값" 케이스는 `minLength: -1, maxLength: 0` 을 묶어 하나의 필드로 처리해, `minLength=0` 이 허용되는지 / `maxLength=0` 이 거부되는지를 독립적으로 검증하지 않는다. 특히 `minLength=0` 은 Discord API 상 유효한 값(문자 입력 불필요)이므로 허용 여부가 중요하다.
- 제안: `minLength=0` 허용, `maxLength=0` 거부를 각각 독립된 assertion 으로 분리하거나 별도 케이스로 추가한다.
  ```ts
  it('minLength=0 허용 / maxLength=0 거부', () => {
    const fields = extractFormFields({
      fields: [{ name: 'f', label: 'F', type: 'text', validation: { minLength: 0, maxLength: 0 } }],
    });
    expect(fields[0].minLength).toBe(0);
    expect(fields[0].maxLength).toBeUndefined();
  });
  ```

---

### [INFO] `discord-message.renderer.spec.ts` — reply 버튼 테스트 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.spec.ts`
- 상세: 새로 추가된 `describe('renderDiscordEvent — execution.ai_message (§5.1(b) reply 버튼)')` 의 단일 케이스(AI 응답 → buttons 승격 + `__reply__` 버튼)가 동일 파일의 `describe('renderDiscordEvent — execution.ai_message presentations[] (CCH-MP-01 보강)')` 안의 `'presentations 미정의 → 단일 메시지에 Reply 버튼 첨부'` 케이스와 사실상 동일한 동작을 검증한다. 중복 테스트는 유지 비용을 높이고 실패 시 혼란을 줄 수 있다.
- 제안: 두 케이스를 하나의 describe 로 통합하거나, 신규 추가 케이스에 `turnCount > 1` 등 별도 조건을 추가해 차별화한다.

---

### [INFO] `discord.adapter.spec.ts` — `openFormModal` 의 `min_length`/`max_length` 상한 cap 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-discord-gaps-616b6b/codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.spec.ts` — `§3.3 TEXT_INPUT 길이 제약` 케이스
- 상세: 구현은 `Math.min(f.minLength, 4000)` / `Math.min(f.maxLength, 4000)` 으로 Discord 4000자 cap 을 강제하지만, 테스트는 일반 범위(8/32) 만 검증한다. 4000 초과 값이 4000 으로 clamp 되는지 검증하는 케이스가 없다.
- 제안: `minLength: 5000, maxLength: 6000` 입력 시 각각 4000 으로 clamp 되는지 검증하는 케이스 추가.

---

### [INFO] `hooks.service.ts` 변경 — 단위 테스트 없음
- 위치: `hooks.service.ts` diff — `pendingFormModal.title` 조건부 스프레드 추가
- 상세: 변경은 3줄 조건부 스프레드로 간단하지만, 이 경로에 대한 테스트가 `hooks.service.spec.ts`(존재 여부 미확인)에 추가되지 않았다. `openFormModal` 호출 인수에 `title` 이 포함되는 케이스 / 미포함 케이스(undefined) 양쪽을 검증하는 단위 테스트가 필요하다.
- 제안: `hooks.service.spec.ts` 에서 `pendingFormModal = { nodeId, fields, title: 'T' }` 인 경우 어댑터의 `openFormModal` 이 `{ title: 'T' }` 를 포함하는 params 로 호출되는지 mock 검증 추가.

---

### [INFO] `discord.adapter.spec.ts` — `setupChannel publicKey` 테스트의 verify_key 부재 케이스 미검증
- 위치: `discord.adapter.spec.ts` — `setupChannel` describe 내 기존 성공 케이스에 추가된 assertion
- 상세: `application.verify_key` 가 없는 경우(API 응답에 `verify_key` 필드 자체가 없는 경우) `publicKey` 가 `configUpdates.botIdentity` 에 포함되지 않아야 한다. 현재 구현은 `...(application.verify_key ? { publicKey: ... } : {})` 로 guard 되어 있으나, 이 분기를 검증하는 테스트가 없다.
- 제안: `getApplicationMe` 응답에 `verify_key` 없이(`{ id, name }` 만) mock 한 케이스에서 `result.configUpdates?.botIdentity?.publicKey` 가 `undefined` 인지 검증하는 케이스 추가.

---

## 요약

전체적으로 테스트 구조는 양호하다. 신규 기능(extractFormTitle, extractFormFields의 validation 정규화, openFormModal title/min_length/max_length)에 대한 unit 테스트가 적절히 추가되었고, Discord renderer reply 버튼 동작도 커버된다. 주요 커버리지 갭은 세 곳이다: (1) `extractFormTitle` 의 직접/중첩 title 우선순위 충돌 케이스 미검증, (2) `openFormModal` 에서 `languageHints.formModalTitle` 이 `title` 파라미터 부재 시 실제로 사용되는지 검증 없음, (3) `minLength=0` 경계값 처리의 독립 검증 부재. `hooks.service.ts` 변경의 title 전파 경로는 통합 테스트가 없어 regression 위험이 존재한다. 이 중 우선순위가 높은 항목(languageHints 우선순위, 직접/중첩 title 충돌)은 WARNING 수준이며, 나머지는 INFO 수준으로 즉각적인 블로킹 이슈는 아니다.

## 위험도

LOW
