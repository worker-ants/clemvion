STATUS: WARN

## Critical (구현/머지 차단)

없음.

---

## Warning (수정 권장)

### W-1. HMAC 알고리즘 화이트리스트 불일치 — `12-webhook §4.2` vs `14-external-interaction-api §8.2`

- **충돌 위치**: `spec/5-system/12-webhook.md §4.2` (HMAC 서명 검증)  
  "알고리즘 허용 목록: `sha256`, `sha512` 만 허용"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.2`  
  "algorithm whitelist: `hmac-sha256` 만"  
  및 Trigger 등록 페이로드 §4 `"signing": { "algorithm": "hmac-sha256" }`
- **상세**: 12-webhook 의 inbound HMAC(외부 → 서버) 화이트리스트는 `sha256` / `sha512` 이고, 14-EIA 의 outbound HMAC(서버 → 외부) 화이트리스트는 `hmac-sha256` 단일이다. 두 spec 이 같은 `hmacAlgorithm` 필드(`Trigger.config.hmacAlgorithm`) 를 공유하는지, 별도 필드인지 명시가 없다. 또한 표기 형식도 다르다(`sha256` vs `hmac-sha256`). 구현자가 혼동할 여지가 있다.
- **권장 해결**: 14-EIA §8.2 에 "본 절은 outbound notification 서명 전용이며, inbound webhook HMAC 검증(`12-webhook §4.2`)과 별도" 임을 명시한다. 또한 두 spec 에서 알고리즘 식별자 표기를 통일하거나 (예: `hmac-sha256` → `sha256`), 명시적으로 둘의 관계를 선언한다.

---

### W-2. Information Extractor multi-turn 포트 — `finalPort` 값 정합 불완전

- **충돌 위치**: `spec/5-system/14-external-interaction-api.md §6.3`  
  `finalPort` 값 열거: `"out" | "<condition.id>" | "user_ended" | "max_turns" | "error"`
- **충돌 대상**: `spec/4-nodes/3-ai/3-information-extractor.md §3.2`  
  Information Extractor multi-turn 출력 포트: `completed` / `user_ended` / `max_turns` / `error`
- **상세**: 14-EIA §6.3 의 `finalPort` 열거는 AI Agent 관점에서 작성되어 있으며 `out` 포트를 포함한다. Information Extractor multi-turn 의 정상 종료 포트는 `out` 이 아니라 `completed` 이다. 14-EIA 가 Information Extractor multi-turn 을 지원하는 노드 타입으로 §6.2 의 `node.type` 열거(`information_extractor`)에 포함하고 있으므로, `finalPort` 열거에도 `completed` 가 누락되어 있다.
- **권장 해결**: 14-EIA §6.3 의 `finalPort` 설명을 노드 타입별로 분기하거나, `"completed"` 를 열거에 추가하고 "Information Extractor multi-turn 의 정상 종료 포트는 `completed`" 임을 명시한다.

---

### W-3. WebSocket 매핑 표 — `execution.paused` SSE 매핑 항목 비대칭

- **충돌 위치**: `spec/5-system/14-external-interaction-api.md §11` (이벤트 매핑 표)  
  `execution.paused` 항목 없음
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.6` (권위 매핑 표)  
  `execution.paused` → SSE `execution.paused` (디버깅 전용) / Notification `—`
- **상세**: WS spec §4.6 의 권위 이벤트 매핑 표에는 `execution.paused` 가 포함되어 있으나, 14-EIA §11 의 매핑 표에는 해당 행이 누락되어 있다. 14-EIA §5.2 의 SSE 이벤트 종류 설명에도 `execution.paused` 가 언급되지 않는다. 두 표가 1:1 정합해야 한다는 규약(§11 첫 문단)에 따라 보완이 필요하다.
- **권장 해결**: 14-EIA §11 의 이벤트 매핑 표에 `execution.paused` 행을 추가한다 (SSE 노출 여부와 그 이유를 명시 — 디버깅 전용 이벤트이므로 외부 SSE 에 노출하지 않거나, 노출하되 "디버깅 전용" 주석 부착).

---

### W-4. `submit_form` 페이로드 필드명 불일치 — `formData` vs `data`

