STATUS: WARN

## Critical

없음.

---

## Warning

### [WARNING] EIA §11이 참조하는 WS spec 섹션 번호 오류 — §4.7 vs 실제 §4.6

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §11 (WebSocket 명령 ↔ 외부 명령 매핑), 660번째 줄
  - 원문: `[Spec WebSocket 프로토콜 §4.7](./6-websocket-protocol.md) (신설) 에 1:1 매핑 표가 있다.`
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` — 실제 신설 섹션은 `### 4.6 외부 표면 매핑 (External Interaction API)` (라인 569)
- **상세**: EIA §11 은 6-websocket-protocol.md 에 §4.7 이 신설되었다고 기술하지만, 실제 파일에는 §4.3 / §4.4(복수) / §4.5 / §4.6 까지만 존재하며 §4.7 섹션이 없다. §4.6이 바로 해당 매핑 섹션이다. WS spec §4.6 도 `[Spec EIA §R5]` / `[Spec EIA §R7]` 링크를 포함하고 있어 두 파일이 서로를 가리키는데, EIA 쪽 번호가 틀렸다.
- **제안**: EIA §11 첫 문장을 `[Spec WebSocket 프로토콜 §4.6](./6-websocket-protocol.md) (신설)` 으로 수정. WS spec §4.6 의 역참조 링크는 정확하므로 변경 불필요.

---

### [WARNING] ExecutionEngine §4.4 "단일 sink 재검토" 트리거 발동 미인용 — NotificationDispatcher 도입

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §9 처리 흐름 (§9.3 포함) 및 §R6 Rationale
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §4.4 "이벤트 발행 sink — `WebsocketService` 단일 sink 정책" Rationale 마지막 문장: "향후 외부 sink (Webhook 콜백, 텔레메트리 export 등) 가 실제로 추가될 때 본 결정을 재검토한다."
- **상세**: 실행 엔진 §4.4 는 "외부 이벤트 소비자는 WebSocket 클라이언트 1종" 이라는 전제 하에 단일 sink 정책을 선택했으며, 외부 sink 추가 시 재검토를 명시했다. EIA 의 `NotificationDispatcher` 는 정확히 그 "외부 sink (Webhook 콜백)" 에 해당하지만, EIA Rationale (R1~R9) 어느 곳에서도 이 재검토 의무를 인용하거나, 단일 sink 정책을 어떻게 해소하는지 설명하지 않는다. EIA §9.3 에서 `NotificationDispatcher` 가 `after-commit hook` 으로 `WebsocketService.emitToExecution` 과 병행 동작하는 구조를 서술하고 있는데, 이 구조가 기존 단일 sink 원칙의 "의도된 확장" 인지 단순 누락인지 모호하다.
- **제안**: EIA Rationale 에 "R10. WebsocketService 단일 sink 정책의 확장 (2026-05-21)" 절을 추가하고, 실행 엔진 §4.4 의 재검토 조항을 인용한 뒤 NotificationDispatcher 가 왜 facade 레이어에 위치해 기존 sink 정책과 충돌하지 않는지(= 엔진 내부 emit 이후 after-commit 처리이므로 엔진 레벨 단일 sink 는 유지됨) 명시. 또는 실행 엔진 §4.4 하위에 "NotificationDispatcher 및 SSE 어댑터 추가로 재검토 완료 — [Spec EIA §...]" 를 달아 cross-link 완결.

---

### [WARNING] WS §2.2 seq 범위 "채널 내" vs EIA "execution 내" — 암묵적 가정 불일치

- **target 위치**: `spec/5-system/14-external-interaction-api.md` EIA-NX-08, EIA-IN-07, §5.2 본문, §R7
- **과거 결정 출처**: `spec/5-system/6-websocket-protocol.md` §2.2 표: `seq` — "채널 내 순서 번호 (재연결 시 놓친 이벤트 감지용)"
- **상세**: WS §2.2 는 seq 를 "채널 내 (per-channel)" 순서 번호로 정의한다. 내부 WS 채널은 `execution:{executionId}` 채널 단위이므로 실질적으로 "execution 내 monotonic counter" 와 같지만, 표현이 다르다. EIA 는 "execution 내 monotonic counter, WebSocket §2.2 와 동일 값" 이라고 기술한다. 만약 미래에 단일 execution 을 두 채널(예: execution:{id} + workflow:{wfId})에서 동시 구독하는 시나리오가 생기면 "채널 내 seq" 와 "execution 내 seq" 가 분기된다. R7 Rationale 이 "동일 카운터 공유" 를 명시하고 있지만, WS §2.2 의 정의 자체를 "execution-scoped" 로 명확화하지 않으면 향후 유지보수자가 두 정의를 다르게 해석할 수 있다.
- **제안**: WS §2.2 의 `seq` 설명을 "execution 채널(`execution:{executionId}`) 내 순서 번호, 외부 SSE/Notification 과 동일 값 공유 — [Spec EIA §R7]" 으로 보강. 또는 EIA R7 에서 WS §2.2 정의를 "채널 내 = execution 내 (execution 채널 한정)" 임을 명시.

