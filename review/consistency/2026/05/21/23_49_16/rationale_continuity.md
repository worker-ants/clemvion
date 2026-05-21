# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`

---

## 발견사항

### [INFO] EIA R5 "외부 WebSocket 보류" 관련 해석 — 명시적 재논의 트리거 조건 미평가

- **target 위치**: `spec/5-system/15-chat-channel.md §5.3`
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md ## Rationale §R5` — "외부 WebSocket 채널 신설 — 보류 (2026-05-21)"
- **상세**: `15-chat-channel.md §5.3` 은 "Chat Channel 어댑터는 외부 표면을 추가하지 않으므로 §R5 의 재논의 트리거 조건과 무관" 이라고 서술한다. EIA R5 의 재논의 트리거 조건 중 하나는 "inbound REST 의 round-trip latency 가 사용자 경험 저해 수준으로 측정됨 (>300ms 평균)" 이다. Chat Channel 어댑터는 in-process 경로로 HTTP round-trip 을 우회하므로 이 트리거 조건을 오히려 해소하는 구조다. §5.3 의 기술은 정확하나, "재논의 트리거와 무관" 의 이유를 "in-process 이므로 round-trip 없음 → 트리거 조건 발생 불가" 로 명확화하면 미래 검토 시 근거가 더 투명해진다.
- **제안**: §5.3 에 한 문장 추가 — "in-process 구독으로 HTTP round-trip 이 없어 R5 의 latency 재논의 트리거 조건이 본 어댑터 경로에서는 발생하지 않는다" 정도의 보완. 현재 기술이 틀린 것은 아니므로 차단은 불필요.

---

### [INFO] `chat_channel_token_v2` 컬럼명 패턴 — `notification_secret_v2` 와의 semantic 비대칭 명시 위치

- **target 위치**: `spec/5-system/15-chat-channel.md §4.2` (SQL DDL 주석) 및 `## Rationale §R-K`
- **과거 결정 출처**: EIA spec §7.1 (trigger 엔티티 확장, `notification_secret_v2`) — 직접 Rationale 항목 없으나 naming 패턴이 암묵적으로 정착
- **상세**: §R-K 가 semantic 비대칭을 명시하고 "명명 일관성 우선" 원칙으로 정당화하고 있어 Rationale 번복의 형태는 아니다. 그러나 `notification_secret_v2` 의 naming 근거가 EIA spec 본문이나 Rationale 에 별도로 기술되어 있지 않아, `chat_channel_token_v2` 의 §R-K 이 사실상 처음으로 naming 패턴을 명문화하는 역할을 한다. 양쪽을 연결하는 cross-reference 가 없으면 향후 reviewer 가 패턴 출처를 추적하기 어렵다.
- **제안**: §R-K 에 "이 패턴의 선례인 `notification_secret_v2` 는 EIA §7.1 에 정의 — EIA spec 에 해당 naming 근거가 별도 기술되지 않았으므로 본 §R-K 가 패턴 SoT" 정도의 한 줄 주석 추가 고려. 현 상태도 정합적이므로 차단 불필요.

---

### [INFO] `parseUpdate` 의 side-effect free 계약과 `languageHints.groupChatRefusal` 발송의 경계

