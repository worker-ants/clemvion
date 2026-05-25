# Rationale 연속성 검토 — `spec/conventions/chat-channel-adapter.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 시점: 2026-05-25
대상 파일: `spec/conventions/chat-channel-adapter.md`

---

## 발견사항

### [WARNING] `revokeBotToken?` 추가에 대한 Rationale 부재 — "6함수 인터페이스" 원칙과 문서 불일치

- **target 위치**: `spec/conventions/chat-channel-adapter.md` §1 `interface ChatChannelAdapter` (line 71), §1.1 표 마지막 행 (line 85)
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md ## Rationale` → R2 "6함수 (5+1 ack) 의 의도 (2026-05-21)" + R-CCA-5 대안 2 기각 + R-CCA-7 대안 2 기각
- **상세**: R2 는 "6함수 (5+1 ack)" 을 제목으로 하며 `ackInteraction` 을 별도 함수로 둔 이유를 설명한다. R-CCA-5 대안 2 는 "어댑터 인터페이스에 `renderError(event)` 신설" 을 명시 기각하면서 기각 근거로 "R2 의 인터페이스 최소화 원칙 그대로 적용 — 6함수 인터페이스 (§1) drift 발생" 을 명시했다. R-CCA-7 대안 2 역시 "7번째 함수 `renderPresentationNode` 신설" 을 기각하며 "함수 개수 6 유지 (R-CCA-5 정신 보존)" 를 근거로 인용했다.

  그런데 `revokeBotToken?(oldBotToken: string): Promise<void>` 는 PR #308 (commit `3a1389b6`, 2026-05-24) 에서 인터페이스에 추가됐다. 이 메서드는 optional (`?`) 이므로 기존 어댑터의 contract 를 깨지 않지만 인터페이스 member 수는 7개(6 mandatory + 1 optional)가 된다. 이에 대해 다음 두 가지 문서 문제가 존재한다:
  1. **Changelog 에 기록 없음**: 2026-05-24 날짜의 Changelog 3개 항목(`inboundSigningRef` 통합, `teamId` 추가, `botIdentity` 추가)은 모두 `ChatChannelConfig` 데이터 타입 변경이며, `revokeBotToken?` 인터페이스 추가는 Changelog 에 전혀 기재되어 있지 않다.
  2. **R2 제목 "6함수 (5+1 ack)"의 불일치**: R-CCA-5 / R-CCA-7 이 "함수 개수 6 유지" 를 근거로 두 신규 함수를 기각했음에도, 이미 optional 7번째 함수가 있다는 사실이 R2 본문 어디에도 반영되지 않았다. 검토자가 R2 와 R-CCA-5 / R-CCA-7 만 보면 "인터페이스는 항상 6함수"라고 잘못 읽을 수 있다.
- **제안**:
  - Changelog 에 `revokeBotToken?` 추가 항목(2026-05-24) 기재 — 이유(Slack `auth.revoke` 등 provider 별 optional revocation, best-effort) 명시.
  - R2 제목을 "6+1opt 함수" 또는 "6함수 (5+1 ack) + optional `revokeBotToken?`" 으로 갱신하거나, R2 본문 내 한 줄 보강("인터페이스에 optional `revokeBotToken?` 이 존재하나 mandatory 카운트는 6 유지 — Changelog 2026-05-24 참조").
  - R-CCA-5 / R-CCA-7 의 "함수 개수 6 유지" 표현을 "6 mandatory 함수 유지 (optional `revokeBotToken?` 제외 카운트)" 로 명확화하거나, 두 기각 항목이 mandatory 함수 기준임을 한 줄로 인라인 명시.

---

### [INFO] Changelog 내부 일관성 — `ai_form_render` 정책 기술 순서상 혼동 가능

- **target 위치**: `spec/conventions/chat-channel-adapter.md ## Changelog` 2026-05-25 두 번째 항목 (line 488) 과 세 번째 항목 (line 490)
- **과거 결정 출처**: R-CCA-6 "ai_conversation / ai_form_render waiting — chat channel silent 정책 (2026-05-25)"
- **상세**: Changelog 2026-05-25 두 번째 항목(line 488)은 `ai_form_render` 행 신설에서 "chat channel 안에서는 form 인라인 렌더 어려워 `ai_conversation` 과 동일 경로 (conversationConfig.message 표시)" 라고 기술한다. 곧이어 세 번째 항목(line 490)은 "§3 매핑 표의 `ai_conversation` / `ai_form_render` 행을 **silent (빈 array)** 로 정정" 한다. 결과적으로 두 번째 항목이 서술한 `conversationConfig.message 표시` 는 세 번째 항목에 의해 즉시 철회된다.

  현행 §3 매핑 표 (lines 277-278) 는 두 타입 모두 `silent — 빈 array` 로 최종 명시되어 있고 R-CCA-6 도 해당 결정을 적절히 문서화하고 있으므로, 스펙 내용 자체는 정합하다. 그러나 Changelog 를 순서대로 읽으면 두 번째 항목이 "표시하겠다"고 선언하고 세 번째가 바로 정정하는 구조라, "중간 상태가 commit 됐다 철회됐다"로 오독될 수 있다.
