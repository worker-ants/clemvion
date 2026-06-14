# 보안(Security) Review

## 발견사항

### **[INFO]** `messageId` 정수 검증 — `Number.isInteger` 로 충분하나 음수·0 허용
- 위치: `telegram.adapter.ts` — `ackInteraction` 내 `Number(messageId)` 변환 후 `Number.isInteger(numericId)` 검사
- 상세: `messageId` 는 `parseTelegramUpdate` 에서 `String(message_id)` 로 변환된 값이므로 신뢰 경계가 내부다. 그러나 `ChannelCommand.messageId` 는 옵션 string 필드로 선언되어 있어, 이론상 외부 입력이 흘러들 경우 `Number('0')` = 0, `Number('-1')` = -1 도 `Number.isInteger` 를 통과한다. Telegram `message_id` 는 양의 정수이므로, `numericId > 0` 조건을 추가하면 방어 심도가 높아진다.
- 제안: `if (Number.isInteger(numericId) && numericId > 0)` 으로 변경.

### **[INFO]** `describeFetchError` — `cause` 가 객체일 때 `JSON.stringify` 로 직렬화 후 로그 출력
- 위치: `telegram-client.ts` `describeFetchError` 함수
- 상세: `cause` 가 Node undici 의 `UND_ERR_*` 내부 에러 객체이면 사용자 입력을 담지 않으므로 실제 민감 정보 노출 리스크는 낮다. 단, 네트워크 에러 외 맥락에서 `cause` 에 외부 응답 body 가 실려 있는 경우(이 코드에선 없음)를 대비해 문서화가 되어 있지 않다. 현재 호출 경로상 문제 없음.
- 제안: 현행 유지. 다만 future use 시 `cause` 로 외부 데이터를 흘리지 않도록 주석 명시 권고.

### **[INFO]** `renderFormFallback` — 폼 필드 `label`/`name`/`type` 에 MarkdownV2 escape 미적용 후 `renderText` 에 위임
- 위치: `telegram-message.renderer.ts` `renderFormFallback` 함수 (라인 `lines.push(`• ${display}${required} (${fieldType})`)`)
- 상세: `display` (`label || name`) 와 `fieldType` 는 raw 문자열로 lines 에 추가된 뒤 `renderText` 에 전달된다. `renderText` 가 내부적으로 `escapeMarkdownV2` 를 적용하므로 최종적으로 escape 된다. 따라서 XSS/MarkdownV2 인젝션 위험은 없다. 다만 `renderText` 를 통하지 않는 `wrapMonospace`/`chunkRichText` 경로(`renderChartFallback`, `renderTableFallback`)는 escape 를 적용하지 않고 monospace code block 으로만 감싸므로, 해당 함수에 `\`` 등이 포함된 사용자 데이터가 입력될 경우 code block 이탈이 가능하다.
- 제안: `renderChartFallback`/`renderTableFallback` 의 code block 내부 데이터(`labels`, `series.name`, 셀 값)에 `` ` `` 문자를 제거 또는 대체하는 sanitize 단계를 추가 권고.

### **[INFO]** `buildInlineKeyboard` 의 link 버튼 `url` 값 검증 없음
- 위치: `telegram.adapter.ts` `buildInlineKeyboard` 함수 — `if (b.type === 'link' && b.url) return { text, url: b.url };`
- 상세: `b.url` 은 workflow 작성자가 설정하는 값으로, Telegram Bot API 에 그대로 전달된다. `javascript:` scheme 이나 내부 네트워크 URL 을 포함해도 현재 필터가 없다. Telegram 측이 클라이언트에서 URL 을 렌더하므로, 사용자 클릭 시 임의 URL 로 리다이렉트된다. 이는 Open Redirect / SSRF-클라이언트 영향 범위 문제다.
- 제안: `b.url` 이 `https://` 또는 `http://` 로 시작하는지 검증하거나, workflow 저장 단계에서 URL scheme 허용 목록 검증을 추가. 최소한 `javascript:` / `data:` scheme 을 차단.

### **[INFO]** `console.warn` 직접 사용 (NestJS Logger 미사용)
- 위치: `telegram-message.renderer.ts` 라인 `console.warn(...)` (visualNode='photo' fallback 경고)
- 상세: NestJS Logger 대신 `console.warn` 을 직접 사용한다. 보안 위협은 아니지만, 운영 환경에서 구조화 로깅(correlation id, 레벨 필터)에서 제외되어 모니터링 dead angle 이 생긴다.
- 제안: `console.warn` 을 `this.logger.warn` 으로 교체. 단 renderer 는 pure 함수라 Logger 인스턴스를 주입받기 어려우므로 호출 측(adapter) 이 로그를 담당하도록 설계 변경을 권고.

### **[INFO]** `safeHost` — URL parsing 에 `new URL` 사용, 호스트 노출 범위 적절
- 위치: `telegram-client.ts` `safeHost` 함수
- 상세: token 을 포함한 path 를 제거하고 host 만 추출하는 용도로 `new URL` 을 사용한다. 이 방식은 안전하다. 단, `TELEGRAM_API_BASE` 고정 URL 에서 파생된 URL 을 파싱하므로 실제 token 노출 리스크는 없다.
- 제안: 현행 유지.

## 요약

이번 변경(§5.1 typing indicator 선행, §5.2(3) editMessageReplyMarkup 키보드 제거, ChannelCommand `messageId` 옵션 필드 추가)은 전반적으로 보안 관점에서 양호하다. Bot token 은 secret store reference(`botTokenRef`)를 통해 간접 조회되며, 하드코딩된 시크릿은 없다. inbound signing(`secret_token`) 은 `randomBytes(24).toString('base64url')` 로 안전하게 생성된다. `editMessageReplyMarkup` 에 전달되는 `messageId` 는 내부에서 `String(number)` → `Number()` → `Number.isInteger()` 검증을 거쳐 타입 안전성이 확보된다. 실행 실패 메시지는 `classifyExecutionFailure` 분류기를 통해 사용자 안전 안내만 전달하여 민감 정보(nodeId, error.message, 내부 URL 등) 노출이 차단된다(CCH-ERR-03). 주요 우려 사항은 `buildInlineKeyboard` 의 link 버튼 URL 에 대한 scheme 검증 부재(Open Redirect 허용 가능)와 chart/table fallback 의 monospace block 내 특수문자 미sanitize(code block 이탈 가능성)이나, 두 항목 모두 workflow 작성자 신뢰 전제 하에 즉각적 외부 exploit 가능성은 낮다. Critical 또는 High 등급 취약점은 발견되지 않았다.

## 위험도

LOW
