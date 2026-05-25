# RESOLUTION — 18_01_18

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|---|---|---|---|
| C1 | 거짓양성 | 무시 | reviewer 가 main HEAD 만 본 stale view. spec PR commit 8cb53a1e 에 모든 ID 존재 |
| C2 | 거짓양성 | 무시 | chat-channel-adapter.md line 43/82/269 에 시그니처 갱신 확인 |
| C3 | 코드 (테스트) | discord-message.renderer.spec.ts + slack-message.renderer.spec.ts 에 각 6 it 추가 (총 12건) | execution.node.completed 4종 + ai_message presentations[] sequential + form-skip + 빈 rendered guard |
| W1 | 코드 (real bug) | chat-channel.dispatcher.ts `toEiaEvent` ai_message case 에 presentations 추출 추가 + 단위 테스트 3건 | 본 fix 가 없으면 CCH-MP-01 보강 (회귀 ②) 가 실제로는 미동작 |
| W4 | 코드 (type drift) | telegram.adapter.ts / discord.adapter.ts / slack.adapter.ts 의 renderNode 시그니처를 `EiaEvent \| ChatChannelInternalEvent` 로 갱신 | TypeScript 타입 보호망 회복 |
| W10 | 코드 (consistency) | telegram-message.renderer.ts switch 에 `default: return []` 추가 | Discord/Slack 와 일관 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (4936 passed, +15 신규)
- build : 통과
- e2e   : 통과 (123/123)

## 보류·후속 항목

W2 / W3 / W11 / W12 / W13 (5건) + INFO 일부 — tech-debt. 별 refactor PR 후보:
- W2: chat-channel/shared/presentation-renderer.ts 공통 헬퍼 추출
- W3: `toEiaEvent` → `toChatChannelEvent` rename (cross-file 영향)
- W11: Discord/Slack renderer 의 helper 함수 JSDoc 보완
- W12: `ChatChannelInternalEvent` 와 `EiaEventBase` 의 type hierarchy 분리
- W13: sub-filter null vs 에러성 null 의 로그 레벨 분리

본 PR scope (회귀 ①+② fix) 와 무관 — 별도 plan 으로 추적.