- **제안**: Changelog 두 번째 항목의 `ai_form_render` 관련 문구에서 "(conversationConfig.message 표시)" 부분을 "(ai_conversation 과 동일 — 직후 silent 로 재정정, 세 번째 항목 참조)" 로 수정하거나, 두 항목을 하나로 합쳐 최종 결정만 명시한다.

---

### [INFO] R-CCA-7 의 "EIA-RL-04 (TX commit 후 발송) 정합" 단언 — 수동 검증 필요

- **target 위치**: `spec/conventions/chat-channel-adapter.md ## Rationale` → R-CCA-7 세부 (b) "EIA-RL-04 (TX commit 후 발송) 정합" (line 466)
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md ## Rationale` → R10 "WebsocketService 단일 sink 정책의 확장" + EIA §9.3 (EIA-RL-04)
- **상세**: R-CCA-7 (b) 항은 "`WebsocketService.emitToExecution` 이 실행 엔진 §4.4 의 단일 sink 로서 TX commit 후 호출됨. NotificationDispatcher after-commit hook 과 동일 fan-out 채널 — `execution.node.completed` 도 동일 보장." 이라고 단언한다. 이 단언은 `execution.node.completed` 가 `WebsocketService.executionEvents$` Subject 를 통해 `ChatChannelDispatcher` 에 도달할 때 실제로 TX commit 후 emit 된다는 가정에 의존한다.

  EIA R10 의 원 결정은 "NotificationDispatcher 는 별도 outbox/after-commit hook 으로 트리거 (§9.3 참조). 엔진 내부 코드가 직접 호출하지 않음" 이고, `WebsocketService.emitToExecution` 이 단일 sink 이지만 `execution.node.completed` 는 EIA §6.1 화이트리스트 밖의 in-process 이벤트다. 실행 엔진 §4.4 의 단일 sink 정책 원문이 이 이벤트의 emit 시점을 TX commit 후로 명시하는지 현재 문서 내에서 확인되지 않는다 (실행 엔진 §4.4 본문 참조).

  spec 상 assertion 과 실제 emit 경로가 일치하지 않을 경우 EIA-RL-04 위반(commit 전 발송 → 부분 실패 시 이벤트 노출)이 발생할 수 있다.
- **제안**: 구현 착수 전 실행 엔진 spec §4.4 또는 코드(`WebsocketService.emitToExecution` 호출 시점)를 확인해 `execution.node.completed` 가 TX commit hook 내에서 emit 되는지 검증. 검증 결과를 R-CCA-7 (b) 항에 1줄 보강("실행 엔진 §4.4 의 after-commit hook 검증 완료 — [commit hash / PR #N]").

---

## 요약

`spec/conventions/chat-channel-adapter.md` 는 전반적으로 과거 Rationale 결정(R1~R4, R-CCA-5~R-CCA-7, 관련 Chat Channel / EIA Rationale)과 정합하게 작성되어 있다. 명시적으로 기각된 대안(renderError 신설, 7번째 함수 신설, EIA outbound 화이트리스트 확장, `error.message` 직접 노출, EIA `EiaEvent` union 에 `node.completed` 흡수 등)을 재도입하지 않았고, 합의된 설계 원칙(EIA-RL-04 정합, R10 단일 sink, pure/side-effect 분리, 인터페이스 최소화)을 대체로 준수한다. 다만 `revokeBotToken?` optional 메서드의 추가가 Changelog 에 기록되지 않았고, R2 / R-CCA-5 / R-CCA-7 의 "6함수" 표현이 7번째 optional 메서드 존재와 겉으로 모순되어 보이는 문서 불일치(WARNING 등급)가 남아 있다. 이는 기각된 결정의 재도입이나 invariant 위반이 아닌 문서 보완 사항이다.

## 위험도

LOW
