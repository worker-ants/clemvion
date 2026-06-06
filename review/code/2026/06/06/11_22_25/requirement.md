# Requirement Review — PR-B2a (turn-park e2e + StubLlmClient + LLM_STUB_MODE)

## 발견사항

---

### 1. [INFO] StubLlmClient — `content` 타입 불일치 (엄격 타입이면 WARNING)

- **위치**: `codebase/backend/src/modules/llm/clients/stub.client.ts` L63
- **상세**: `ChatResult.content` 는 인터페이스에서 `string | null` 로 선언되어 있다(`llm-client.interface.ts` L66). Stub 은 `content: '[stub] received: ${echo}'` 로 항상 `string` 을 반환하는데, 이는 인터페이스 제약에 완전히 합치한다. 단, `toolCalls: []` 는 빈 배열로 전달되는데 인터페이스는 `toolCalls?: ToolCall[]`(optional) 이므로 허용된다. **타입 위반 없음**.
- **제안**: 현 상태 유지.

---

### 2. [INFO] StubLlmClient — `stream` 미구현

- **위치**: `codebase/backend/src/modules/llm/clients/stub.client.ts`
- **상세**: `LLMClient` 인터페이스에서 `stream` 은 optional(`stream?:`)이다. 주석이 명시하듯 turn-park e2e 는 `chat` 경로만 exercise 하므로 `stream` 구현 부재는 e2e 목적 범위 내에서 결함이 아니다. 단, `LlmService.chatStream` 이 stub-mode 에서 호출되면 "provider does not support streaming" 예외가 발생한다. e2e 에서 streaming 경로를 exercise 하지 않는다고 주석에 명시하므로 INFO 수준.
- **제안**: 현 상태 유지 (추후 streaming 경로 e2e 추가 시 stub `stream` 구현 필요).

---

### 3. [WARNING] `LLM_STUB_MODE` 캐시 키 — 동일 `config.id` 로 실 클라이언트와 stub 이 혼용될 수 있는 경계 케이스

- **위치**: `codebase/backend/src/modules/llm/llm.service.ts` L81–84
- **상세**: `createClient` 는 먼저 `clientCache.get(config.id)` 를 체크한다(L72). `LLM_STUB_MODE=true` 인데 같은 process 에서 이미 실 클라이언트가 캐시된 경우(예: app startup 에서 먼저 실 클라이언트가 캐시되고, env 가 런타임에 변경되는 비정상 시나리오) stub 이 아닌 실 클라이언트가 반환될 수 있다. e2e 환경에서는 process 시작 시부터 `LLM_STUB_MODE=true` 이고 캐시가 비어 있으므로 실제 발생하지 않는다. 운영에서는 `LLM_STUB_MODE` 가 설정되지 않아 발생하지 않는다. 그러나 단위 테스트에서 env 를 변경하며 캐시를 재사용하면 혼용이 생긴다.
- **제안**: `LLM_STUB_MODE` 확인을 캐시 체크 이전으로 이동하거나, stub-mode 에서 캐시 히트를 무시하는 로직을 추가한다. 아니면 현재처럼 두되 주석에 "캐시는 process 시작 시 비어 있음을 전제" 를 명시한다.

---

### 4. [INFO] e2e — `waitForUserTurn` 이 user turn만 폴링하고 assistant turn을 별도로 대기하지 않음

- **위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L799–819
- **상세**: `waitForUserTurn` 은 `ai_user` 소스의 turn 이 DB `conversation_thread` 에 나타날 때까지 polling 한다. 이는 "user turn 이 thread 에 기록됨 = 메시지 수신 완료"를 나타내며, 실제로는 LLM 호출과 assistant 응답 emit 가 그 이후에 이어진다. 실질적으로 `waitForUserTurn` 만족 후 곧 `afterTurn1 = poll(waiting_for_input)` 이 호출되므로 assistant turn 이 기록되는 시간을 더 기다리게 된다. 흐름상 race 위험은 낮으나, **단 아직 LLM 호출 중(stub 이라도 비동기)에 `poll(waiting_for_input)` 이 이전 park 상태를 읽어 즉시 반환하는 위험이 있다**. stub 은 즉시 반환하고 이후 park 이 sync 에 가까운 속도로 발생하므로 실제 타이밍 race 는 거의 없지만, 이론적으로 `waitForUserTurn` 성공 직후 `poll` 이 이전 park의 `waiting_for_input` 을 잡아 true 를 반환한 뒤 실제 re-park 보다 먼저 thread assertion 을 하면 assistant turn 이 누락된 상태로 검증될 수 있다. 사실상 stub 속도 + 비동기 처리 순서로 인해 실패율이 낮다.
- **제안**: `waitForUserTurn` 후 assistant turn도 thread 에 나타날 때까지 대기하는 `waitForAssistantTurn` 을 추가해 re-park 완료를 더 엄밀하게 확정하거나, 현재처럼 poll(waiting_for_input) 을 대기 조건으로 사용하되 이것이 re-park 완료를 의미한다는 주석을 강화한다.

