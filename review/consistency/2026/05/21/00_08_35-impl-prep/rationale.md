# Rationale 연속성 검토 결과 — PR2 구현 phase 분할안 vs EIA §R1~R12

## 발견사항

### 발견사항 1
- **[INFO]** R1 — 단일 채널 활성화 시나리오의 명시적 테스트 커버리지
  - target 위치: plan §5 E2E 시나리오 목록 (시나리오 A~G)
  - 과거 결정 출처: spec §R1 "둘 다 optional 로 제공 — 하나만 활성화된 trigger 시나리오"
  - 상세: R1 의 채택 결정은 notification 만 활성화·interaction 만 활성화·둘 다 미사용의 세 경우를 독립 optional 로 제공하는 것이다. plan 의 P2~P6 phase 설명에서 enable/disable 분기 로직이 "interaction.enabled=true 조건 분기" (§2.6) 와 "notification.events 포함 시 enqueue" (§2.4) 로 각각 기술되어 있어 코드 레벨은 의도에 부합하나, E2E 시나리오에서 "notification only" 와 "inbound only" 각각을 독립적으로 검증하는 케이스가 명시되지 않았다. 시나리오 A는 notification + inbound 조합, 시나리오 B도 둘 다 수신 패턴이다.
  - 제안: 시나리오 A 또는 별도 시나리오에서 `interaction.enabled=false` 인 trigger 에서 interaction 토큰이 응답에 포함되지 않는지, `notification.url` 미설정 시 notification dispatch 가 스킵되는지를 명시적으로 검증하는 assertion 추가.

### 발견사항 2
- **[INFO]** R2 — P3 dispatcher의 HTTP 응답 body 처리 명시 부재
  - target 위치: plan §2.4 `notification-dispatcher.service.ts` 체크리스트
  - 과거 결정 출처: spec §R2 "notification 은 순수 통보로 한정 — 응답 body 무시"
  - 상세: R2 는 HTTP 응답 body 를 parse해서 인터랙션을 forward하는 패턴을 명시적으로 기각했다. plan §2.4 의 NotificationDispatcher 구현 체크리스트에는 2xx=성공, 나머지=재시도 규칙만 기술되어 있고 "2xx 응답의 body 는 무시한다"는 명시가 없다. 개발자가 응답 body 를 parse하여 어떤 후처리를 추가하는 구현 실수를 방지하는 guard 가 없다.
  - 제안: §2.4 체크리스트에 "2xx 응답 body 는 읽지 않고 폐기 — 인터랙션 forward 금지 (EIA §R2)" 항목 1줄 추가.

### 발견사항 3
- **[INFO]** R3·R5 — P5 에 외부 WS 신설 phase 부재 확인 (정합)
  - target 위치: plan §PR2 Phase 분할안 P1~P9 전체
  - 과거 결정 출처: spec §R3, §R5 "v1 에서 외부 WebSocket 채널은 신설하지 않는다"
  - 상세: P5 는 SSE stream controller + sse-adapter.service 로만 구성되어 있으며 외부 WebSocket 신설 phase 가 없다. §R5 의 보류 결정이 그대로 준수된다. 정합.
  - 제안: 없음.

### 발견사항 4
- **[INFO]** R4 — P2·P6 에서 `per_execution` default 명시 확인 (정합)
  - target 위치: plan §2.2 InteractionTokenService + §2.6 Hooks 응답 확장
  - 과거 결정 출처: spec §R4 "`per_execution` 이 default"
  - 상세: §2.2 의 `issuePerExecution` 메서드가 P2 에서 신설되고, §2.6 Hooks 응답 확장에서 "`interaction.enabled=true` + `tokenStrategy='per_execution'` 일 때" 토큰을 동봉한다고 기술되어 있다. `tokenStrategy` 미지정 시 default 처리가 DTO 레벨의 class-validator 데코레이터(`@IsOptional`, `@IsEnum` with default) 나 서비스 레벨 fallback 으로 구현될 것을 전제하는데, plan 에 "미지정 시 `per_execution` default" 체크박스가 없다.
  - 제안: §2.1 Trigger DTO 체크리스트에 "interaction.tokenStrategy 미지정 시 `per_execution` default (EIA §R4)" 항목 추가.

### 발견사항 5
- **[INFO]** R6 — P3 의 자동 비활성화 금지 명시 확인 (정합)
  - target 위치: plan §2.4 NotificationDispatcher 체크리스트
  - 과거 결정 출처: spec §R6 "trigger.is_active 미수정, notificationHealth='degraded' 만"
  - 상세: plan §2.4 에 "5회 실패 시 `Trigger.notificationHealth='degraded'` + `notification_last_error` 갱신 (자동 비활성화 금지)" 으로 명시되어 있다. R6 와 정합.
  - 제안: 없음.

