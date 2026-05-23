# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/15-chat-channel.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-23

---

## 발견사항

### [INFO] R-CC-10 의 `botTokenRef` PATCH 차단 정책 — trigger-list Rationale R-2 와 결론 다름 (의도적 번복이나 본 spec 에만 근거 기재)
- **target 위치**: `spec/5-system/15-chat-channel.md §5.4.1 Bot Token 변경 single-path 정책` 및 `Rationale R-CC-10`
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md ## Rationale R-2. Webhook HMAC secret 입력 vs. rotate 분리 (2026-05-22)` — hmacSecret 는 "PATCH 직접 교체(v1) + rotate API(v1.1)" 양쪽 허용 패턴을 채택.
- **상세**: R-2 의 hmacSecret 패턴과 R-CC-10 의 botToken 패턴이 같은 rotation 주제에서 반대 결론(양쪽 허용 vs. rotate-only single-path)을 채택한다. 이 번복 자체는 R-CC-10 §2-(기각) 항에 "자원의 위치(server-side 보유 vs external provider 측 등록) 차이" 로 근거가 명시되어 있어 번복 Rationale 가 존재한다. 그러나 trigger-list spec 의 R-2 는 갱신되지 않았고 cross-reference 도 없다 — 두 spec 을 동시에 읽는 독자가 같은 rotation 주제에서 다른 패턴이 의도된 것인지 혼동할 여지가 남는다.
- **제안**: `spec/2-navigation/2-trigger-list.md` Rationale R-2 말미에 "botToken rotation 은 외부 provider 등록 자원의 특성상 rotate-only single-path 를 채택 (Chat Channel Spec R-CC-10 참조)" 한 줄을 cross-link 로 추가하면 두 문서를 읽는 독자가 의도적 분기임을 즉시 확인 가능.

---

### [INFO] CCH-AD-06 / §5.1 의 in-process EIA 우회 — EIA-AU-08 의 "HTTP 표면 전용" 원칙과 일관하나, EIA-IN-06 표현과 미세 충돌 가능성
- **target 위치**: `spec/5-system/15-chat-channel.md §3.1 CCH-AD-06`, `§5.1 인증`, `§5.4.2` 및 `Rationale R2`
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-08` — in-process trusted caller 예외 명시. 동 spec `§3.2 EIA-IN-06` — "단 §3.3 EIA-AU-08 + §3.3.1 Implementation Note 의 in-process trusted caller 는 제외".
- **상세**: 본 spec 의 설계(in-process direct call, scope='in_process_trusted')는 EIA-AU-08 과 완전히 정합한다. 이 자체는 문제가 없다. 단, EIA-IN-06 의 표현이 "HTTP 표면을 거치지 않는 in-process 호출에 한정"이라고 명시하는데, 본 spec §5.1 에서 동일 제약을 "HTTP guard 의 ctx 합성 시 이 플래그를 절대 set 하지 않는다"로 재기술할 때 EIA §3.3.1 에 명시된 구조적 차단 방법(DTO exclude, Guard invariant)을 단 한 문장으로 요약하는 데 그쳐 구현자가 EIA §3.3.1 을 누락 참조할 위험이 있다.
- **제안**: `§5.1 인증` 단락 끝에 "구체 Guard·DTO 제약은 [EIA §3.3.1](./14-external-interaction-api.md#331-implementation-note--in-process-trusted-caller-오염-방지-eia-au-08) 참조" 한 줄 추가 권장 (INFO 수준 — 구현 차단은 아님).

---

### [INFO] CCH-CV-03 `running` 케이스 큐잉 기각 — R9 에 근거 있으나 CCH-NF-03 rate-limit 큐와의 정책 방향 분기를 Rationale 에서만 다룸
- **target 위치**: `spec/5-system/15-chat-channel.md §3.2 CCH-CV-03`, `Rationale R9`
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §3.2 EIA-IN-11` (Idempotency-Key 24h 캐시), `§3.2 EIA-IN-12` (종료 execution 410 Gone) — EIA 의 inbound 정책 자체에는 큐잉을 금지하는 조항이 없음.
- **상세**: CCH-CV-03 의 "큐 미적재" 정책은 R9 에 상세 근거가 있고, CCH-NF-03 의 rate-limit 큐 정책과의 명시적 분리("두 케이스가 다른 정책 방향을 취하는 것이 정당하다")도 R9 말미에 기재되어 있다. 기존 EIA Rationale 에서 명시적으로 기각된 설계를 재도입하는 것은 아니다. 다만 "EIA 는 큐잉 금지를 명시하지 않았는데 Chat Channel 에서만 큐잉을 기각한 이유"가 R9 에 나타나므로, 이 결정이 EIA 위에 Chat Channel 이 좁힌 추가 제약임을 독자가 오해 없이 인식할 수 있다. 별도 조치 불필요.

