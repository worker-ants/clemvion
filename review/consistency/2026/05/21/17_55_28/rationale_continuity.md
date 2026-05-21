# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-chat-channel.md`
검토 모드: `--spec`
검토 일시: 2026-05-21

---

## 발견사항

### 1. **[CRITICAL]** EIA 인증 필수 요구사항(EIA-AU-02/06) 을 어댑터가 우회 — EIA spec 에 예외 조항 부재

- **target 위치**: §3.5 Identity/보안 ("어댑터가 인터랙션 명령을 보낼 때 EIA 의 외부 토큰 `iext_*` / `itk_*` 발급을 우회하고 in-process `InteractionService.dispatchCommand` 를 직접 호출"), §3.6 EIA 와의 관계 표 ("어댑터는 외부 토큰 family 발급/검증을 우회"), draft R-B.
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §3.3 인증` — EIA-AU-02 "Interaction token 은 두 전략 중 하나 ... `iext_*` (default 1h) ... `itk_*`" (우선순위: **필수**), EIA-AU-06 "토큰 무효/만료 시 401 + 응답 헤더 `X-Refresh-Token-Url`" (필수); EIA spec §R4 Rationale 의 `per_trigger` 적합 시나리오 예시 — "다수 execution 을 동시에 다루는 봇 (Telegram bot 등) — execution 별 토큰 교환 비용 회피" (per_trigger 를 명시적으로 Telegram 봇 케이스에 권장).
- **상세**: EIA 는 모든 inbound 인터랙션 명령에 대해 `iext_*`/`itk_*` 토큰 인증을 필수(필수 등급) 로 정의한다. EIA §R4 는 Telegram 봇처럼 다수 execution 을 다루는 경우를 `per_trigger` 토큰 사용의 가장 명시적인 예시로 들었다. 그럼에도 draft 는 이 토큰 사이클 전체를 "trusted in-process caller" 논리로 우회한다. 더 중요한 것은, EIA spec 본문(§3.3, §6 EIA-IN-06) 이 이 우회를 허용하는 예외 조항을 전혀 담고 있지 않다는 점이다. draft 의 R-B 는 새 Rationale 를 서술했으나, 이 Rationale 는 아직 EIA spec 에 반영되지 않았다 — 두 spec 이 동시에 기록을 갱신해야 일관된 단일 진실이 유지된다.
- **제안**: (a) 이 우회가 의도된 설계 결정이라면, `14-external-interaction-api.md §3.3` 에 예외 조항을 추가해야 한다 ("Chat Channel 어댑터 등 in-process trusted caller 는 토큰 발급 우회 가능 — §R10-확장 참조"). (b) 동시에 EIA §R4 의 "Telegram 봇 = per_trigger" 예시를 "서버사이드 어댑터가 있는 경우에는 해당 없음" 으로 갱신. 두 spec 모두 본 draft 와 동시에 적용되어야 한다.

---

### 2. **[CRITICAL]** EIA R10 단일 sink 정책의 경계 조건 — Chat Channel adapter 의 in-process subscription 방식이 명시되지 않음

- **target 위치**: CCH-AD-05 ("EIA outbound notification 의 이벤트를 어댑터가 in-process subscribe → renderNode → sendMessage 호출"), §3.6 EIA 와의 관계 표 ("HTTP POST + HMAC 검증 단계 우회 — network round-trip 없음"), draft R-B.
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R10` — "실행 엔진은 여전히 `WebsocketService.emitToExecution` 한 곳만 호출 (= 단일 sink). NotificationDispatcher 는 별도 outbox/after-commit hook 으로 트리거. 기각된 대안: NotificationDispatcher 를 엔진 내부에 직접 호출". EIA §7 §9.3 의 처리 흐름: NotificationDispatcher 가 외부 HTTP POST + HMAC 서명으로 이벤트를 push 하는 단일 경로.
- **상세**: EIA §R10 은 "실행 엔진 ↔ WebsocketService (단일 sink) + NotificationDispatcher 는 after-commit facade" 구조를 합의된 invariant 로 확립했다. Chat Channel adapter 가 NotificationDispatcher 의 이벤트를 "in-process subscribe" 한다는 것은 새로운 subscriber 경로를 추가함을 의미한다. 이 경로가 (a) NotificationDispatcher 의 내부 이벤트 버스에서 파생되는 것인지, (b) WebsocketService 의 Redis pub/sub 에서 추가 구독하는 것인지, (c) 별도 after-commit hook 을 신설하는 것인지가 draft 에 명시되지 않았다. EIA §R10 은 "새 외부 sink 추가 시 엔진 코드 수정 없이 facade 만 추가 가능" 을 보장으로 제시했는데, 이 구조가 실제로 유지되는지 검증이 필요하다. 또한 EIA §9.3 에서 정의한 "at-commit hook" 타이밍 보장이 Chat Channel adapter 에도 적용되는지 draft 에 언급이 없다.
- **제안**: (a) `15-chat-channel.md §3.3 처리 흐름 다이어그램` 의 "(백그라운드 — TX commit 후)" 주석을 구체화 — "NotificationDispatcher 가 emit 하는 after-commit event bus (또는 Redis pub/sub) 의 추가 subscriber 로 등록" 또는 "별도 after-commit hook" 중 어느 경로인지 명시. (b) EIA §R10 의 기각된 대안이 "NotificationDispatcher 를 엔진 내부에 직접 호출" 이었으므로, Chat Channel adapter 의 구독 경로가 이 기각 경로와 같지 않음을 §R10 에 보충 ("Chat Channel 어댑터는 NotificationDispatcher 와 동일 계층의 facade — 엔진을 우회하지 않음").