### 발견사항 6
- **[INFO]** R7 — P5 SSE adapter 의 별도 counter 신설 여부 (정합)
  - target 위치: plan §2.5 sse-adapter.service.ts 체크리스트
  - 과거 결정 출처: spec §R7 "SSE 와 notification 은 동일 seq 공유 — WebSocket §2.2 의 counter 재사용"
  - 상세: plan §2.5 마지막 줄 "`seq` 값은 WS §2.2 의 monotonic counter 그대로 사용 (EIA §R7)" 으로 명시. 별도 counter 신설이 없음이 확인된다. 정합.
  - 제안: 없음.

### 발견사항 7
- **[WARNING]** R8 — Idempotency middleware 의 400 캐시 제외 범위 모호성
  - target 위치: plan §2.3 Idempotency middleware 체크리스트
  - 과거 결정 출처: spec §R8 "4xx 중 `400 VALIDATION_FAILED` 만 idempotency cache 에서 제외, 그 외 (`409 Conflict` / `410 Gone`) 는 캐시"
  - 상세: plan §2.3 에 "Idempotency middleware — `Idempotency-Key` 헤더 24h 캐시 (Redis), `400 VALIDATION_FAILED` 만 캐시 제외 (EIA §R8)" 라고 기술되어 있다. R8 의 의도와 정합하는 기술로 보이나, spec §5.1 의 에러 코드 표에는 `400 INVALID_COMMAND` 도 있다 (`INVALID_COMMAND` = 지원하지 않는 command, 필수 필드 누락). R8 의 결정 근거는 "validation 실패 → waiting_for_input 유지 → 재제출 가능" 이므로, `400 INVALID_COMMAND` 는 re-submit 시 body 를 바꾸는 것이 정상 flow 인지 아닌지를 분명히 해야 한다. `INVALID_COMMAND` 는 body 자체를 고쳐 재제출할 수 있으므로 역시 캐시에서 제외해야 할 수 있다.
  - 제안: plan §2.3 에 "400 응답 캐시 제외 범위 = `VALIDATION_FAILED` + `INVALID_COMMAND` (body 수정 후 재제출 가능한 모든 400)" 으로 명시하거나, spec §R8 에 `INVALID_COMMAND` 처리를 명확화하도록 annotate. 최소한 구현 시 middleware 에서 `status === 400` 전체를 제외할지 아니면 error code 를 파싱해서 선별 제외할지를 결정 항목으로 추가.

### 발견사항 8
- **[INFO]** R9 — developer 의 spec 직접 수정 여부 (정합)
  - target 위치: plan §2 Backend 구현 전체, 체크리스트
  - 과거 결정 출처: spec §R9 "spec 위치 결정", CLAUDE.md "developer 는 spec/ read-only"
  - 상세: plan §2~§5 의 모든 체크리스트는 `codebase/` 하위 파일만 수정 대상으로 열거한다. PR2 단계에서 `spec/` 수정 항목이 없다. 정합.
  - 제안: 없음.

### 발견사항 9
- **[INFO]** R10 — P6 의 단일 sink 정책 준수 확인 (정합)
  - target 위치: plan §2.4 NotificationDispatcher 트리거 방식 + §2.5 SSE 어댑터 구조
  - 과거 결정 출처: spec §R10 "엔진 레벨 단일 sink 유지 — NotificationDispatcher 와 SSE 어댑터는 facade 레이어"
  - 상세: plan §2.4 에 "after-commit hook 또는 outbox pattern 으로 트리거 (트랜잭션 commit 후 발송)", §2.5 에 "Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독해 SSE stream 으로 변환"으로 기술되어 있다. 엔진 내부 코드를 직접 수정하지 않고 hook/pub-sub 으로만 트리거하는 구조이다. R10 정합.
  - 제안: 없음.

