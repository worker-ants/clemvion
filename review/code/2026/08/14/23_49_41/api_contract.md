STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** `execution.failed` 의 `error` 필드를 string → object 로 바꾸는 wire breaking change 가 버전 협상 수단 없이 배포된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:664`, `:3314`, `:4872`; `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:966`; 문서화는 `CHANGELOG.md:9-11`, `spec/5-system/14-external-interaction-api.md:572,792`
  - 상세: `execution.failed` 는 `spec/5-system/14-external-interaction-api.md` §3.1 이 정의하는 **Outbound Notification Webhook** 화이트리스트 이벤트다 — 실행 도중이 아니라 사후에 제3자 서버가 등록한 URL 로 HMAC 서명 push 되는 진짜 외부 계약이며 (내부 SSE/WS 구독자와 별개로 `notification-dispatcher.service.ts` 가 emit payload 를 가공 없이 그대로 전달함을 확인), 이 저장소는 `spec/5-system/2-api-convention.md` §1 에 따라 **URL 버전 세그먼트를 쓰지 않는 단일 버전 운영**이다. 이번 변경으로 `error` 가 4개 emit 지점 전부에서 string 에서 `{code, message, nodeId, details?}` object 로 바뀌었고, CHANGELOG 도 이를 "breaking" 으로 명시한다. 완화 요인은 있다 — 바뀐 object 형태는 이 PR 이전부터 spec 필드 집합 표가 이미 "목표" 로 선언해 온 형태였고(즉 spec-conformant 하게 만든 클라이언트라면 원래도 object 를 기대했어야 함), spec 상태가 `partial` 이라 GA 계약으로 보기는 이르다. 그러나 실제 배포된 동작(string)에 맞춰 통합한 기존 외부 구독자가 있다면 이번 변경으로 그 파서가 조용히 깨진다 — 유일한 통지 수단이 CHANGELOG 뿐이고, dual-shape 과도기·`Accept` 헤더 협상·per-trigger opt-in 같은 마이그레이션 경로는 제공되지 않는다(코드 상 무조건 object 로 전환).
  - 제안: 이미 존재할 수 있는 외부 webhook 구독자가 있다면 (a) 일정 기간 두 형태를 함께 실어 소비자가 이행할 시간을 주거나, (b) notification payload 버전 필드/헤더로 신호를 주거나, (c) 이 API 가 아직 GA 아님(현재 `spec: partial`)을 근거로 실제 활성 외부 구독자가 없음을 확인해 리스크를 명시적으로 종결하는 것을 권장. 이미 CHANGELOG·spec Rationale 에 근거가 잘 기록돼 있으므로 최소한 "실제 활성 외부 구독자 유무 확인" 한 줄이 plan 산출물에 남으면 충분하다.

- **[INFO]** (positive) DB 저장값과 4개 emit 지점의 `error` 표현이 `toTerminalErrorPayload` 로 일원화돼 기존 drift(예: `finalizeStalledExhausted` 가 emit 시 `attempts` 를 빠뜨려 DB와 wire 가 이미 어긋나 있던 문제)가 해소됐다. `code`/`nodeId` 의 부재 표현(`null`)도 `spec/5-system/2-api-convention.md` §5.4 의 기존 규약(명시적 `null` vs 키 생략)을 그대로 따르고, 같은 changeset 안에서 spec 필드 집합 표(`14-external-interaction-api.md:572,792`)·convention 문서(`spec/conventions/chat-channel-adapter.md:161`)가 함께 갱신돼 spec-impl drift 를 남기지 않는다.
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts`
  - 상세/제안: 조치 불요, 참고용 기록.

### 요약
이번 changeset 의 핵심은 `execution.failed` 웹훅/SSE/내부 WS 이벤트의 `error` 필드를 EIA §6.4 가 이미 목표로 선언해 둔 object 형태로 4개 emit 지점 전부에서 통일한 것이다. `null` vs 키 생략 표현, `EiaFailedEvent` 타입, spec 필드 집합 표, 관련 convention 문서가 한 changeset 안에서 동기화됐고, 하류 소비자(chat-channel dispatcher 의 레거시 문자열 흡수 경로, 에디터 프런트엔드 `use-execution-events.ts`)도 함께 갱신돼 렌더 크래시 등 즉각적 회귀는 방어돼 있다. 유일한 실질 API 계약 리스크는, 이 이벤트가 제3자에게 HMAC 서명 push 되는 진짜 외부 webhook 계약인데도 이 저장소가 URL 버전을 쓰지 않는 단일 버전 운영이라 CHANGELOG 문서화 외에는 하위 호환 마이그레이션 경로가 없다는 점이다 — 다만 새 형태가 spec 이 원래 약속했던 목표 형태와 일치하고 spec 상태가 `partial` 이라는 점이 리스크를 완화한다.

### 위험도
LOW
