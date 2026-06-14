# Testing Review — impl-telegram-gaps

## 발견사항

### [INFO] telegram-client.spec.ts — editMessageReplyMarkup 메서드 단위 테스트 부재
- 위치: `/codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts` (신규 메서드)
- 상세: `TelegramClient.editMessageReplyMarkup` 메서드가 추가되었으나 `telegram-client.spec.ts` 에는 이 메서드에 대한 직접 단위 테스트가 없다. 기존 `telegram-client.spec.ts` 는 `describeFetchError` / `safeHost` 유틸 함수만 테스트한다. `editMessageReplyMarkup` 의 핵심 동작(올바른 method 이름 `'editMessageReplyMarkup'` 으로 `call()` 을 호출하는지, `toRecord(params)` 변환이 정상인지)은 `telegram.adapter.spec.ts` 의 mock 경유 간접 검증으로만 커버된다.
- 제안: adapter 수준 mock 으로 충분히 중요 동작이 커버되므로 CRITICAL 은 아니나, `TelegramClient` 의 다른 메서드(setWebhook, sendMessage 등)도 직접 단위 테스트가 없는 패턴과 일치하므로 기존 수준의 일관성은 유지됨. 추후 client-level 단위 테스트 추가 시 `editMessageReplyMarkup` 도 포함 권장.

---

### [INFO] typing indicator — 빈 message 입력 시 typing 생략 경로 테스트 부재
- 위치: `telegram-message.renderer.ts` `renderAiMessage` (§5.1 변경) / `telegram-message.renderer.spec.ts`
- 상세: `renderAiMessage` 는 `textMessages.length > 0` 일 때만 typing 을 prepend 한다(빈 응답이면 `[]` 반환). 그러나 현재 spec 에는 `event.message = ''` 인 케이스(빈 AI 응답)가 test 되지 않는다. `renderText('')` 가 빈 배열인지 단일 item 인지에 따라 typing 포함 여부가 달라진다.
- 제안: 다음 케이스를 추가한다:
  ```ts
  it('ai_message 빈 message → 빈 배열 (typing 도 생략)', () => {
    const event = { ...BASE_EVENT_FIELDS, type: 'execution.ai_message', message: '', turnCount: 1 };
    expect(renderTelegramMessages(event, BASE_CONFIG)).toEqual([]);
  });
  ```

---

### [INFO] callback_query.message 미존재 시 messageId 미설정 케이스 — parser 테스트 부재
- 위치: `telegram-update.parser.spec.ts`
- 상세: 신규 테스트는 `message.message_id` 있는 경우(messageId 동봉)와 기존 테스트(`callback_query → button_callback`, message_id 없음)를 커버한다. 그러나 `callbackQuery.message` 자체가 존재하되 `message_id` 필드가 `undefined`/누락인 케이스(= messageId 가 string 이 아닌 undefined 로 결과)도 명시적으로 테스트하면 의도 서술이 더 완전해진다. 현재 기존 테스트(`callback_query → button_callback`)의 `message` 객체에 `message_id` 가 없는 경우가 암묵적으로 커버되나, `expect(r?.command).toEqual({ kind: 'button_callback', callbackData, callbackQueryId })` 에서 `messageId` key 자체가 없음을 확인한다 — 충분히 명시적.
- 제안: 현 수준으로 충분하나, 테스트 의도 명확화를 위해 기존 `callback_query → button_callback` 테스트의 expect 에 `messageId: undefined` 가 아닌 key 부재를 명시 확인하는 주석 추가 권장.

---

### [INFO] ackInteraction — answerCallbackQuery 실패 시 editMessageReplyMarkup 미호출 여부 테스트 부재
- 위치: `telegram.adapter.spec.ts` `ackInteraction()` describe
- 상세: `answerCallbackQuery` 가 실패(`ok: false`) 또는 throw 하는 경우, `editMessageReplyMarkup` 이 호출되어서는 안 된다. 현재 adapter 구현 (`telegram.adapter.ts`) 은 `answerCallbackQuery` 가 throw 하면 `editMessageReplyMarkup` 에 도달하지 못한다(순차 await). 그러나 `answerCallbackQuery` 가 `ok: false` 를 반환하는 경우(throw 없이 실패 응답)는 현재 코드가 에러를 throw 하지 않고 그냥 `editMessageReplyMarkup` 을 호출한다 — spec 의도가 ack 실패 시에도 keyboard 제거를 시도하는 것인지 불명확하므로 테스트로 명시 필요.
- 제안:
  ```ts
  it('answerCallbackQuery ok=false 시 editMessageReplyMarkup 도 호출된다 (best-effort, 현 구현 확인)', async () => {
    client.answerCallbackQuery.mockResolvedValue(failResult('Too Many Requests'));
    client.editMessageReplyMarkup.mockResolvedValue(okResult(...));
    // update with messageId
    await adapter.ackInteraction(update, baseConfig);
    expect(client.editMessageReplyMarkup).toHaveBeenCalled(); // or not, depending on spec
  });
  ```