---

### 5. [INFO] e2e — `finalAsstTexts` 정렬 순서 강 보장 (`toEqual` 사용)

- **위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L1027–1034
- **상세**: 최종 thread 검증에서 `finalUserTexts` 와 `finalAsstTexts` 에 `.toEqual([...])` 를 사용해 순서와 내용을 동시에 검증한다. `conversation_thread` turns 는 `seq` 단조 증가를 별도 검증(L993–996)하므로 이 강한 보장은 합리적이다. 단 e2e spec 에서 thread 의 ai_user + ai_assistant 수가 정확히 각 2개임을 가정하므로, stub 이 예기치 않게 복수 응답을 emit 하거나 재개 중 중복 turn 이 기록되면 이 assertion 이 자연스럽게 실패해 회귀를 포착한다. 요구사항 관점에서 적절한 수준.

---

### 6. [WARNING] e2e — `mintInteractionToken` 의 `expiresIn: 3600` (숫자 초)과 spec EIA-AU-02 기본값 일치 여부

- **위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L701–708
- **상세**: spec EIA-AU-02 는 `per_execution` 토큰의 기본 만료를 "1h" 로 명시한다. 테스트가 `expiresIn: 3600` 으로 mint 하므로 수치상 일치한다. payload 필드는 `sub: executionId, aud: 'interaction', jti: randomUUID()` 로, spec §7.3 의 `(sub=executionId, aud='interaction', exp, jti)` 와 일치한다. `algorithm: 'HS256'` 은 spec §8.3 "JWT HS256" 과 일치. prefix `iext_` 도 spec §7.3 `iext_*` 와 일치. **spec fidelity 충족**.
- **단**, `exp` 는 `jsonwebtoken` 의 `expiresIn` 옵션이 자동으로 계산하므로 payload 명시 없이도 포함된다. 구체적으로 spec 은 `issuePerExecution` 가 `secret = JWT_SECRET` (trigger-local secret 이 아닌 전역 `JWT_SECRET`)으로 서명하는지 명시하지 않는다. e2e 는 `JWT_SECRET` 를 fallback 시 e2e-only 값으로 직접 mint하는데, 실제 `InteractionTokenService.issuePerExecution` 가 동일한 `JWT_SECRET` 을 사용한다고 가정한 것이다. 이 가정이 어긋나면 e2e 의 토큰이 서버에서 검증 실패한다. spec §8.3 은 "JWT HS256, secret 은 trigger 별 분리" 라고 명시하나, `per_execution` 토큰은 §7.3 에서 "별도 테이블을 만들지 않고 JWT 자체" 라고 하며 trigger-local secret 분리가 명확하지 않다. e2e 에서 테스트가 실제로 통과함으로써 이 가정이 실행 시 검증된다. INFO 경계.

---

### 7. [INFO] docker-compose.e2e.yml — `LLM_STUB_MODE` 위치

- **위치**: `docker-compose.e2e.yml` L137
- **상세**: `OAUTH_STUB_MODE: "true"` 바로 다음에 `LLM_STUB_MODE: "true"` 를 추가했다. 주석이 목적을 명확히 설명하고, 프로덕션 환경에서 미설정 시 비활성화되는 guard 도 설명한다. `JWT_SECRET` 의 `backend-e2e` 서비스 값(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)과 테스트의 fallback 값이 일치한다. e2e runner 서비스(`backend-e2e-runner`)에는 `JWT_SECRET` 이 없는데, runner 는 백엔드에 HTTP 로 요청하며 JWT_SECRET 은 runner 코드에서 직접 사용하지 않는다(mint 는 supertest 안에서 `process.env.JWT_SECRET` fallback 상수로 처리). **backend-e2e-runner 에 `JWT_SECRET` env 를 주입하지 않으면** `process.env.JWT_SECRET` 이 `undefined` 가 되어 hardcoded fallback 상수를 사용한다. 이 상수가 `backend-e2e` 의 `JWT_SECRET` 과 동일하므로 실제 동작에는 문제없다.
- **제안**: runner 에도 `JWT_SECRET` 을 명시적으로 주입하거나, "runner 는 hardcoded fallback 으로 backend 와 동일 키를 사용한다" 는 주석을 추가해 암묵적 의존을 명시화한다.

