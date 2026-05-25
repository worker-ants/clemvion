# 문서화(Documentation) 코드 리뷰

**검토 대상**: chat-channel template render outbound 구현 (CCH-MP-06 / CCH-MP-01 보강 / CCH-AD-07)
**검토 일시**: 2026-05-25

---

## 발견사항

### [INFO] `chat-channel.dispatcher.ts` — `toEiaEvent` JSDoc 반환 타입 기술이 정확함
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 변경된 JSDoc 블록
- 상세: `toEiaEvent` 함수의 JSDoc 이 `EiaEvent | ChatChannelInternalEvent | null` 로 정확하게 갱신되었고, "반환 union 의 후자(ChatChannelInternalEvent)는 EIA outbound §6.1 화이트리스트 5종 외 — chat-channel-internal 한정 listener 전용" 이라는 설명과 SoT 링크도 포함되어 있다. 문서화 측면에서 적절하다.
- 제안: 없음.

### [INFO] `types.ts` — `EiaAiMessageEvent.presentations?` JSDoc 충실
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` 205번째 행 근처 신규 JSDoc 블록
- 상세: `presentations?` 필드에 대한 JSDoc 이 SoT 3곳(chat-channel-adapter.md §1.2, ai-agent.md §7.10, external-interaction-api.md §6.5) 을 cross-link 하고, "4종 display-only 한정" 및 "render_form 은 별 plan 추적" 을 명시하고 있어 충분한 문서화가 이루어졌다.
- 제안: 없음.

### [INFO] `types.ts` — `ChatChannelInternalEvent` / `EiaNodeCompletedEvent` JSDoc 충실
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` 240번째 행 근처 신규 타입 정의
- 상세: `ChatChannelInternalEvent` 타입과 `EiaNodeCompletedEvent` 인터페이스 모두 SoT 참조, 구독 소스 설명, sub-filter 동작, blocking 케이스 제외 사유 등을 JSDoc 으로 충분히 기술하고 있다.
- 제안: 없음.

### [INFO] `types.ts` — `ChatChannelAdapter.renderNode` JSDoc 갱신됨
- 위치: `codebase/backend/src/modules/chat-channel/types.ts` 310번째 행 근처
- 상세: `renderNode` 메서드에 신규 JSDoc 이 추가되어 `EiaEvent | ChatChannelInternalEvent` union 입력과 "어댑터 구현체는 `event.type` discriminated union 분기로 처리" 및 SoT 링크를 포함한다. 인터페이스 변경에 맞춰 문서화가 충분히 업데이트되었다.
- 제안: 없음.

### [WARNING] Discord / Slack renderer — `renderPresentationByType` 함수에 JSDoc 없음
- 위치:
  - `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` 의 `renderPresentationByType` 함수 (내부 헬퍼)
  - `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` 의 `renderPresentationByType` 함수 (내부 헬퍼)
- 상세: Telegram renderer 의 동일 함수(`renderPresentationByType`)는 상세한 JSDoc (두 진입점 공유 설명, template 1/2 케이스 설명, §5.4 v1 fallback 재사용 명시) 이 있다. Discord 및 Slack renderer 의 `renderPresentationByType` 에는 이에 상응하는 JSDoc 이 없어 세 파일 사이에 문서화 수준 불일치가 발생한다. 동일 로직(template `rendered` 두 경로 추출 + visual fallback 위임) 을 세 파일에 복제했으므로, 향후 유지보수 시 Telegram JSDoc 을 참고해야 한다는 사실이 명시되어 있지 않다.
- 제안: Discord 와 Slack 의 `renderPresentationByType` 에 Telegram 버전의 JSDoc 과 동일 수준의 설명을 추가하거나, 최소한 "SoT: spec/conventions/chat-channel-adapter.md §3" 및 두 진입점 공유 사실을 한 줄로 기재한다.

### [WARNING] Discord / Slack renderer — `renderPresentationPayload` 함수에 JSDoc 없음
- 위치:
  - `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` 의 `renderPresentationPayload` 함수
  - `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` 의 `renderPresentationPayload` 함수
