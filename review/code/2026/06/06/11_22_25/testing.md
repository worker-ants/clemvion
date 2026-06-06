# Testing Review — PR-B2a (exec-park-durable-resume)

## 발견사항

### [WARNING] `StubLlmClient` 단위 테스트 부재
- 위치: `/codebase/backend/src/modules/llm/clients/stub.client.ts` (신규 파일)
- 상세: `stub.client.spec.ts` 가 존재하지 않는다. `chat()` 의 `messages` 배열이 비어 있을 때(`lastUser` 가 `undefined`)의 동작, `content` 가 문자열이 아닌 타입일 때의 동작, 200자 초과 `echo` 슬라이싱, `embed()` 의 빈 배열 입력 등 경계값이 테스트되지 않는다. stub 자체는 단순하나, e2e 의 결정적 동작 근거가 되는 코드이므로 단위 테스트로 고정하는 것이 회귀 방지에 유효하다.
- 제안: `stub.client.spec.ts` 를 추가하여 (1) 빈 메시지 배열 → `[stub] received: ` 반환, (2) 200자 초과 내용 슬라이싱, (3) `embed([])` → `[]` 반환, (4) `listModels()` / `testConnection()` 고정값 검증을 각각 커버한다.

### [WARNING] `LlmService.createClient` 의 `LLM_STUB_MODE` 분기에 대한 단위 테스트 없음
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts` — `LLM_STUB_MODE` 관련 케이스 0개
- 상세: `llm.service.spec.ts` 는 `LLM_STUB_MODE` 분기를 전혀 커버하지 않는다. `OAUTH_STUB_MODE` 는 `auth-oauth.service.spec.ts` 에서 `process.env.OAUTH_STUB_MODE = 'true'` / `'false'` 를 명시적으로 설정해 분기를 검증한다. `LLM_STUB_MODE` 도 동일한 패턴으로 검증해야 한다: (a) `LLM_STUB_MODE=true` 시 `clientFactory.create` 미호출 + `StubLlmClient` 반환, (b) 환경변수 미설정 또는 `false` 시 정상 provider 경로, (c) stub 캐시에 저장되어 두 번째 호출에서 동일 인스턴스 반환.
- 제안: `llm.service.spec.ts` 의 `createClient` 또는 신규 `describe('LLM_STUB_MODE')` 블록에서 `process.env.LLM_STUB_MODE` 를 설정/복원하여 위 케이스들을 추가한다.

### [WARNING] `LLM_STUB_MODE` 에 `NODE_ENV=production` 차단 가드 없음 — 테스트로 검증 불가
- 위치: `/codebase/backend/src/modules/llm/llm.service.ts` L81 / `/codebase/backend/src/main.ts`
- 상세: `OAUTH_STUB_MODE` 는 `main.ts` 에서 `NODE_ENV=production` 일 때 프로세스를 fail-closed 로 종료하는 부트스트랩 가드를 갖는다. `LLM_STUB_MODE` 는 해당 가드가 없어, 배포자가 실수로 프로덕션 환경에 `LLM_STUB_MODE=true` 를 설정해도 부팅이 허용되고 모든 LLM 호출이 stub 으로 대체된다. 이는 데이터 정합성 훼손(실제 LLM 응답 대신 echo 반환)으로 이어질 수 있으며, 가드가 없으므로 테스트로도 검증할 방법이 없다.
- 제안: `main.ts` 에 `OAUTH_STUB_MODE` 와 동일한 패턴으로 `LLM_STUB_MODE=true && NODE_ENV=production` 조합을 fail-closed 로 거부하는 가드를 추가한다. 가드 추가 후 단위 테스트에서 이 거부 동작도 검증한다.

### [INFO] e2e — assistant turn(echo) 완료 확인 없이 re-park 상태를 poll
- 위치: `/codebase/backend/test/execution-park-resume.e2e-spec.ts` L507-L514
- 상세: `waitForUserTurn(executionId, 'turn-one-question')` 으로 user turn이 thread에 기록될 때까지 대기하지만, assistant echo turn이 thread에 기록됐는지는 poll하지 않는다. submit → user turn 기록 → LLM call(stub) → assistant turn 기록 → re-park 순서인데, user turn 이 기록된 직후 poll을 시작하면 아직 assistant turn 처리 중이거나 re-park 전일 수 있다. 현재 테스트는 20초 poll timeout이 충분해 실제로는 통과하지만, 처리 지연 환경에서 re-park poll 이 running 상태를 관통하지 못하고 waiting_for_input 을 stale 하게 볼 가능성이 있다. `waitForAssistantTurn` 을 추가해 echo 도 poll 하면 순서 보장이 명확해진다.
- 제안: `waitForUserTurn` 과 대칭되는 `waitForAssistantTurn(executionId, expectedEchoText)` 헬퍼를 추가해 re-park poll 전에 assistant echo 도 thread에 나타날 때까지 대기한다.

### [INFO] e2e — `poll` timeout 을 두 describe 간 다르게 설정 (15_000 vs 20_000)
- 위치: PR-B1 describe `poll` L105: `15_000`, PR-B2a describe `poll` L322: `20_000`
- 상세: 두 describe 가 각자의 `poll` 함수를 scope 내 중복 정의한다. 타임아웃이 달라 일관성이 떨어지며, PR-B1 의 15초는 CI 환경에서 타이트할 수 있다. 단순 INFO 수준이며 현재 동작에는 문제없다.
- 제안: 공유 헬퍼 파일(`test/helpers/poll.ts` 등)로 추출하거나 동일 타임아웃으로 통일한다.

### [INFO] `StubLlmClient.embed` 고정 3차원 벡터 — embedding e2e 사용 시 불일치 위험
- 위치: `/codebase/backend/src/modules/llm/clients/stub.client.ts` L73
- 상세: 3차원 zero 벡터를 반환한다. 현재는 embedding e2e 가 없어 문제가 없으나, 향후 embedding 기반 기능(벡터 검색 등)의 e2e 를 추가할 경우 실제 provider의 고차원 벡터와 치수가 달라 cosine similarity 계산 등이 실패한다. 주석에 치수 고정 이유(`형태만 충족`)가 명시되어 있어 의도는 명확하다.
- 제안: 주석에 "embedding e2e 추가 시 차원 수 조정 필요" 를 명시해 향후 사용자에게 경고한다.

### [INFO] e2e — `llm_config` 행의 `is_default=false` — `resolveConfig` 경로 미검증
- 위치: `/codebase/backend/test/execution-park-resume.e2e-spec.ts` L419
- 상세: `is_default=false` 로 삽입하고 `aiNode.config.llmConfigId` 에 직접 ID를 지정한다. 이는 `resolveConfig`의 명시 configId 경로를 거치므로 default 미설정 환경에서의 오류 처리(LLM_CONFIG_NOT_FOUND)는 테스트되지 않는다. 현재 PR 의 목적(turn-park 검증)에는 적합하지만, LLM 없이 ai_agent 를 실행할 때의 오류 경로는 별도 테스트가 필요하다.
- 제안: 현재 PR 범위에서는 수용 가능. 별도 e2e 케이스에서 `llmConfigId` 미설정 + 기본 LLM 없음 조합의 실패 경로를 커버한다.

---

## 요약

신규 `StubLlmClient` 는 e2e 목적에 부합하는 최소 구현이지만 단위 테스트가 전혀 없으며, `LlmService.createClient` 의 `LLM_STUB_MODE` 분기도 기존 `llm.service.spec.ts` 에 커버되지 않는다. 선례인 `OAUTH_STUB_MODE` 는 단위 테스트와 `main.ts` 의 프로덕션 차단 가드를 모두 갖추고 있으나 `LLM_STUB_MODE` 는 두 가지 모두 빠져 있어, 실수로 프로덕션에 env가 설정될 경우 탐지 수단이 없다. e2e 테스트(`PR-B2a`) 자체는 상태 전이 불변식 검증 범위가 충실하고, `waitForUserTurn` 기반 비동기 완료 판별도 적절하다. 단, assistant echo 확인 전에 re-park 상태를 poll 하는 순서 잠재적 경쟁 조건과 `poll` 함수의 두 describe 간 중복 정의가 개선 여지로 남는다.

## 위험도

MEDIUM