---

### 8. [INFO] StubLlmClient embed — 3차원 고정 벡터

- **위치**: `codebase/backend/src/modules/llm/clients/stub.client.ts` L72–75
- **상세**: `embed` 는 3차원 zero 벡터 `[0, 0, 0]` 를 반환한다. 주석이 "embedding 경로 e2e 가 없으므로 형태만 충족" 이라고 명시한다. 실제 embedding provider 는 1536차원(OpenAI) 등을 반환하므로, 만약 embedding 경로가 e2e 에 추가되면 차원 불일치로 downstream 코사인 유사도 등이 오동작할 것이다. 현재 범위에서는 문제 없음.

---

### 9. [INFO] e2e — DB insert `is_default: false` 로 llm_config 생성

- **위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L831–835
- **상세**: `is_default: false` 로 삽입하면 `ai_agent` 노드가 `llmConfigId` 를 명시(config 필드)했으므로 `LlmService.resolveConfig` 가 해당 row 를 `findEntity` 로 찾는다. `LLM_STUB_MODE=true` 에서는 `createClient` 가 복호화 이전에 stub 을 반환하므로 `api_key: 'stub-not-used'` 는 실제로 복호화되지 않는다. 이 우회 설계는 e2e 주석에 명확히 기술되어 있다. 기능상 문제 없음.

---

### 10. [INFO] spec fidelity — `§4.x turn-park`, `§7.5 rehydration` 참조 확인

- **위치**: `stub.client.ts` 주석, e2e 주석 전반
- **상세**: 코드·테스트·compose 전반의 주석이 spec `§4.x turn-park`, `§7.5 rehydration`, `processAiResumeTurn`, `_resumeCheckpoint`, `conversation_thread` 를 올바르게 참조한다. Spec `4-execution-engine.md §4.x banner`(L406–408)는 PR-B2a 완료를 반영해 갱신되어 있으며, e2e 의 검증 항목(park 시 execution=waiting_for_input durable + node_execution WAITING + `output_data._resumeCheckpoint` 존재 + thread 무손실 누적 + end_conversation → completed)이 spec 불변식 목록과 line-level 로 일치한다.

---

### 11. [INFO] spec fidelity — `conversation_thread` turns 스키마

- **위치**: `codebase/backend/test/execution-park-resume.e2e-spec.ts` L759–773 (`readThread` 반환 타입)
- **상세**: e2e 가 기대하는 turn 스키마 `{ seq, source, text, nodeId }` 는 spec `conventions/conversation-thread.md §1.3` 의 필드(`seq`, `source`, `text`, `nodeId`)와 일치한다. `source` 값 `ai_user` / `ai_assistant` 도 spec §1.4 와 일치한다.

---

## 요약

PR-B2a (top-level multi-turn AI turn-park → cold rehydration resume) 를 지원하는 세 가지 변경 — `StubLlmClient` 신설, `LlmService.createClient` env-gate, e2e `describe` 블록 추가, `docker-compose.e2e.yml` env 추가 — 은 의도한 기능 요구사항을 기능적으로 충족한다. `ChatResult` 타입 인터페이스 준수, interaction token 페이로드(sub/aud/jti/expiresIn/prefix/algorithm), conversation_thread turn 스키마, _resumeCheckpoint 검증, seq 단조 증가, end_conversation → completed 전이 등 핵심 불변식을 모두 검증한다. 주요 미세 위험은 (a) `clientCache` 가 이미 히트된 경우 `LLM_STUB_MODE` 확인이 후행한다는 점(e2e 환경에서는 발현 안 함), (b) `waitForUserTurn` 이 user turn 기록을 확인하지만 assistant turn 기록 + re-park 완료를 원자적으로 대기하지 않는다는 경미한 race window — 두 가지 모두 CRITICAL 이 아닌 WARNING/INFO 수준이다. spec §4.x, §7.5 불변식과 코드·테스트 구조 간 line-level 정합은 양호하다.

## 위험도

LOW