---

### [INFO] numericId 가 NaN 이 되는 엣지 케이스 (messageId='abc') 테스트 부재
- 위치: `telegram.adapter.ts` `ackInteraction` (L253-L264)
- 상세: `Number(messageId)` 는 `'abc'` → `NaN`, `Number.isInteger(NaN)` → `false` 이므로 `editMessageReplyMarkup` 미호출로 안전하게 처리된다. 그러나 이 보호 로직을 검증하는 테스트가 없다.
- 제안:
  ```ts
  it('messageId 가 비-숫자 문자열이면 editMessageReplyMarkup 미호출', async () => {
    client.answerCallbackQuery.mockResolvedValue(okResult(true));
    const update = { ..., command: { kind: 'button_callback', ..., messageId: 'NaN-string' } };
    await adapter.ackInteraction(update, baseConfig);
    expect(client.editMessageReplyMarkup).not.toHaveBeenCalled();
  });
  ```

---

### [INFO] carousel.chunked 미설정 — renderCarouselFallback 의 카드 body 에 chunked 필드 미설정
- 위치: `telegram-message.renderer.ts` `renderCarouselFallback` (L1680)
- 상세: carousel 카드 body 를 직접 `{ kind: 'text', text: bodyText }` 로 생성하며 `chunked` 를 설정하지 않는다. `renderText` 경로와 달리 `chunked` 가 항상 `undefined`. 이 차이가 dispatcher 에서 문제가 되는지는 알 수 없으나, `ChannelMessageBody.text` 의 `chunked?: boolean` 이 optional 이므로 기술적 버그는 아니다. 단, 타 경로와 일관성이 없어 렌더러 테스트에서 이 동작을 명시 확인하면 회귀 방지에 유리.
- 제안: 현재 carousel 렌더러 spec 에 카드 body의 chunked 미포함 여부를 explicit assert 로 추가.

---

### [WARNING] typing 케이스 sendMessage — adapter.spec 에 typing body sendMessage 테스트 부재
- 위치: `telegram.adapter.spec.ts` `sendMessage()` describe
- 상세: `adapter.sendMessage` 의 `case 'typing'` 분기는 `sendChatAction` 을 호출하며 `externalMsgId: 'typing'` 을 반환한다. 현재 `sendMessage()` 테스트 섹션에는 text / buttons / 실패 케이스만 있고 `typing` body 에 대한 테스트가 없다. typing 은 §5.1 의 핵심 신규 기능이며, `sendChatAction` mock 호출 여부·반환값 형식 모두 미검증.
- 제안:
  ```ts
  it('typing 메시지 → sendChatAction(typing) 호출', async () => {
    client.sendChatAction.mockResolvedValue(okResult(true));
    const msg: ChannelMessage = { conversationKey: '9999', body: { kind: 'typing' } };
    const result = await adapter.sendMessage(msg, baseConfig);
    expect(client.sendChatAction).toHaveBeenCalledWith(BOT_TOKEN_PLAIN,
      expect.objectContaining({ chat_id: '9999', action: 'typing' }));
    expect(result.externalMsgId).toBe('typing');
  });
  ```

---

## 요약

이번 변경(§5.1 typing indicator prepend, §5.2(3) editMessageReplyMarkup 키보드 제거)에 대한 테스트 커버리지는 전반적으로 양호하다. 특히 parser 의 messageId 동봉 케이스, adapter 의 editMessageReplyMarkup 3건(정상/미호출/best-effort 삼킴), renderer 의 ai_message typing+text 시퀀스 변경이 모두 테스트로 뒷받침된다. 다만 adapter.sendMessage 의 `typing` 분기(§5.1 핵심 경로)에 대한 직접 테스트가 누락되어 있고(WARNING), 빈 ai_message 에서 typing 생략 경로, messageId 비-숫자 입력 보호 로직, answerCallbackQuery ok=false 시 후속 동작이 미검증(INFO) 상태다. 테스트 격리성과 가독성은 우수하며 mock 사용도 적절하다.

## 위험도

LOW
