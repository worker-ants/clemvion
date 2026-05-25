# Rationale 연속성 검토 결과

검토 일시: 2026-05-25
대상 draft: `plan/in-progress/spec-draft-chat-channel-error-notify.md`
참조 spec Rationale: `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/5-system/3-error-handling.md`

---

## 발견사항

### 발견 1

- **[WARNING]** `execution.failed` 입력 소스를 `error.message` 에서 `error.code` + `details.statusCode` 로 교체 — Convention Rationale 에 이전 결정의 명시적 기각 없이 번복
  - target 위치: Change 2 §2a — `spec/conventions/chat-channel-adapter.md §3` 매핑 표 `execution.failed` 행 교체
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md §3` 매핑 표 현행 (`execution.failed` 행), 본문 상 `| execution.failed | error.message | text 1건 — 에러 안내 (사용자에게 안전한 형태로 redact) |` 명시
  - 상세: 기존 매핑 표는 `error.message` 를 입력으로 "redact" 형태로 사용하는 것을 Convention 으로 정의했다. Draft 는 이를 `error.code + error.details.statusCode` 로 교체하는데, Convention 자체의 `## Rationale` 섹션 (R1~R4) 에는 이 변경의 기각 사유가 없다. 즉 Convention Rationale 에서 "`error.message` 사용 접근"이 명시 기각 대안으로 등재되지 않은 채로 행 자체가 교체된다. Draft 는 신규 Convention Rationale R5 를 추가했으나 R5 는 "Convention 에 helper 를 두는 이유" 를 다루지, "기존 `error.message` 접근을 기각하는 이유"를 Convention Rationale 차원에서 명시하지 않는다. (`error.message` 기각 이유는 Spec Rationale R-CC-15 에만 작성되어 있음.)
  - 제안: Convention `## Rationale` 의 R5 또는 별도 `R-CCAdp-1` 항에 "기존 `error.message` redact 접근을 기각하는 이유" (내부 인프라·PII 노출 위험, 모든 노드 핸들러 audit 비현실) 를 명시 추가. 또는 R-CC-15 의 대안 2 를 Convention Rationale 에도 cross-ref 표기.

---

### 발견 2

- **[INFO]** Convention §1.1 `renderNode` 의 "side-effect free" 계약과 신규 §3.5 CCH-ERR-05 ("안내 메시지 발송도 5초 timeout + 3회 지수 백오프") 의 책임 소재 모호
  - target 위치: Change 1 §1a — `spec/5-system/15-chat-channel.md §3.5 CCH-ERR-05`
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md §1.1` 6함수 책임 표 — `renderNode` 행에 "side-effect free / none / pure" 명시; Rationale R1 에서 "pure 함수는 fixture 기반 단위 테스트, side-effect 함수는 mocked HTTP client" 이분법 강조
  - 상세: CCH-ERR-05 가 "execution.failed 안내 메시지 발송에도 CCH-SE-01 의 5초 timeout + 3회 지수 백오프 정책 적용"을 요구한다. 분류 helper (`classifyExecutionFailure`) 호출은 `renderNode` 안에서 pure 하게 수행 가능하지만, timeout + retry + health 갱신이 포함된 `sendMessage` 호출은 이미 `sendMessage` 함수 책임이다. draft 본문(§2b) 에서도 "어댑터 안에서 `renderNode` 가 직접 호출해 lookup·치환 후 `text` ChannelMessage 합성" 으로 기술하고 있어 `renderNode` 는 pure 함수 계약을 유지하는 것으로 보인다. 다만 CCH-ERR-05 의 "안내 메시지 발송도 ... 정책 적용" 문구가 renderNode 의 책임인지 sendMessage 의 책임인지 명확하지 않아 독자가 혼동할 수 있다.
  - 제안: CCH-ERR-05 에 "(분류 및 template 합성은 renderNode — pure, 재시도·timeout·health 갱신은 sendMessage — side-effect. Convention §1.1 의 역할 분리 그대로 유지)" 한 줄 parenthetical 추가로 혼동 예방.

---

### 발견 3

- **[INFO]** Convention R5 의 기각 대안 2 ("어댑터 인터페이스에 `renderError(event)` 신설 — 기각") 가 Convention §1.1 Rationale R2 와 동일 방향이지만 미cross-ref
  - target 위치: Change 2 §2c — `spec/conventions/chat-channel-adapter.md Rationale R5` 기각 대안 2
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md Rationale R2` (6함수 분리 — ackInteraction 을 별도 함수로; "6함수 인터페이스에 N+1 추가 시 모든 provider 의 contract 변경" 논거)
  - 상세: R5 의 기각 대안 2 는 R2 에서 이미 확립된 "인터페이스 함수 추가 = 모든 provider contract 변경" 논거를 반복하고 있다. cross-ref 없이 유사 논거가 중복 기술되어 있어 향후 R2 논거가 갱신될 때 R5 가 drift 할 수 있다.
  - 제안: R5 기각 대안 2 에 "(R2 의 인터페이스 최소화 원칙 동일 적용)" 또는 "R2 참조" 한 줄 추가.