- **target 위치**: `spec/conventions/chat-channel-adapter.md §1.1` 표 (`parseUpdate` 의 부작용 = `none`, `pure`) 및 `spec/4-nodes/7-trigger/providers/telegram.md §4` (명령 매핑 표 마지막 행)
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md ## Rationale §R1` — "parseUpdate / renderNode 는 pure 함수 / side-effect 함수 분리 = 테스트 가능성의 결정"
- **상세**: Convention §1.1 표는 `parseUpdate` 를 "DB 미접근, 외부 API 미호출, 부작용 없음, pure" 로 정의한다. 그러나 telegram.md §4 의 명령 매핑 표는 `message.chat.type ∈ ('group', 'supergroup', 'channel')` 의 경우 `null` 반환 + `languageHints.groupChatRefusal` **안내 발송** 이라고 명시한다. "안내 발송" 이 외부 API 호출(`sendMessage`)을 의미한다면 이는 `parseUpdate` 의 side-effect free 계약과 충돌한다. Convention R1 은 "side-effect 는 `sendMessage` 가 담당" 이라는 책임 분리를 명문화한 근거인데, 이 분리가 모호해진다.
- **제안**: telegram.md §4 의 표현을 "null 반환 (호출자가 `languageHints.groupChatRefusal` 을 `sendMessage` 로 발송)" 처럼 명확화하거나, 또는 `parseUpdate` 계약에 "group chat 감지 시 안내 메시지 body 를 반환값에 포함 가능 — 호출자가 `sendMessage` 로 처리" 로 계약을 확장해야 한다. 현 기술은 parseUpdate 가 sendMessage 까지 호출하는 것처럼 읽힐 수 있어 Convention R1 의 책임 분리 원칙과 거리가 있다.

---

### [INFO] Form 다단계 시퀀스의 "클라이언트-side 검증" — EIA-RL-03 와의 관계 보완

- **target 위치**: `spec/conventions/chat-channel-adapter.md §4` (Form 다단계 시퀀스 규약 step 3) 및 `## Rationale §R4`
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md ## Rationale §R8` — "Idempotency-Key 와 submit_form 검증 실패의 관계: 400 VALIDATION_FAILED 는 idempotency cache 에 적재하지 않음. submit_form 검증 실패 = waiting_for_input 유지 = 재제출 가능"
- **상세**: Convention §4 의 step 3 은 "필드 단위 클라이언트-side 검증 (type / pattern / minLength 등 schema 차원)" 에서 실패 시 "같은 필드 재질문" 이라고 한다. 이 흐름은 EIA-RL-03 의 "submit_form 검증 실패 → waiting_for_input 유지" 경로를 우회한다 (서버에 제출 자체를 않는다). EIA R8 에서 확립한 "400 VALIDATION_FAILED 는 cache 에 적재 안 함" 결정은 server-side 검증 실패 경우에만 해당한다. 이 두 경로 (클라이언트 사전 차단 vs 서버 검증 실패) 의 관계가 Convention §4 에서 명시적으로 구분되지 않아, 두 경로가 왜 다른지 알기 어렵다.
- **제안**: §4 의 step 3 주석이나 별도 문장으로 "클라이언트-side 검증은 EIA 호출 전 사전 차단 — EIA-RL-03 / R8 의 server-side 검증 실패 경로와 별개" 를 명시하면 Rationale 연속성이 완결된다. 현재는 정합적이나 독자 추론 부담이 있음.

---

## 요약

세 대상 spec (`spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`) 은 모두 최근 확립된 EIA spec (14-) 및 execution engine (4-) 의 Rationale 결정과 전체적으로 일관되게 작성되어 있다. 특히 (a) EIA R10 의 "엔진 단일 sink + 외부 facade" 원칙, (b) EIA-AU-08 의 in-process trusted caller 예외, (c) EIA R5 의 외부 WebSocket 보류 결정, (d) EIA R2 의 notification 응답으로 인터랙션 받지 않는 결정, (e) Webhook spec 의 트리거 유형 카탈로그 유지 원칙 모두 target 에서 명시적으로 채택·준수되고 있다. 유일하게 주의해야 할 표현상 모호점은 `parseUpdate` 의 side-effect free 계약과 telegram.md 의 groupChatRefusal "안내 발송" 기술의 경계이며, 구현 시 parseUpdate 가 sendMessage 까지 직접 호출하는 형태로 구현되면 Convention R1 의 책임 분리 원칙을 실제로 위반하게 된다. 그 외 발견사항은 모두 문서화 보완 제안 수준으로, 기존 Rationale 결정의 명시적 번복이나 기각된 대안의 재도입은 없다.

## 위험도

LOW