---

## Info

### [INFO] WH-MG-04 (활성/비활성 토글) vs EIA R6 (자동 비활성화 금지) — 범위 명확화 권장

- **target 위치**: `spec/5-system/12-webhook.md` §3.4 관리 WH-MG-04
- **과거 결정 출처**: `spec/5-system/12-webhook.md` WH-MG-04: "활성/비활성 토글로 webhook 수신 제어" (필수)
- **상세**: WH-MG-04 는 사용자가 trigger 전체를 명시적으로 비활성화할 수 있다고 정의한다. EIA R6 는 notification 실패 시 "자동 비활성화 금지 — 사용자 승인 필요" 라고 결정한다. 두 규칙은 충돌하지 않는다 — WH-MG-04 는 사용자 수동 토글, R6 는 시스템 자동 비활성화 금지. 그러나 WH-MG-07 의 "degraded 상태에서도 트리거 자동 비활성화하지 않음" 주석 없이 WH-MG-04 만 보면 "notification 실패 시 시스템이 비활성화해도 되나?" 라는 오해를 줄 수 있다. WH-MG-04 에 "(시스템 자동 비활성화와 무관 — 사용자 명시 조작만)" 같은 단서가 있으면 더 명확하다.
- **제안**: WH-MG-04 설명에 "(사용자 명시 토글 한정 — 시스템 자동 비활성화는 WH-MG-07 / EIA §R6 참조)" 를 한 줄 추가.

---

### [INFO] EIA R8 (Idempotency 캐시 제외) — "기각된 대안" 미기술

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R8
- **과거 결정 출처**: 해당 없음 (신규 결정). 검토 관점 4(a)(b)(c)(d) 기준.
- **상세**: R8 은 `400 VALIDATION_FAILED` 를 idempotency cache 에서 제외한다고 기술하고, 그 외 (성공 / 409 / 410) 는 캐시한다고 명시한다. 그러나 "기각된 대안 — 400 도 캐시하는 방안" 이 왜 기각되었는지는 Rationale 에 직접 서술되어 있으나 "기각된 대안" 표기 형식이 아니라 근거 문장 안에 녹아있다. Rationale 품질 기준 (a)~(d) 에서 (b) 기각안 명시가 다소 암묵적이다.
- **제안**: R8 에 "기각된 대안: 400 VALIDATION_FAILED 도 idempotency cache 에 적재" 를 명시적으로 먼저 기술하고, 기각 사유 (stale 에러 반환 → 실행 엔진 §1.3 위반) 를 이어 작성하면 Rationale 완결성이 높아진다.

---

### [INFO] R5 보류 — 미래 재논의 트리거 충분성

- **target 위치**: `spec/5-system/14-external-interaction-api.md` §R5
- **과거 결정 출처**: 해당 없음 (신규 보류 결정)
- **상세**: R5 의 "미래 재논의 트리거" 4개 항목은 구체적 임계값(SSE 동시 연결 병목, latency 300ms, 분당 60+)을 포함하여 양호하다. 다만 "대형 통합 파트너" 기준은 정량화가 어려워 주관적 판단에 의존하게 된다. 큰 문제는 아니지만 "외부 WS 를 명시적으로 요구하는 엔터프라이즈 파트너가 N개 이상 발생" 같이 최소 임계 숫자를 남기면 재논의 판단 기준이 더 일관된다.
- **제안**: 네 번째 트리거를 "외부 WS 를 명시적으로 요구하는 통합 파트너가 1개 이상 계약 단계에 도달" 정도로 보강 (선택적).

---

## 요약

전체적으로 EIA spec (R1~R9) 은 기존 spec 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 사례가 없다. 외부 WebSocket 신설 기각(R5), SSE 채택(R3), 자동 비활성화 금지(R6) 모두 새로운 결정으로 정합하며 기존 결정과 충돌하지 않는다. 그러나 두 가지 WARNING 이 존재한다. 첫째, EIA §11 이 WS spec 의 매핑 섹션을 "§4.7" 로 잘못 참조하고 있으나 실제 섹션은 §4.6 이다 — 구현 착수 시 혼란을 줄 수 있는 cross-link 오류. 둘째, 실행 엔진 §4.4 의 "단일 sink 정책 재검토" 조항이 NotificationDispatcher 도입과 맞물려 있음에도 EIA Rationale 에서 인용되지 않았다 — 결정이 번복된 것은 아니지만 의도된 재검토가 완결되지 않아 미래 유지보수 혼란을 줄 수 있다. seq 범위 표현 차이(WS "채널 내" vs EIA "execution 내")는 현재 동치이지만 정의 불일치로 잠재적 혼선이 있다.

## 위험도

MEDIUM