- 상세: Telegram 의 `renderPresentationPayload` 에는 "AI Agent `render_*` 도구가 emit 한 PresentationPayload 1건 처리", "payload shape은 §7.10 PresentationPayload", "type === 'form' 은 별 plan 추적 — skip", "v1 fallback 재사용" 등의 JSDoc 이 있다. Discord 및 Slack 의 동일 함수에는 대응하는 JSDoc 이 없다.
- 제안: Discord 및 Slack 의 `renderPresentationPayload` 에 `form` skip 이유, payload wrapping 이유, SoT 참조를 최소 한 줄씩 추가한다.

### [WARNING] Discord / Slack renderer — `renderNodeCompleted` JSDoc 수준 차이
- 위치:
  - `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` 의 `renderNodeCompleted` JSDoc
  - `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` 의 `renderNodeCompleted` JSDoc
- 상세: Discord 와 Slack 의 `renderNodeCompleted` JSDoc 은 "CCH-MP-06 (2026-05-25): 비-blocking presentation 노드 완료 → 메시지. v1 fallback 정책 (markdown/mrkdwn 텍스트) 그대로 적용." 수준으로 간략하다. Telegram 의 JSDoc 은 "v1 fallback 정책은 CCH-MP-04 (텔레그램 §5.4) 와 동일", "SoT: spec/5-system/15-chat-channel.md §3.3 CCH-MP-06, spec/conventions/chat-channel-adapter.md §3 매핑 표 + §R-CCA-7" 등의 2중 SoT 링크를 포함한다. Discord/Slack 에는 SoT 링크가 누락되어 있다.
- 제안: Discord 및 Slack `renderNodeCompleted` JSDoc 에 Telegram 과 동일하게 SoT 참조(`spec/5-system/15-chat-channel.md §3.3 CCH-MP-06`, `spec/conventions/chat-channel-adapter.md §3 §R-CCA-7`) 를 추가한다.

### [INFO] 사용자 문서(MDX) — Telegram/Slack/Discord 4종 문서 업데이트 완료
- 위치:
  - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` (한국어)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` (영어)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` (한국어)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx` (영어)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` (한국어)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` (영어)
- 상세: 모든 채널의 한국어·영어 문서에 AI Agent render 도구 / Template 섹션이 추가되었고, v1 fallback 정책과 향후 계획(`chat-channel-visual-ssr-png`)도 명시되어 있다. Telegram 의 노드 유형 표에 Template 행이 신설되었고, AI Multi Turn 행의 설명도 render 도구 동작을 반영하여 확장되었다. `render_form` 은 별 plan 추적임을 사용자 문서에서도 명시하여 scope 경계가 명확하다.
- 제안: 없음.

### [INFO] 테스트 파일 블록 주석 — SoT 참조 패턴 일관적
- 위치:
  - `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 라인 36~44 블록 주석
  - `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.spec.ts` 라인 532~538 블록 주석
- 상세: 두 테스트 파일 모두 "날짜 — 기능 설명 (요구사항 ID) / SoT 참조" 형식의 블록 주석으로 테스트 목적과 SoT 를 명시하고 있어 테스트 코드의 존재 이유를 즉시 파악할 수 있다.
- 제안: 없음.

### [INFO] spec 파일 — `chat-channel-adapter.md §1.3` / `15-chat-channel.md` / `14-external-interaction-api.md` 동반 갱신 확인
- 위치:
  - `spec/conventions/chat-channel-adapter.md` (파일 48, diff 생략)
  - `spec/5-system/15-chat-channel.md` (파일 47, diff 생략)
  - `spec/5-system/14-external-interaction-api.md` (파일 46)
  - `spec/4-nodes/7-trigger/providers/telegram.md` (파일 45)
- 상세: 코드 변경과 함께 관련 spec 문서들이 모두 동반 갱신되었다. `14-external-interaction-api.md §R10` 에 chat-channel-internal 추가 listener 의 허용 범위가 명시되었고, `telegram.md §5.4` 노드타입 표의 `template` 행이 실제 구현과 일치하도록 갱신되었으며, v1 fallback 정책의 세 진입점(CCH-MP-04 / CCH-MP-06 / CCH-MP-01 보강) 을 안내하는 callout 블록이 추가되었다.
- 제안: 없음.

### [INFO] CHANGELOG 업데이트 — plan 파일에서 추적하나 별도 CHANGELOG 파일 미확인
- 위치: 변경 이력 전반
- 상세: 이 프로젝트는 별도의 `CHANGELOG.md` 파일 패턴 대신 `plan/` 폴더의 완료 이동 및 spec 문서의 날짜 주석(`2026-05-25`) 으로 변경 이력을 추적하는 방식을 채택하고 있다. spec 문서와 plan 파일에서 "2026-05-25" 날짜와 기능명으로 변경을 추적할 수 있다. spec-draft plan 이 `plan/complete/` 로 이동(`spec-draft-chat-channel-template-render-outbound.md`)되어 완료 이력을 보존한다.
- 제안: 없음 (프로젝트 규약에 부합).

### [INFO] `SUBSCRIBED_EVENTS` Set 의 주석 — SoT 참조 충분
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` 28~33행
- 상세: `'execution.node.completed'` 추가 시 "chat-channel-internal — EIA §6.1 outbound 화이트리스트 외 추가 구독. SoT: spec/5-system/15-chat-channel.md §3.1 CCH-AD-07 + spec/conventions/chat-channel-adapter.md §1.3. presentation 노드 4종 한정 sub-filter + blocking 케이스 사전 제외 (다른 노드는 null 반환)" 설명이 달려 있어 왜 이 이벤트가 화이트리스트 외부에 별도 추가되었는지 이해할 수 있다.
- 제안: 없음.

