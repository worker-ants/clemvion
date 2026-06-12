# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/15-chat-channel.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### 1. **[WARNING]** §3.3 + R8 — SSE 어댑터 Redis pub/sub "완료" 로 기술 (실제 Planned)

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.3 (SSE 어댑터와의 병존) + Rationale R8 listener #2 설명
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` Rationale R10 §(b) `sse-adapter.service.ts` 항목 + R8 구현 코드 주석 반영 ("현재 in-memory, Redis pub/sub 은 Planned")
- **상세**: chat-channel §3.3 은 "EIA §R10 의 SSE 어댑터는 Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독한다"라고 현재 완료 사실로 서술한다. 그러나 EIA R10 본문 §(b) 는 SSE 어댑터가 "현재 `executionEvents$` 를 **in-process(in-memory) 직접 구독**하여 외부 SSE 스트림으로 fan-out. **Redis pub/sub 경유 구독은 미구현 (Planned)**"임을 명시한다. R8 §v1 구조의 listener #2 역시 "SseAdapter — Redis pub/sub 으로 SSE fan-out"으로 단정 기술하여 동일한 사실 오류가 반복된다. §3.3 의 서술이 두 어댑터의 구독 메커니즘 비교("외부 SSE 는 Redis pub/sub 경유, in-process chat-channel 은 executionEvents$ 직접 구독")를 근거로 설계 차별성을 설명하려는 의도인데, 전제 사실(SSE Redis)이 현재 구현 상태와 다르다.
- **제안**: §3.3 서술을 "EIA §R10 의 SSE 어댑터는 v1 현재 in-process 직접 구독 (Redis pub/sub 은 Planned)이며, Chat Channel 어댑터 역시 같은 단일 sink 를 직접 구독한다"로 수정. R8 §v1 구조 listener #2 를 "SseAdapter (같은 모듈) — 현재 in-process(in-memory) 직접 구독, Redis pub/sub fan-out 은 Planned (EIA R10 §b)"로 갱신. §3.3 의 두 어댑터 비교 논리(Redis vs in-process)는 목적 기술(설계 의도) 로 남기되 현재 구현 상태를 "(Planned)"로 구분해야 한다.

---

### 2. **[INFO]** §6 EIA 관계 표 — `seq` 정렬·dedup 책임 귀속 표현 부정확

- **target 위치**: `spec/5-system/15-chat-channel.md` §6 EIA 와의 관계 표 첫 행 ("EIA-NX-* outbound notification" 열)
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` EIA-NX-08 ("클라이언트가 정렬·dedupe 가능"), EIA-RL-01 ("클라이언트는 X-Clemvion-Delivery 로 dedup, seq 로 정렬")
- **상세**: 해당 행은 "seq 정렬·X-Clemvion-Delivery dedup 은 어댑터 코드 안에 내장"이라고 기술한다. 그러나 EIA-NX-08 / EIA-RL-01 에서 seq 정렬·dedup 의무는 **외부 HTTP 클라이언트** 에게 귀속된다. Chat Channel 어댑터는 in-process subscriber 로 HTTP POST + HMAC 검증 단계를 우회하므로 `X-Clemvion-Delivery` UUID 헤더 자체가 존재하지 않는다. "어댑터 코드 안에 내장"이라는 표현은 기존 EIA 의 seq/dedup 책임 귀속 원칙(외부 클라이언트)을 어댑터 내부로 이전한 것처럼 읽힐 수 있다. 실제로는 in-process 구독이므로 중복 이벤트 수신 자체가 발생하지 않는 구조이며, 별도 dedup 로직이 필요하다면 그 배경 설명이 부재한다.
- **제안**: 해당 셀을 "어댑터가 in-process subscriber. HTTP POST + HMAC 검증 단계 우회 (network round-trip 없음). `seq` / `X-Clemvion-Delivery` 는 HTTP 외부 표면 전용 — in-process 구독 경로에는 적용 없음"으로 수정하거나, 어댑터 내부에서 seq를 실제로 사용하는 경우라면 그 이유를 Rationale 에 명시한다.

---