---

### 발견 4

- **[INFO]** CCH-ERR-02 의 화이트리스트 (`error.code` + `error.details.statusCode`) 가 EiaEvent union 의 `execution.failed` 페이로드 타입 (`error: { code: string; message: string; nodeId: string | null; details?: unknown }`) 과 비교 시 `details.statusCode` 의 존재 보장이 Convention `§1.2` EiaEvent 수준에서 명시되지 않음
  - target 위치: Change 2 §2b — Convention §3.1 분류 표, `HTTP_4XX` / `HTTP_5XX` 행의 `details.statusCode` 조건 칼럼
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md §1.2 EiaEvent` — `execution.failed` 페이로드의 `details` 를 `unknown` 으로 타입 정의
  - 상세: 분류 알고리즘이 `details.statusCode` 를 정수로 가정하고 분기하지만, EiaEvent 타입상 `details` 는 `unknown` 이다. R-CC-15 의 세부 (a) 에서 "HTTP 노드 핸들러는 `error.code` 와 `details.statusCode` 를 일관되게 set 한다고 가정 — 노드 핸들러 계약"으로 언급하나, 이 계약은 Convention `§1.2` 에 반영되지 않아 어댑터 구현자가 타입 안전한 접근법을 찾기 어렵다. 기존 Convention Rationale 에서 "EIA spec 이 SoT, drift 회피" (R3) 를 명시했으므로 Convention 단독 타입 확장 없이 EIA §6.4 를 직접 참조하는 것이 원칙에 부합하나, 현재 EIA §6.4 `details` 도 `unknown` 이라 gap 이 존재한다.
  - 제안: Convention §3.1 의 `statusCode placeholder omit 규칙` 설명에 "details 는 runtime 타입 가드로 접근 (`typeof details?.statusCode === 'number'`)" 명시 추가. 또는 EIA §6.4 draft 에 `details` 에 대한 타입 정교화 계획을 TBD 로 등재.

---

## 요약

전반적으로 target draft 는 기존 spec Rationale 에서 확립된 핵심 설계 원칙 — Convention 인터페이스 6함수 불변 (R1/R2), pure/side-effect 이분법, EIA spec SoT (R3), Convention-Spec-Provider 3분할 (R6/R5) — 을 존중하고 있다. 명시적으로 기각된 대안의 재도입 사례는 발견되지 않는다. 가장 주목할 부분은 Convention 매핑 표의 `execution.failed` 행이 기존 `error.message` 기반 접근에서 `error.code` enum 기반으로 전환되는데, 이 이전 접근의 기각 이유가 Spec Rationale R-CC-15 에는 충실히 기술되어 있으나 Convention 자체의 Rationale 에서는 명시 기각 등재가 누락되어 있어 향후 Convention 독자가 변경 맥락을 놓칠 수 있다 (WARNING). 나머지는 정합 보완 성격의 INFO 수준 관찰이다.

---

## 위험도

LOW
