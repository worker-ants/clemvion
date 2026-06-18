# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/5-system/4-execution-engine.md`

---

## 발견사항

### [INFO] `button_continue` 의 `url?` 필드 — ButtonInteractionService 구현 시 누락 위험

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.3 `interaction.data` payload 규격 표 — `button_continue` 행 `{ buttonId, buttonLabel, url?, selectedItem? }` / CONVENTIONS §4.5 참조
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` § Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)" — PR-B1 항목: `waitForButtonInteraction`/`processButtonResumeTurn` 을 park-release + rehydration 으로 전환했음을 명시. `spec/conventions/node-output.md` §4.5 가 `button_continue` 를 "link 타입 버튼의 Continue 포트" 로 정의하고 `url?`·`selectedItem?` 을 조건부 동봉으로 규정.
- **상세**: Rationale 의 PR-B1 결정 이후 `ButtonInteractionService.processButtonResumeTurn` 이 `button_click` 과 `button_continue` 두 타입을 모두 처리해야 한다. `button_continue` 는 `url?` 필드가 있는 link 타입 버튼 특화 payload 다. spec 본문(§1.3)에 두 타입이 명시돼 있고, `spec/conventions/node-output.md` §4.5(ButtonInteractionService 소관이라고 명시)가 SoT 이지만, 구현 착수 시 `button_click` 케이스만 처리하고 `button_continue` + `url?` 를 누락할 위험이 있다. 이는 Rationale 위반(기각된 설계를 도입하는 것)이 아니라, Rationale 에서 합의된 "button park-resume = ButtonInteractionService 일원 처리" 원칙과 gap 이 생길 수 있는 구현 표면이다.
- **제안**: `ButtonInteractionService.processButtonResumeTurn` 구현 시 `ContinuationType.button_click` 외에 `button_continue` 메시지 타입도 처리하는지 확인. §7.4 continuation bus 의 `button_click` 메시지 타입이 현재 `button_continue` 를 포함하지 않는다는 점(§7.4 표: `continue / cancel / button_click / ai_message / ai_end_conversation / retry_last_turn` 6종, `button_continue` 별도 없음)도 검토 필요 — 이는 spec 내 잠재적 gap 으로 link 버튼 재개가 `button_click` 메시지 타입으로 통합됐는지 여부를 구현 전 확인한다.

---

### [INFO] `WaitingInteractionType='buttons'` 는 `button_click` 과 `button_continue` 를 모두 커버 — 명시적 서술 부재

- **target 위치**: `spec/5-system/4-execution-engine.md` §1.3 blocking metadata 표 (`buttons` — "정적으로 항상 blocking" 아닌 런타임 분기), `interaction.data` payload 표
- **과거 결정 출처**: `spec/conventions/interaction-type-registry.md` §1.2 — `WaitingInteractionType` 4값 (`form`/`buttons`/`ai_conversation`/`ai_form_render`) 정의; `buttons` 값이 `button_click` 과 `button_continue` 를 모두 포괄하는 `WaitingInteractionType` 임을 registry 는 설명하지 않는다
- **상세**: §1.3 표와 interaction-type-registry §1.2 의 `buttons` 행 사이에서, 하나의 `WaitingInteractionType` 값이 두 가지 재개 payload 타입(`button_click` / `button_continue`)을 포괄한다는 명시적 기술이 없다. 이는 Rationale 충돌이 아니라 서술 공백이다 — 기각된 대안 재도입이나 원칙 위반은 아니다. 그러나 ButtonInteractionService 구현자가 이 1:2 관계를 인지하지 못할 수 있다.
- **제안**: `spec/conventions/interaction-type-registry.md` §1.2 의 `buttons` 행 설명에 "(포괄 — `button_click` 및 `button_continue` 두 payload 타입)" 주석 보강을 권장한다. 필수는 아니다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 Rationale 연속성 관점에서 양호하다. Phase B(park-release + rehydration 일원화), C-1 god-class 분할(`ButtonInteractionService` 추출), per-node task queue 기각, `_retryState`/`_resumeCheckpoint` 보존 정책, `failed → running` 재진입 전이 등 모든 결정이 Rationale 에 명시됐으며, 기각된 대안(`waiting_for_retry` 신설, Temporal 이전, sticky fast-path, per-node task queue, heartbeat 기반 recovery 등)이 본문에 재도입된 흔적이 없다. 합의된 설계 원칙(항상 BullMQ enqueue, park = 세그먼트 종료, 단일 재개 경로)도 본문 전반에 걸쳐 일관 적용돼 있다. 발견사항 2건은 모두 INFO 수준 — Rationale 기반 구현 착수 시 놓치기 쉬운 세부 사항(link 버튼 `button_continue` payload 처리 누락 위험, `buttons` WaitingInteractionType 의 이중 payload 포괄 미명시)이며, 어느 것도 과거 기각된 대안의 재도입이나 합의된 invariant 위반에 해당하지 않는다.

## 위험도

LOW