### 3. **[INFO]** CCH-MP-03 native modal 도입 — Convention R4 기각 대안 재도입 여부 명시 보완

- **target 위치**: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-03 (Form, `formMode` 분기)
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md` R4 ("Form 다단계 시퀀스를 컨벤션 차원에서 강제 — 일반적 native UI 분기는 v2 옵션")
- **상세**: Convention R4 는 native form UI 분기를 "v2 옵션"으로 미룬 결정이다. CCH-MP-03 은 native modal (`Slack views.open` / `Discord MODAL`)을 v1 에 도입한다. Convention `chat-channel-adapter.md` R-CCA-8 은 이것이 "R4 가 기각한 대안의 재도입이 **아니라** R4 본문이 명시한 미래 경로의 활성화"임을 명확히 설명하고 있다. 그러나 chat-channel spec 자체의 CCH-MP-03 본문과 Rationale 에는 이 R4 연속성 설명이 cross-link 없이 "SoT: Convention §4 / §4.1 / R-CCA-8"만 참조되어 있다. 검토자가 CCH-MP-03 만 읽으면 R4 기각 이력 대비 번복 여부를 Convention 을 별도 확인하기 전까지 파악하기 어렵다.
- **제안**: CCH-MP-03 또는 R-CC-16 (혹은 별도 Rationale 항목)에 "본 native modal 도입은 Convention R4 가 기각한 '전면 native UI 강제' 대안의 재도입이 아니라, R4 본문이 예고한 '지원 provider + 5 fields 이하' 한정 예외 경로를 R-CCA-8 로 실현한 것" 한 문장을 인라인으로 추가해 R4 연속성을 target 문서 안에서도 self-contained 하게 확인 가능하도록 한다.

---

### 4. **[INFO]** R2 — EIA HTTP endpoint 자기호출 "기각" 대안 표현 명확화

- **target 위치**: `spec/5-system/15-chat-channel.md` Rationale R2 마지막 문장
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` Rationale R10 기각 대안 ("NotificationDispatcher 를 엔진 내부에서 직접 호출")
- **상세**: R2 마지막 문장 "어댑터도 EIA HTTP endpoint 를 호출하는 안은 동일 process 안에서 자기 HTTP 표면을 호출하는 의미 없는 round-trip + 토큰 사이클 부담이라 채택하지 않는다"는 기각 사유로 "round-trip + 토큰 사이클"을 든다. 이는 완전히 유효하고 EIA 원칙(EIA-AU-08 trusted in-process caller)과도 정합한다. 다만 EIA R10 기각 대안과의 구조적 차이(어댑터가 엔진 내부 직접 호출 vs. 외부 facade 경유)를 R10 이 명시하는데, R2 에는 해당 참조가 없어 두 기각 이유의 연관성이 단절된다. 기능적으로 충돌은 아니나 연속성 추적 관점에서 보완 여지가 있다.
- **제안**: R2 에 "[EIA §R10 기각 대안 — 어댑터가 엔진 내부 코드를 호출하는 안도 동일 이유로 기각]" cross-link 한 줄 추가 권장.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 전반적으로 기존 spec (EIA R10, Convention R4, 실행 엔진 §4.4 단일 sink 정책, R-CCA-5/7/8 등)의 Rationale 을 충실히 인용·준수한다. 기각된 대안(EIA HTTP self-call, per-node task queue, 새 트리거 유형 신설, 모든 provider native modal 강제 등)을 재도입하지 않으며, 합의 원칙(단일 sink facade, in-process trusted caller, Webhook 트리거 config 옵션 채택, sequential await 발송)을 일관되게 따른다. 주요 주의 사항은 §3.3 과 R8 에서 SSE 어댑터 Redis pub/sub 을 현재 완료 사실로 기술한 점 — EIA R10 이 "현재 in-memory, Planned"로 명시한 것과 사실 불일치이며, 두 어댑터의 구독 메커니즘 비교 논리의 전제 사실이 틀린다. 나머지 발견사항(seq/dedup 귀속 표현, R4/R-CCA-8 cross-link 부재, R2-R10 연결)은 정합 보완 수준이다.

## 위험도

LOW

STATUS: SUCCESS