- **충돌 위치**: `spec/5-system/14-external-interaction-api.md §5.1` 및 §11 매핑 표  
  "body 의 `formData` 가 외부에선 `data`"
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §4.2`  
  `execution.submit_form` payload: `{ executionId, nodeId, formData }`
- **상세**: WS 명령 페이로드 필드명은 `formData` 이고, 14-EIA REST 명령 페이로드 필드명은 `data` 이다. §11 매핑 표의 비고 컬럼에 이 차이가 언급되어 있으나, §5.1 의 body 예시(`"data": { "approver": "alice", ... }`)는 `data` 를 사용한다. 두 표면의 의미 정합은 명시적이나, 명명이 달라 구현 시 혼동 여지가 있고, Form 노드 spec(`4-form.md §4` — `execution.submit_form` WebSocket 명령 사용)과도 동일한 혼선이 이어진다.
- **권장 해결**: §5.1 비고 또는 각주에 "REST 의 `data` 는 WS 의 `formData` 와 동일 의미" 를 명시한다. 또는 일관성을 위해 양쪽 모두 `formData` 로 통일하고 §11 매핑 표 비고를 제거한다.

---

### W-5. `Trigger.config` 확장 필드와 `spec/1-data-model.md §2.8 Trigger` 엔티티 정의 미동기화

- **충돌 위치**: `spec/5-system/14-external-interaction-api.md §7.1`  
  신규 컬럼 4개 추가 (`notification_health`, `notification_last_error`, `notification_secret_v2`, `notification_rotated_at`), `config` JSONB 에 `notification` / `interaction` 필드 추가
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger`  
  컬럼 정의에 위 신규 컬럼들 없음. `config` JSONB 구조도 열거 없음
- **상세**: 14-EIA §7.1 은 DDL 수준 컬럼 추가를 정의하고 있으나, 데이터 모델의 단일 진실(`spec/1-data-model.md §2.8`)에는 반영되어 있지 않다. 구현자가 데이터 모델을 참조하면 신규 컬럼을 놓친다. `12-webhook §2.2` 에는 `notification` / `interaction` config 필드가 이미 반영되어 있으나, 컬럼 4개는 반영되지 않았다.
- **권장 해결**: `spec/1-data-model.md §2.8 Trigger` 에 신규 컬럼 4개를 추가하고, config JSONB 구조에 `notification` / `interaction` 키를 명시한다 (또는 cross-link 추가). 이 변경은 project-planner 스코프이므로 별도 spec 갱신 task 로 추적 권장.

---

### W-6. Re-run 과 외부 Interaction 토큰의 관계 미명시

- **충돌 위치**: `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-04`  
  "`per_execution` 토큰은 execution 종료(completed/failed/cancelled) 시 즉시 invalidate"
- **충돌 대상**: `spec/5-system/13-replay-rerun.md §5`  
  Re-run 은 새 Execution row 생성 (새 executionId)
- **상세**: Re-run 시 원본 execution 이 종료되면 원본 `iext_*` 토큰이 무효화된다. 이는 당연하지만, "Re-run 이 시작되면 새 executionId + 새 iext_* 토큰이 발급되는가" 에 대한 명시가 14-EIA 에 없다. 외부 시스템이 원본 execution 의 notification을 받고, Re-run 이 시작된 뒤에도 원본 executionId 로 interact 를 시도하면 410 Gone 을 받는다. Re-run 의 새 execution 에 대해 새 interaction 정보를 어떻게 취득하는지 흐름이 불분명하다.
- **권장 해결**: 14-EIA §9 또는 §12 에 "Re-run 으로 생성된 새 execution 은 독립적인 iext_* 토큰을 갖는다. 원본 execution notification URL 에서 새 execution 에 대한 `execution.started` / `execution.waiting_for_input` notification 이 새로 발송된다" 를 명시하거나, Re-run 시 기존 interaction 활성화 여부를 explicitly 정의한다.

---

### W-7. `execution.replay_unavailable` SSE 이벤트 이름과 WS `replay.unavailable` 이름 혼동 위험

- **충돌 위치**: `spec/5-system/14-external-interaction-api.md §5.2`  
  버퍼 만료 이벤트 이름: `execution.replay_unavailable`
- **충돌 대상**: `spec/5-system/6-websocket-protocol.md §6.2`  
  내부 WS 이벤트 이름: `replay.unavailable`  
  §4.6 매핑 표: WS `replay.unavailable` → SSE `execution.replay_unavailable`
- **상세**: WS spec §4.6 의 매핑 표에 이미 이 차이가 문서화되어 있으므로 충돌은 아니다. 그러나 두 채널의 이벤트가 서로 다른 네임스페이스 컨벤션(`replay.*` vs `execution.*`)을 따르고 있어 외부 클라이언트가 SSE 이벤트와 WS 이벤트를 비교할 때 혼동할 수 있다. 특히 14-EIA §5.2 는 `execution.replay_unavailable` 를 SSE 에서 발송하고, 클라이언트가 `GET /api/executions/:id` 로 현재 상태를 재조회하도록 안내하는데, 이 이벤트가 "execution 네임스페이스의 일반 이벤트"처럼 보인다.
- **권장 해결**: 14-EIA §5.2 에 "`execution.replay_unavailable` 은 내부 WS 의 `replay.unavailable` 에 대응하는 SSE 전용 표기 (§WS 4.6 참조)"임을 명시한다. 현재 §11 매핑 표에 해당 행이 있으므로 §5.2 에 cross-link 만 추가해도 충분.

