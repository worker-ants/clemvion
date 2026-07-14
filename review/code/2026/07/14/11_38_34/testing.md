# 테스트(Testing) 리뷰

대상: markdown-v2 toggle-scan 회귀 가드 테스트, `maybeNotifyIgnored` 리팩터 회귀 테스트,
execution-engine `continue*` 3 메서드 nodeId 불일치 테스트(F-6) — 총 9개 변경 파일 중
테스트 관련 3개 spec 신규/수정 + 대상 구현 4개 파일.

실제로 `codebase/backend` 워크트리에서 `npx jest markdown-v2.spec.ts hooks.service.spec.ts`
및 `execution-engine.service.spec.ts -t F-6` 를 직접 실행해 전량 통과를 확인했다
(2 suites / 54 tests passed; F-6 4 tests passed). 소스도 함께 읽어 테스트가 실제 호출 순서·
분기와 정합하는지 대조했다.

## 발견사항

- **[WARNING]** `maybeNotifyIgnored` 리팩터 회귀 테스트가 4개 분기 중 1개만 커버
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts` (신규 F-4 테스트 2건), 대응 구현 `codebase/backend/src/modules/hooks/hooks.service.ts:2559-2585` `maybeNotifyIgnored`
  - 상세: `maybeNotifyIgnored` 는 (a) `rawBody`/`message` 부재 → no-op, (b) `chat.id` 부재 → no-op, (c) `from.is_bot === true` → silent skip, (d) `isGroup` → `groupChatRefusal`, (e) 그 외 → `unsupportedMessageKind` 5개(사실상 4+1) 분기를 갖는다. 신규 추가된 2건은 모두 `chat.type: 'group'/'supergroup'` (isGroup=true) 케이스만 사용하며, 두 번째 테스트("sendMessage 실패는 삼킴")도 동일 isGroup 분기를 재사용한다. `is_bot=true` silent-skip 분기와 `unsupportedMessageKind`(non-group) 분기, `chat.id` 부재 분기는 이 파일 전체에서 `grep`으로도 전혀 검출되지 않아(테스트 파일에 `is_bot` 리터럴은 새 2건에서 `is_bot: false` 로만 등장) 실질적으로 미검증 상태다. 리팩터 이전에도 이 분기들이 테스트되지 않았을 가능성이 높아 이번 변경이 "새로 만든 갭"은 아니지만, `sendBestEffortNotice` 공유 헬퍼로의 리팩터(F-4)가 "회귀 가드" 를 표방하는 만큼 봇 자기메시지 silent-skip(오발송 방지 — 봇↔봇 루프 위험과 직결)과 default `unsupportedMessageKind` 문구 분기는 이번 기회에 함께 커버하는 편이 리팩터의 안전망으로서 더 견고하다.
  - 제안: `it('is_bot=true → sendMessage 미호출 (silent skip)')`, `it('non-group + unsupported kind → unsupportedMessageKind 안내 발송')`, `it('message/chat.id 없음 → sendMessage 미호출')` 3건 추가 권장. 기존 base 케이스("parseUpdate 가 null 반환 시 ...")도 `expect(mockAdapter.sendMessage).not.toHaveBeenCalled()` 어서션이 없어 "silent" 를 실제로 검증하지 않는다 — 같이 보강 여지.

- **[INFO]** `firstUnescapedMarkdownV2Special` 트레일링 lone-backslash 엣지케이스 미검증
  - 위치: `codebase/backend/src/modules/chat-channel/shared/markdown-v2.spec.ts`
  - 상세: 구현(`markdown-v2.ts:178-191`)은 `\` 를 만나면 다음 1문자와 함께 `i += 2` 로 건너뛴다. 문자열이 홀수 개의 트레일링 backslash 로 끝나는 경우(예: `'abc\\'`, 즉 문자열 그대로 `abc\`) 마지막 backslash 는 "다음 문자를 escape 하려 했으나 대상이 없는" 상태로 조용히 스킵되어 `null` 을 반환한다. MarkdownV2 관점에서 이런 malformed trailing escape 자체가 telegram 400 을 유발할 수 있는데(에스케이프 대상 부재), 이 함수의 책무(예약문자 탐지)를 벗어나는 것으로 보이긴 하나 최소 1개 케이스로 "의도된 동작"임을 문서화하는 회귀 테스트가 있으면 향후 구현 변경 시 의도 훼손을 방지할 수 있다.
  - 제안: 필수는 아님. 여유가 되면 `firstUnescapedMarkdownV2Special('trail\\')` → `null` (트레일링 backslash는 특수문자 미검출) 케이스 1건 추가.

- **[INFO]** `MARKDOWN_V2_SPECIAL_CHARS ↔ escapeMarkdownV2` 계약 테스트는 단일문자 단위로만 검증
  - 위치: `markdown-v2.spec.ts:69-81`
  - 상세: `escapeMarkdownV2(ch)` 를 문자 하나씩만 통과시켜 "집합 일치" 를 검증한다. 이는 SoT drift 방지 목적으로는 충분하고 타당하지만(렌더러의 `MD_V2_ESCAPE_REGEX` 가 별도 하드코딩된 리터럴이라는 점을 실제로 확인함 — `telegram-message.renderer.ts:29-31`), 연속 특수문자 조합("`a.b!c`" 등)에 대한 렌더러 자체의 전체 문자열 escape 정확성은 이 테스트의 범위 밖이다(별도 renderer spec 이 이미 커버하고 있을 가능성 높음 — 이번 diff 범위 밖이라 확인 안 함).
  - 제안: 조치 불필요. 계약 테스트의 역할 범위가 명확하므로 현행 유지 권장.

- **[INFO]** execution-engine F-6 테스트는 검사 순서 의존을 우회하는 좋은 설계 — 확인만 공유
  - 위치: `execution-engine.service.spec.ts:2013-2049` (F-6 4건), 대응 구현 `execution-engine.service.ts:5338-5355` `resolveWaitingNodeExecutionId`
  - 상세: 소스를 직접 대조한 결과 nodeId 불일치 검사(`5342`)가 표면(surface) 검사(`assertCommandMatchesWaitingSurface`, `5350`)보다 **먼저** 실행된다. 신규 테스트는 mock 대기 노드의 기본 표면을 `ai_conversation`(4종 명령 모두 허용 — 코드 주석상 확인)으로 두고 `continueButtonClick`/`continueAiConversation`/`endAiConversation` 3개 전부에 `wrong-node` 를 전달한다. 표면이 모든 명령을 허용하는 값으로 고정되어 있어, 설사 향후 구현에서 두 검사의 순서가 뒤바뀌어도(표면 검사 선행) 이 표면 값 자체가 통과하므로 테스트는 여전히 nodeId 불일치 자체만 순수하게 격리해 검증한다 — 우연이 아니라 의도된 견고한 설계로 보인다. 긍정 케이스(`continueAiConversation` + `n-wait` 일치 → publish)도 1건 포함되어 있고, `continueButtonClick`/`endAiConversation` 의 nodeId-일치 positive path 는 파일 내 다른 기존 테스트(2065, 2097, 2289 line 대)에서 이미 커버되어 중복 없이 상호 보완한다. 조치 불필요 — 강점으로 기록.

- **[INFO]** `mockBus.publish` 관련 테스트 격리 확인
  - 위치: `execution-engine.service.spec.ts:1968-1977` (describe-local `mockBus` 재바인딩 + `beforeEach` 의 `mockBus.publish.mockClear()`)
  - 상세: 동일 파일 앞부분(`1400`)에 `acquireLock`/`releaseLock` 만 가진 별도 지역 `mockBus` 가 존재해 shadowing 되는 구조다. 실제로는 F-6 테스트가 속한 describe 블록이 `beforeEach` 로 `publish` 를 포함한 새 지역 변수를 재획득하고 매 테스트 전에 `mockClear()` 하므로 이전 테스트의 `publish` 호출 잔여가 새지 않는다 — 격리 정상. 다만 동일 파일 내 이름이 겹치는 지역 변수가 여러 곳에 존재하는 구조라 향후 유지보수 시 실수로 잘못된 스코프를 참조할 위험은 낮게 존재(가독성 이슈, 테스트 정확성 자체는 문제없음).
  - 제안: 조치 불필요. 참고로 남김.

## 요약

세 신규/변경 spec 모두 실제로 실행해 통과를 확인했고, 소스 대조 결과 테스트가 실제 검사 순서·기본값과 정합하게 설계되어 있다(특히 execution-engine F-6 은 검사 순서 변경에도 견고하도록 표면 값을 의도적으로 고정한 점이 눈에 띈다). markdown-v2 toggle-scan 회귀 가드는 실제 버그(연속 backslash 오탐/미탐)를 정확히 재현하는 최소 케이스를 갖췄고, `MARKDOWN_V2_SPECIAL_CHARS ↔ escapeMarkdownV2` SoT drift 가드도 렌더러가 별도 하드코딩 regex 를 쓴다는 사실을 직접 확인해 실효성을 검증했다. 유일한 실질적 갭은 `maybeNotifyIgnored`(F-4) 리팩터 테스트가 group-chat 분기 하나에 편중되어 `is_bot` silent-skip·`unsupportedMessageKind` default 분기·`chat.id` 부재 분기가 이 diff 전후로도 계속 미검증 상태라는 점이며, "회귀 가드" 를 표방하는 리팩터의 안전망으로서는 다소 부족하다. 전반적으로 CRITICAL 급 결함은 없으며, WARNING 1건은 방어적 리팩터의 커버리지 폭을 넓히는 권고 수준이다.

## 위험도

LOW