---

### 3. **[WARNING]** EIA §2 시나리오 표 기존 행 흡수 — 기존 "사용자가 직접 변환층 구현" use case 기각 여부 불명확

- **target 위치**: §7 "14-EIA.md 개정 핵심" — "(기존) 외부 챗봇 위에 워크플로우 얹기 — 사용자가 직접 변환층 구현" 행을 신규 Chat Channel 행으로 "흡수".
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §2 사용 시나리오` 현행 표 — "외부 챗봇(Telegram/Slack/카카오) 위에 워크플로우 얹기 | Notification + Inbound | 봇 메시지 → webhook 으로 워크플로우 시작 → AI Multi Turn 진입 시 notification 으로 어시스턴트 응답 받기 → 사용자 메시지마다 REST submit_message" (독립적으로 정의된 use case, 기각 이력 없음).
- **상세**: 기존 행은 "사용자가 직접 변환층을 만드는 use case" 이며, 이는 EIA 의 원래 설계 의도 중 하나였다 (R1 의 "Notification + Inbound 두 채널 조합"). 이 행을 서버사이드 어댑터 행으로 "흡수" 하면, EIA spec 의 원래 시나리오 중 하나가 제거된다. 그러나 EIA 의 두 채널(Notification + Inbound) 은 여전히 사용자가 직접 사용할 수 있는 general-purpose API 다 — Chat Channel 어댑터는 그 위에 편의 레이어를 추가하는 것이지 기존 use case 를 폐기하는 것이 아니다. 흡수(행 삭제)보다는 두 행을 병존시키는 편이 EIA 의 범용성을 유지하고 혼란을 줄인다.
- **제안**: 기존 "사용자가 직접 변환층 구현" 행을 유지하고 신규 "Chat Channel via Webhook (서버사이드 어댑터)" 행을 추가하는 방식으로 변경. draft §7 의 "(기존) 행을 흡수" 지침을 "(기존) 행은 유지 + 신규 행 추가" 로 교체. 이렇게 하면 EIA 의 Notification + Inbound 직접 사용 시나리오가 유효한 경로로 남는다.

---

### 4. **[WARNING]** CCH-AD-04 의 `parseUpdate` 호출이 WH-RS-01 (202 즉시 반환) 과 잠재 충돌 — 비동기 보장 명시 부재

- **target 위치**: CCH-AD-04 ("Webhook 진입점이 raw body 를 `parseUpdate(raw)` 로 통과시켜 워크플로우 input 으로 변환"), §3.3 처리 흐름 다이어그램 (HooksController.handle → TelegramAdapter.parseUpdate → ExecutionEngine.execute 로 직렬 연결), §4.3 5함수 규약 ("parseUpdate: side-effect free (DB 미접근, 외부 API 미호출)").
- **과거 결정 출처**: `spec/5-system/12-webhook.md §3.3 응답 — WH-RS-01` "요청 수신 즉시 202 Accepted + executionId 반환 (비동기 실행)" (필수), WH-NF-01 "webhook 수신 후 200ms 이내 응답 반환 (실행은 비동기)".
- **상세**: `parseUpdate` 가 side-effect free 이고 순수 변환이라는 점은 §4.3 에 명시되어 있다. 그러나 처리 흐름 다이어그램이 HooksController 내부에서 parseUpdate 를 동기적으로 수행한 뒤 ExecutionEngine.execute 를 호출하는 구조를 보여주는데, 이것이 WH-RS-01 의 "즉시 202 반환" 계약과 어떻게 호환되는지 명시되지 않았다. parseUpdate 자체가 순수함수라서 빠르더라도, 이 설계가 WH-NF-01 의 200ms 기준 안에 들어온다는 명시적 보장이 없다. CCH-NF-01 이 "parseUpdate ↔ 워크플로우 input 평균 50ms" 를 별도로 정의했지만, 이것이 202 응답 전에 발생하는지 후에 발생하는지 불명확하다.
- **제안**: §3.3 처리 흐름 다이어그램에 "202 반환 시점" 을 명시. WH-RS-01 과 동일하게 parseUpdate 완료 → ExecutionEngine.execute 호출 → 202 즉시 반환 (execute 는 비동기) 순서를 다이어그램에 표기. CCH-NF-01 의 "평균 50ms" 는 202 반환 전의 parseUpdate 단계로 한정한다고 명시.

---

### 5. **[WARNING]** CCH-SE-04 bot token rotation API 신설이 EIA-NX-12 secret rotation 패턴과 별개 경로로 정의

- **target 위치**: CCH-SE-04 ("Bot token rotation API `POST /api/triggers/:id/chat-channel/rotate-token` — old token 은 24h grace 동안 병행 받음") (우선순위: 권장).
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §3.1 EIA-NX-12` "secret rotation API (`POST /api/triggers/:id/notification/rotate-secret`) 지원 — old secret 은 grace 24h 병행 검증" (권장). EIA §7.1 Trigger config 에 동일 보안 정책 규정.
- **상세**: EIA 는 notification secret rotation 을 `/api/triggers/:id/notification/rotate-secret` 경로로 정의했다. Chat Channel 은 동일한 24h grace 패턴을 `/api/triggers/:id/chat-channel/rotate-token` 이라는 별개 경로로 신설한다. 두 rotation API 의 경로 패턴이 다르다: EIA 는 `/<resource>/rotate-secret`, CCH 는 `/chat-channel/rotate-token`. "rotate-secret" vs "rotate-token" 의 명칭 차이도 있다. 이 차이가 의도적인지 (bot token 은 비밀이 아니라 식별자+비밀 역할을 겸하므로 별도 명칭) 혹은 그냥 불일치인지 Rationale 에 설명이 없다.
- **제안**: CCH-SE-04 의 Rationale 에 "EIA-NX-12 와 다른 경로/명칭을 택한 이유" 를 한 줄 추가. 만약 동일 패턴이 의도라면 경로를 `POST /api/triggers/:id/chat-channel/rotate-secret` 으로 통일하는 것도 검토.