### 발견사항 10
- **[WARNING]** R10 — P6 "Websocket emit 직후 SSE fan-out" 문구의 단일 sink 위반 가능성
  - target 위치: plan §PR2 Phase 분할안 P6 설명 "`Websocket emit 직후 SSE fan-out`"
  - 과거 결정 출처: spec §R10 "SSE 어댑터는 Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독해 외부 SSE 스트림으로 변환. 엔진과 직접 결합 없음"
  - 상세: P6 설명에 "Websocket emit 직후 SSE fan-out" 이라는 표현이 있다. §2.5 의 세부 구현 기술은 Redis pub/sub 경유로 올바르게 기술되어 있으나, P6 요약 라인의 "직후" 라는 표현은 ExecutionEngine 코드 내부에서 WebsocketService.emit 직후에 SSE fan-out 을 직접 호출하는 구조로 오해될 수 있다. 이 경우 실행 엔진이 외부 sink 를 직접 알게 되어 R10 의 단일 sink 정책을 위반한다.
  - 제안: P6 설명을 "Websocket emit → Redis pub/sub 을 통한 SSE fan-out" 또는 "ExecutionEngine after-commit hook 으로 NotificationDispatcher 트리거, SSE 어댑터는 Redis pub/sub 수신 경로로 분리"로 교체하여 구현자가 직접 호출 구조로 오해하지 않도록 한다.

### 발견사항 11
- **[INFO]** R11 — P4 의 `@Controller('api/external/executions')` 별도 모듈 분리 확인 (정합)
  - target 위치: plan §2.3 `interaction.controller.ts` 정의
  - 과거 결정 출처: spec §R11 "별도 prefix `/api/external/executions/*`, 기존 `executions` 모듈 수정 없음"
  - 상세: plan 에 `codebase/backend/src/modules/external-interaction/` 신규 모듈로 독립 구성되어 있으며, 기존 `executions` 모듈 수정 체크박스가 없다. `@Controller('api/external/executions')` 이 plan §2.3 에 명시되어 있다. 정합.
  - 제안: 없음.

### 발견사항 12
- **[WARNING]** R12 — P3 dispatcher 의 outbound 서명 config 저장 형태 명시 부재
  - target 위치: plan §2.4 NotificationDispatcher + §2.1 Trigger DTO
  - 과거 결정 출처: spec §R12 "trigger config 에 `hmacAlgorithm: 'sha256'` 형태로 저장, 외부 표면(notification.signing.algorithm) 에서는 `hmac-sha256` 형태로 노출"
  - 상세: R12 는 HMAC 알고리즘 표기를 inbound (기존 Webhook `hmacAlgorithm: 'sha256'`) 와 outbound notification (`signing.algorithm: 'hmac-sha256'`) 으로 명시적으로 분리하는 결정이다. plan §2.1 Trigger DTO 에는 `notification/interaction sub-DTO + SSRF validator` 만 언급되어 있고, 실제로 config JSONB 에 `signing.algorithm` 을 `'hmac-sha256'` 형태로 저장하는지 `'sha256'` 형태로 저장하는지, DTO 검증 에서 어느 표기를 validation 하는지 명시가 없다. plan §2.4 NotificationDispatcher 구현에도 "HMAC 서명" 언급만 있고 알고리즘 표기 변환 로직 (`hmac-sha256` → 실제 `sha256` 알고리즘 선택) 이 어디서 처리되는지 기술이 없다.
  - 제안: plan §2.1 DTO 체크리스트에 "notification.signing.algorithm DTO validation: `hmac-sha256` | `hmac-sha512` (외부 표면 표기 EIA §R12)" 와 "Trigger config 저장 시 `signing.algorithm` 을 그대로 저장 (dispatcher 가 서명 시 `hmac-` prefix strip 후 Node.js `createHmac('sha256', ...)` 호출)" 항목 추가. plan §2.4 에도 "config 의 `signing.algorithm` (`hmac-sha256`) 에서 hash 함수명(`sha256`) 추출 후 HMAC 계산" 명시.

---

## 요약

PR2 구현 phase 분할안(P1~P10)은 전반적으로 spec §R1~R12 의 의사결정을 충실히 반영하고 있다. 기각된 대안(notification 응답 body 로 인터랙션 수신, 외부 WebSocket 신설, 단일 sink 직접 호출, 동일 prefix 컨트롤러 공유)이 plan 에 재도입된 흔적은 없다. 다만 세 가지 점에서 보완이 권장된다. 첫째, P6 요약 라인의 "Websocket emit 직후 SSE fan-out" 문구가 R10 단일 sink 정책의 구조적 위반으로 오해될 수 있어 Redis pub/sub 경유임을 명확히 해야 한다. 둘째, R8(Idempotency cache 제외 범위) 에서 `400 INVALID_COMMAND` 의 cache 제외 여부가 미결 상태로 구현자 판단에 맡겨질 수 있다. 셋째, R12(HMAC 표기 분리) 의 `hmac-sha256` ↔ `sha256` 변환 로직이 DTO/Dispatcher 어느 레이어에서 처리되는지 plan 에 기술되지 않아 구현 시 혼선 가능성이 있다.

## 위험도

LOW

STATUS: WARN