---

### [INFO] R-CC-11 `text_only` → `text` + `auto` 신설 — conventions/chat-channel-adapter.md changelog 와 동기화 확인 필요
- **target 위치**: `spec/5-system/15-chat-channel.md §4.1 uiMapping.visualNode`, `Rationale R-CC-11`
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — 2026-05-23 changelog 에 "visualNode enum 교체 (`text_only`→`text` rename + `auto` 신설, default `auto`)" 동반 갱신 기록됨. 본 spec R-CC-11 §2-(a) 에도 "컨벤션 파일 자체 = 3 파일을 한 commit 으로 묶음" 명시.
- **상세**: 세 파일 동기 갱신 의무가 R-CC-11 에 선언되어 있고 컨벤션 changelog 도 동일 날짜로 갱신되어 있어 정합한다. 과거 Rationale 에서 기각된 "2-enum 유지" 안이 본 spec 에서 다시 채택되는 경우는 없다. 이 항목은 정합성 확인 결과로 이슈 없음 기록.

---

### [INFO] R8. NotificationDispatcher 단일 클래스 구조 — EIA R10 "엔진 외부 facade 단일 위치" 원칙과 정합하나 NotificationDispatcher 분리 예고와 구현 경계 주의
- **target 위치**: `spec/5-system/15-chat-channel.md Rationale R8`
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md ## Rationale R10` — "NotificationDispatcher 와 SSE 어댑터는 **엔진 외부의 facade 레이어**로 위치, 엔진 내부 코드가 직접 호출하지 않음" 합의.
- **상세**: R8 은 현재 NotificationDispatcher 가 세 fan-out 갈래를 단일 클래스에 담고 있으며, provider 증가 시 `ChannelDispatcher` 분리를 예고한다. 이 예고 자체는 EIA R10 의 "facade 계층 단일 위치" 원칙을 미래에 변경할 가능성이 있지만, v1 에서는 원칙을 준수하고 있으며 분리 조건(provider ≥ 2)도 명시되어 있다. 기각된 대안의 재도입이나 원칙 위반은 아니다.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 주요 설계 결정(새 트리거 유형 미신설, in-process EIA facade, EventEmitter subscription, rotate-only botToken single-path, 202 고정 inbound contract 등)에 대해 모두 해당 Rationale 절을 갖추고 있으며, EIA(R10, R6, R5, AU-08), Webhook(WH-EP-07), trigger-list(R-2) 등 관련 spec 의 기존 합의 원칙과 충돌하는 대안을 재도입하거나 합의된 invariant 를 우회하는 설계는 발견되지 않았다. 다만 `trigger-list Rationale R-2`(hmacSecret 양쪽 허용) 와 `R-CC-10`(botToken rotate-only) 가 같은 rotation 주제에서 다른 결론을 낼 때, 번복 근거가 본 spec 에만 존재하고 trigger-list spec 에는 cross-link 가 없어 독자 혼동 여지가 있다(INFO). 나머지 사항은 구현 가이드라인 참조 강화 수준의 개선 제안이며 모두 INFO 등급으로 구현 차단 요인은 없다.

---

## 위험도

LOW