---

### 6. **[INFO]** EIA §R5 (외부 WebSocket 보류) 의 재논의 트리거 조건과 CCH 의 in-process 구독 구조 관계 — 문서화 보완

- **target 위치**: §3.6 EIA 관계 표, draft R-B (in-process subscriber 정당화).
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §R5` — "미래 재논의 트리거: inbound REST 의 round-trip latency 가 사용자 경험 저해 수준 (>300ms 평균) 으로 측정됨" / "외부 WS 를 명시적으로 요구하는 대형 통합 파트너가 생김". 또한 "재도입 시 권장 형태: 기존 /ws 게이트웨이를 그대로 재사용 ... 별도 URL 신설 금지".
- **상세**: Chat Channel adapter 가 in-process subscriber 로 동작하면서 CCH-NF-02 의 200ms latency 를 확보하는 구조는, EIA §R5 가 "SSE+REST 로 충분" 이라고 판단한 근거(실측 latency 100ms 대) 를 기술적으로 대체하는 다른 경로다. 이 구조가 §R5 의 재논의 트리거 조건을 회피하거나 만족하는지, 혹은 §R5 와 무관한 별개 계층인지 정리가 되어 있지 않다. 사용자 혼동 방지를 위해 15-chat-channel.md 의 Rationale 에 "EIA §R5 의 WebSocket 재논의와 Chat Channel in-process subscription 구조는 별개 결정 — Chat Channel adapter 는 외부 HTTP 표면을 추가하지 않으므로 §R5 조건과 무관" 한 줄을 추가하면 충분하다.
- **제안**: `15-chat-channel.md §R10-확장` 또는 별도 `R-H` 항에 위 관계를 한 줄로 명시.

---

### 7. **[INFO]** EIA §2 기존 시나리오 표의 "외부 챗봇" 시나리오와 신규 행의 "사용 채널" 컬럼 표기 불일치

- **target 위치**: §7 신규 행 — "사용 채널: (어댑터가 내부적으로 둘 다 사용)".
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md §2` 사용 시나리오 표의 "사용 채널" 컬럼 — "Notification only", "Notification + Inbound", "Inbound only (SSE + REST)", "둘 다 미사용" 의 4가지 값으로 표기.
- **상세**: 신규 행의 "사용 채널" 컬럼 값 "(어댑터가 내부적으로 둘 다 사용)" 은 기존 4가지 값 패턴과 일치하지 않는다. 이 표는 "외부 클라이언트 관점에서 어떤 채널을 사용하는지" 를 정리하는 표인데, 새 행은 어댑터의 내부 구현 상세를 노출한다. "Notification + Inbound (어댑터가 자동화)" 또는 단순 "Notification + Inbound" 로 통일하는 편이 표의 기존 컨벤션과 일관성을 유지한다.
- **제안**: §7 의 신규 행 "사용 채널" 컬럼을 "Notification + Inbound (어댑터가 자동화)" 로 교체.