### [WARNING] Discord / Slack renderer — `renderPresentationByType` 의 `template` 분기 인라인 주석 부재
- 위치:
  - `codebase/backend/src/modules/chat-channel/providers/discord/discord-message.renderer.ts` 의 `renderPresentationByType` 내 `if (type === 'template')` 분기 (라인 368~378)
  - `codebase/backend/src/modules/chat-channel/providers/slack/slack-message.renderer.ts` 의 `renderPresentationByType` 내 `if (type === 'template')` 분기 (라인 492~501)
- 상세: Telegram 의 동일 분기에는 "1) execution.node.completed: `output = { rendered: '...' }` / 2) ai_message.presentations[i]: `nodeOutput = { payload: { rendered: '...' } }`" 형식으로 두 진입 경로를 설명하는 인라인 주석이 있다. Discord 와 Slack 에는 이 두 경로를 설명하는 주석이 없어 `rendered` 값을 두 위치에서 탐색하는 이유를 코드만으로 추론해야 한다.
- 제안: Discord 및 Slack 의 해당 분기 상단에 Telegram 과 동일한 "1) / 2)" 설명 인라인 주석을 추가한다.

---

## 요약

이번 변경은 전반적으로 문서화 품질이 높다. `types.ts` 의 신규 타입들(`ChatChannelInternalEvent`, `EiaNodeCompletedEvent`, `presentations?` 필드) 은 SoT 링크·동작 설명·scope 경계를 포함하는 충실한 JSDoc 을 갖추고 있으며, `chat-channel.dispatcher.ts` 의 `toEiaEvent` JSDoc 도 반환 타입 union 변경을 정확히 반영하고 있다. 사용자 문서(Telegram/Slack/Discord MDX 6종) 는 한국어·영어 모두 신기능(AI render 도구 / Template 발화)을 사용자 눈높이에서 설명하고 있고, 관련 spec 파일 4종도 동반 갱신되어 있다. 다만 Discord 와 Slack renderer 는 Telegram renderer 와 동일한 함수 3종(`renderPresentationByType`, `renderPresentationPayload`, `renderNodeCompleted`) 을 각각 복제 구현하면서, Telegram 에 작성된 JSDoc 및 인라인 주석을 그대로 이식하지 않아 세 파일 사이에 문서화 수준 불일치(WARNING 4건) 가 발생한다. 향후 이 세 함수의 로직이 달라질 경우 Telegram 의 주석만 업데이트되고 Discord/Slack 은 누락되는 오래된 주석 리스크가 잠재한다. 이 불일치는 기능 동작에는 영향을 주지 않으나 유지보수성 관점에서 보완이 권장된다.

---

## 위험도

LOW

(WARNING 4건은 모두 Discord/Slack renderer 의 헬퍼 함수 JSDoc/주석 누락으로, 기능 정확성과 무관한 유지보수성 이슈다. 사용자 문서와 spec 문서는 충분히 업데이트되어 있으며, 핵심 공개 API(`renderNode`, `toEiaEvent`, 신규 타입들) 의 문서화는 적절하다.)

STATUS: SUCCESS
