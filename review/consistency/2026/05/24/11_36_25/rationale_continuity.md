# Rationale 연속성 검토 결과

**검토 대상**: `plan/in-progress/spec-chat-channel-inbound-signing-rename.md`
**검토 일시**: 2026-05-24
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### [INFO] 기각된 3-필드 안이 Rationale 에 명시적으로 기록됨 — 연속성 양호
- target 위치: plan §0 배경 표 + §1 산출물 목록 (Phase 2)
- 과거 결정 출처: `slack.md ## Rationale R-S-1` 항목 2번 기각 안 / `discord.md ## Rationale R-D-1` 항목 2번 기각 안
- 상세: target plan 이 제거하려는 3-필드(`secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?`)는 slack.md R-S-1 에서 "초기 안"으로 명시하며 기각 이유를 설명하고, discord.md R-D-1 에서 "`publicKeyRef` 별 필드" 를 기각 안으로 기록한다. target plan 이 이 기각 안들의 이름을 역으로 "제거 대상"으로 거론하는 것은 — 즉 "기각된 안을 다시 채택"하는 것이 아니라 "현재 존재하는 구현을 기각된 안이라고 식별해 제거"하는 것이므로 — Rationale 연속성 관점에서 충돌이 없다. 해당 Rationale 은 이미 동일 plan(`spec-chat-channel-inbound-signing-rename`)을 근거로 갱신 완료되어 있어 출처 추적도 명확하다.
- 제안: 특별한 조치 불필요. 관계가 올바르게 연결되어 있음.

---

### [INFO] `SetupResult.issuedSecretToken` → `issuedInboundSigning` rename 이 Rationale 에 묵시적으로만 처리됨
- target 위치: plan §1 산출물 목록의 `spec/conventions/chat-channel-adapter.md` 행 ("§2.4 `SetupResult.issuedSecretToken` 도 `issuedInboundSigning` 으로 rename")
- 과거 결정 출처: `chat-channel-adapter.md` Changelog 2026-05-22 행 ("§2.4 `SetupResult` — `configUpdates` + `issuedSecretToken` 분리 정식화") 및 `secret-store.md` §5.1 코드 예시
- 상세: `issuedSecretToken` 은 2026-05-22 chat-channel-adapter.md 개정에서 정식 필드 이름으로 확정된 것이고, 이번 plan 이 그것을 `issuedInboundSigning` 으로 rename 한다. 현재 chat-channel-adapter.md Changelog (2026-05-24 마지막 행) 에는 이 rename 이 명시되어 있으나, Rationale 절에는 해당 필드 rename 에 대한 독립 항목이 없다. R1 (6함수 책임 분리) / R2~R4 가 필드 세부 naming 을 다루지 않아 "왜 issuedSecretToken → issuedInboundSigning 인가"의 설계 근거가 Rationale 에 부재하고 Changelog 에만 존재한다.
- 제안: spec-chat-channel-inbound-signing-rename 산출물의 chat-channel-adapter.md Rationale 에 "R5. `issuedSecretToken` → `issuedInboundSigning` rename — role-based naming 일관성 (2026-05-24)" 한 항을 추가하면 Rationale 연속성이 완결된다. 단, Changelog 가 이미 의도를 서술하고 있어 이 부재가 기능적 문제를 일으키지는 않는다.

---

### [INFO] `secret-store.md §5.1` 코드 예시에 `issuedSecretToken` 이 아직 `issuedInboundSigning` 으로 갱신되지 않은 상태
- target 위치: plan §1 산출물 목록 — `spec/conventions/secret-store.md` 는 §1 예시 표만 갱신 대상으로 명시함
- 과거 결정 출처: `secret-store.md §5.1` Trigger 생성 예시 코드 및 §2.4 `SetupResult` 명세
- 상세: `secret-store.md §5.1` 코드 예시는 아직 `issuedInboundSigning` 필드명을 직접 참조하지 않으나 (호출 흐름이 `SetupResult.issuedInboundSigning` 을 인용함), `secret-store.md` 본문 §5.1 의 `if (dto.chatChannel?.botToken)` 블록이 여전히 `secretTokenRef` 관련 legacy config 구조를 간접 반영하는지 확인이 필요하다. 실제 현재 파일 내용을 보면 §5.1 코드의 chatChannel 설정 블록은 `botTokenRef` 만 보관하고 `inboundSigningRef` 초기화를 포함하지 않는다. 이는 `SetupResult.issuedInboundSigning` 처리 흐름을 §5 패턴 예시에서 누락한 것으로 plan 에서 명시적 산출물로 포함되지 않았다.
- 제안: target plan §1 산출물에 `spec/conventions/secret-store.md §5.1` 코드 예시에 `issuedInboundSigning` ref 보관 흐름 추가를 포함시키면 완결성이 높아진다. 단, §1 URI scheme 표가 단일 진실이고 §5.1 은 예시 패턴이므로 누락이 Rationale 연속성 위반은 아니다.

---

## 요약

target plan(`spec-chat-channel-inbound-signing-rename`)은 Rationale 연속성 관점에서 매우 양호하다. 제거 대상인 3종 provider-specific 필드(`secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?`)는 기존 slack.md R-S-1 및 discord.md R-D-1 에서 이미 "기각 안"으로 명시되어 있으며, 채택 안(`inboundSigningRef` 단일 슬롯)도 같은 Rationale 에 근거와 함께 기록되어 있다. 과거에 명시적으로 기각된 대안의 무근거 재도입, 합의된 원칙 위반, 시스템 invariant 우회에 해당하는 항목은 발견되지 않는다. 발견된 INFO 항목 3건은 모두 Rationale 완결성 보강 제안으로, 실제 결정 번복이나 기각 대안 재도입에 해당하지 않는다.

---

## 위험도

NONE