---

## 요약

target 문서는 전반적으로 합의된 설계 원칙(Webhook 트리거 확장, EIA consumer 위치, facade 패턴, 새 트리거 유형 신설 금지)을 충실히 따른다. 그러나 두 가지 Critical 항목이 발견된다. 첫째, EIA-AU-02/06 의 필수 토큰 인증 요구사항을 Chat Channel adapter 가 우회하면서도, 해당 예외가 EIA spec 본문에 아직 반영되지 않아 두 spec 사이에 직접적인 요구사항 충돌이 존재한다. EIA §R4 는 오히려 Telegram 봇 케이스를 `per_trigger` 토큰의 적합 사례로 명시해 혼란을 가중시킨다. 둘째, EIA §R10 의 "단일 sink + facade 계층" invariant 를 Chat Channel adapter 가 준수한다고 주장하지만, 어댑터가 정확히 어느 계층의 이벤트를 구독하는지 명시되지 않아 기각된 대안("NotificationDispatcher 를 엔진 내부에 직접 호출") 과의 구조적 차이가 검증되지 않는다. 두 Critical 항목 모두 EIA spec 갱신(예외 조항 추가)과 15-chat-channel.md 처리 흐름 구체화를 통해 해소 가능하며, 해소 전까지는 spec 반영을 보류하는 것이 권장된다.

---

## 위험도

**HIGH**