---

## Info

### I-1. `per_execution` 토큰 갱신 엔드포인트 — 요구사항 ID 모순 없으나 HTTP 상태 코드 불일치

- **위치**: `spec/5-system/14-external-interaction-api.md §5.5`  
  `POST /api/executions/:executionId/refresh-token` — `401 Unauthorized` 반환 조건: "execution 종료됨, 또는 expiresAt 까지 30분 이상 남음"
- **검토**: EIA-AU-05 에서 "만료 30분 이내 + execution 이 still alive 일 때 갱신 가능"이라 정의하고 §5.5 의 401 조건이 이를 반영하고 있다. 다른 spec 과 직접 충돌은 없으나, 일반 `1-auth.md` 의 401 처리 패턴("토큰 만료")과 의미적으로 다른 조건(30분 이상 남음)에 401 을 사용하는 것이 혼동을 줄 수 있다.
- **제안**: 30분 이상 남은 경우의 거부는 `400 Bad Request` (REFRESH_TOO_EARLY) 를 별도로 정의하는 것을 검토한다. 현재는 INFO 수준.

### I-2. `iext_*` / `itk_*` 토큰 — `spec/5-system/1-auth.md` 토큰 family 미언급

- **위치**: `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-02`
- **검토**: `1-auth.md` 는 access token / refresh token / OAuth 토큰만 다루고 `iext_*` / `itk_*` 를 별도 family 로 정의하지 않는다. 14-EIA §8.3 에서 "JWT HS256, secret 은 trigger 별 분리" 로 별도 family 임을 암시하지만, `1-auth.md` 에 cross-link 나 family 분리 명시가 없다.
- **제안**: `1-auth.md` 에 "External Interaction Token (`iext_*`, `itk_*`) 은 별도 인증 subsystem 으로 [Spec EIA §3.3] 참조" 를 한 줄 추가하면 토큰 모델 일람이 완결된다.

### I-3. `notification_health` 컬럼 타입 — `VARCHAR(16)` 값 범위와 엔티티 명명 컨벤션

- **위치**: `spec/5-system/14-external-interaction-api.md §7.1`  
  `notification_health VARCHAR(16) DEFAULT 'unknown'`
- **검토**: 허용 값 `'unknown'|'healthy'|'degraded'` 는 최대 8자로 VARCHAR(16) 을 과도하게 잡았다. 데이터 모델 spec 관례(다른 Enum 컬럼은 `Enum` 타입으로 표기)와 달리 raw SQL 타입을 사용하고 있어 통일성이 약간 부족하다. 다른 spec 과 직접 충돌은 없음.
- **제안**: `1-data-model.md §2.8` 업데이트 시 `Enum` 타입 + 허용값 명시 형식으로 통일하는 것을 권장.

### I-4. Information Extractor multi-turn 의 `conversationConfig` 외부 노출 — WS §4.4 정합 확인 권장

- **위치**: `spec/5-system/14-external-interaction-api.md §6.2` — `conversationConfig` 를 `information_extractor` 노드에도 동봉
- **검토**: WS §4.4 의 `execution.waiting_for_input` 페이로드는 `ai_conversation` interactionType 에 대해 `conversationConfig` 를 정의하지만, Information Extractor 의 `conversationConfig` 구조가 AI Agent 와 동일한지 별도로 문서화되어 있지 않다. Information Extractor multi-turn 은 `finalize_extraction` tool 을 사용하므로 대화 형식이 약간 다를 수 있다.
- **제안**: 14-EIA §6.2 에 "Information Extractor multi-turn 의 `conversationConfig` 는 AI Agent와 동일 shape" 또는 "차이점" 을 명시한다.

---

## 요약

Cross-Spec 일관성 관점에서 `14-external-interaction-api.md` 와 관련 MOD 파일들은 전반적으로 잘 설계되어 있다. WS `§4.6` 매핑 표와 EIA `§11` 매핑 표의 상호 정합, Re-run spec(RR-PL-07)과의 경계 분리, 실행 엔진 트랜잭션 규약(EIA-RL-04 ↔ 4-execution-engine §1.1) 정합 등 주요 연결 지점은 일관성 있게 처리되었다. 그러나 (W-1) outbound/inbound HMAC 알고리즘 표기 불일치, (W-2) Information Extractor의 `completed` 포트 누락, (W-3) `execution.paused` SSE 매핑 누락, (W-5) 데이터 모델 단일 진실 미동기화 등 명확화가 필요한 WARNING 사항이 존재한다. CRITICAL 차단 사항은 없으며, WARNING 사항들을 수정한 뒤 머지를 진행해도 무방하다.

---

## 위험도

MEDIUM

STATUS: WARN
