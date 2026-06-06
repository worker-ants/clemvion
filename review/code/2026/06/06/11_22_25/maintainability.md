# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: stub.client.ts

- **[INFO]** 매직 넘버: echo 길이 상한 200, embedding 차원 3, usage 토큰 고정값
  - 위치: `stub.client.ts` L61 (`slice(0, 200)`), L73 (`[0, 0, 0]`), L65 (`inputTokens: 1, outputTokens: 1, totalTokens: 2`)
  - 상세: 세 값 모두 의미 있는 숫자이나 named constant 없이 인라인으로 작성됐다. 향후 다른 stub 파일에서 동일 값을 참조할 때 출처를 추적하기 어렵다. 다만 파일 전체가 테스트 전용 stub 이고 값 자체가 임의적(arbitrary) 이므로 심각도는 낮다.
  - 제안: 파일 상단에 `const ECHO_MAX_CHARS = 200;`, `const EMBEDDING_DIMS = 3;` 등 상수로 추출하거나, 인라인 주석으로 선택 근거를 명시.

- **[INFO]** `embed` 메서드의 벡터 차원 불일치 가능성
  - 위치: `stub.client.ts` L73
  - 상세: 실제 production embedding 모델은 256~3072 차원을 반환한다. stub 이 3차원 고정 벡터를 반환할 때, embedding 결과의 차원 수를 전제하는 코드(예: 코사인 유사도 계산)가 추가되면 테스트에서 조용히 오류가 발생할 수 있다. 파일 주석에 "형태만 충족"이라고 명시돼 있어 의도는 분명하나, 해당 사실이 인터페이스 레벨에서 강제되지 않는다.
  - 제안: 주석에 "embedding e2e 추가 시 실제 차원과 일치하도록 교체 필요"를 명시하거나 TODO 를 남긴다.

---

### 파일 2: llm.service.ts

- **[WARNING]** `createClient` 내부에서 `process.env` 직접 참조 — NestJS DI 패턴과 불일치
  - 위치: `llm.service.ts` L265 (`if (process.env.LLM_STUB_MODE === 'true')`)
  - 상세: 동일 파일의 다른 설정값(`JWT_SECRET`, `ENCRYPTION_KEY` 등)은 NestJS `ConfigService` 또는 `@nestjs/config` 를 통해 주입된다. `OAUTH_STUB_MODE` 선례를 따른다고 주석에 명시됐으나, `OAUTH_STUB_MODE` 가 `process.env` 를 직접 참조하는지 아닌지는 이 파일에서 확인되지 않는다. `process.env` 직접 접근은 (1) ConfigService 를 통한 타입 안전성 우회, (2) 테스트 환경에서 `jest.mock` 또는 `ConfigModule` override 가 아닌 환경변수 직접 조작이 필요해 격리가 어렵다.
  - 제안: `ConfigService.get<string>('LLM_STUB_MODE')` 또는 `ConfigService.get<boolean>('LLM_STUB_MODE')` 으로 교체하거나, 생성자에서 `private readonly isStubMode: boolean` 을 주입받아 한 번만 평가한다. 최소한 `OAUTH_STUB_MODE` 와 동일한 방식인지 일관성을 확인한다.

- **[WARNING]** 스텁 분기가 `createClient` 메서드 중간에 위치 — 책임 분리 불명확
  - 위치: `llm.service.ts` L265–L269 (캐시 히트 체크 직후, 실제 provider 생성 직전)
  - 상세: 현재 흐름은 "캐시 확인 → stub 분기 → 실제 클라이언트 생성 → 캐시 쓰기" 순이다. stub 분기가 캐시에 스텁을 저장하므로 이후 같은 `config.id` 로 호출하면 캐시에서 스텁을 반환한다. 이 동작은 의도적이지만, `LLM_STUB_MODE` 전환(unit test 내에서 환경변수를 mid-test 변경하는 경우) 시 캐시가 오염된다. `createClient` 가 "provider factory + cache" 와 "stub injection" 두 가지 책임을 동시에 지게 된다.
  - 제안: 팩토리 패턴을 유지하면서 stub 주입을 `LLMClientFactory.create` 내부 또는 생성자 시점에 단 한 번 결정하게 한다. 또는 `createClient` 를 두 단계(`resolveClient(config)` → `getCached(id, factory)`)로 분리해 stub 분기는 `resolveClient` 에만 위치시킨다.

- **[INFO]** `withRetry` private 메서드의 `maxRetries` 기본값 3 — 매직 넘버
  - 위치: `llm.service.ts` L507 (`private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3)`)
  - 상세: 파일 상단에 `LIST_MODELS_TIMEOUT_MS`, `LIST_MODELS_CACHE_TTL_MS` 가 named constant 로 정의돼 있으나 `maxRetries` 기본값 3 과 `MAX_BACKOFF_MS = 60_000` (L526, 함수 내부 로컬)은 인라인으로 남아있다. 유지보수 시 retry 정책을 한 곳에서 조정하기 어렵다.
  - 제안: 파일 상단에 `const LLM_MAX_RETRIES = 3;`, `const LLM_MAX_BACKOFF_MS = 60_000;` 을 추가하거나, 기존 상수 블록에 통합한다.

---

### 파일 3: execution-park-resume.e2e-spec.ts (추가된 describe 블록)

- **[WARNING]** `createWorkflow`, `saveCanvas`, `poll`, `authHeader` 함수가 두 `describe` 블록 각각에 중복 정의됨
  - 위치: PR-B1 블록 L1119–1164, PR-B2a 블록 L709–754 (diff 기준 L709–754)
  - 상세: `createWorkflow`, `saveCanvas`, `poll`, `authHeader` 네 함수의 시그니처와 본문이 두 `describe` 블록에서 동일하게 반복된다. `poll` 의 기본 `timeoutMs` 만 B1=15000, B2a=20000 으로 다를 뿐이다. 이 중복은 (1) 하나를 수정할 때 다른 쪽을 놓치는 드리프트, (2) 파일 전체 길이가 1663 라인에 달해 탐색 비용이 높아지는 문제를 유발한다. 특히 `waitForUserTurn`, `readThread`, `submitMessage` 도 PR-B2a 에만 있어 B1/B2a 공유 여부가 불분명하다.
  - 제안: 공통 헬퍼(특히 `createWorkflow`, `saveCanvas`, 기본값 없는 `poll`)를 파일 상단의 모듈 레벨 함수 또는 `helpers/` 파일로 추출. 각 블록이 워크스페이스/토큰 참조를 클로저가 아닌 파라미터로 받도록 리팩터링한다.

- **[WARNING]** 단일 `it` 블록이 8단계의 시나리오를 수행 — 함수 길이·복잡도 과다
  - 위치: `execution-park-resume.e2e-spec.ts` L820–L1034 (PR-B2a의 `it` 블록, 약 215라인)
  - 상세: LLM config insert → 워크플로우 생성/저장 → 실행 → durable 영속 확인 → Turn 1 → Turn 2 → end_conversation → 최종 thread 검증의 8단계가 하나의 `it` 안에 순차 실행된다. 특정 단계 실패 시 어느 단계인지 Jest 출력만으로 진단하기 어렵고, 향후 단계 추가 시 함수가 더 길어진다. 참고로 PR-B1 의 `it` 블록(L1166)도 약 98라인으로 길지만 PR-B2a 가 배로 길다.
  - 제안: 8단계를 별도 `it`(예: "park 초기 상태", "Turn 1 cold rehydration", "Turn 2 무손실 누적", "end_conversation terminal") 로 분리하거나, 단계 번호가 포함된 라벨을 `describe` 로 중첩해 실패 단계를 Jest 보고에서 식별할 수 있게 한다.

- **[WARNING]** `JWT_SECRET` 하드코딩 문자열이 테스트 파일에 직접 포함
  - 위치: `execution-park-resume.e2e-spec.ts` L679
  - 상세: `'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 가 `docker-compose.e2e.yml` 과 테스트 파일 두 곳에 중복 리터럴로 존재한다. 값을 변경할 때 두 파일을 동기화해야 하는 의존성이 생긴다. 현재는 동일한 값을 사용하기에 일치하지만, 동기화 실패 시 테스트는 서버와 다른 키로 mint 해 인증 실패하고 오류 원인 추적이 어렵다.
  - 제안: `test/helpers/` 에 `E2E_JWT_SECRET` 상수를 export 하는 모듈을 두고, `docker-compose.e2e.yml` 에는 값을 유지하되 test 헬퍼가 `process.env.JWT_SECRET` 과 동일한 fallback 값을 가지도록 단일화한다. 또는 `docker-compose.e2e.yml` 의 해당 줄을 "SoT" 주석으로 명시하고, 테스트 fallback 코드에 compose 파일 경로를 참조 주석으로 남긴다.

- **[INFO]** `TERMINAL_STATUSES.includes(s as never)` — 타입 캐스팅 임시방편
  - 위치: `execution-park-resume.e2e-spec.ts` L888, L926, L969, L1004–1005 (PR-B2a 내 여러 위치), PR-B1 에도 동일 패턴
  - 상세: `TERMINAL_STATUSES` 가 `readonly ['completed', 'failed', 'cancelled']` 이고 `s` 가 `string` 이라 `includes` 의 타입 인수가 맞지 않아 `as never` 캐스트를 사용했다. 이 패턴이 6회 이상 반복된다. 타입 가드를 별도 함수로 추출하면 캐스트를 한 곳에서만 유지하고 나머지는 가독성 있는 호출로 대체할 수 있다.
  - 제안: `const isTerminal = (s: string): boolean => TERMINAL_STATUSES.includes(s as (typeof TERMINAL_STATUSES)[number]);` 헬퍼 함수를 파일 상단에 정의하고 `poll` 내부와 각 호출부에서 `isTerminal(s)` 로 교체한다.

- **[INFO]** `readThread` 함수의 반환 타입 중복 인라인 정의
  - 위치: `execution-park-resume.e2e-spec.ts` L757–772 (PR-B2a)
  - 상세: `{ turns: Array<{ seq: number; source: string; text: string; nodeId: string }> } | null` 타입이 반환 타입과 `as` 캐스트 두 곳에 반복된다. 동일한 인라인 타입이 PR-B1/B2a 양쪽에 존재하여 4회 이상 중복된다.
  - 제안: 파일 상단에 `interface ConversationThread { turns: Array<{ seq: number; source: string; text: string; nodeId: string }>; }` 를 정의하고 `readThread` 의 반환 타입과 캐스트에서 참조한다.

---

### 파일 4: docker-compose.e2e.yml

- **[INFO]** 추가 변경은 최소(4행)이며 기존 패턴(`OAUTH_STUB_MODE`)과 일관성 있음
  - 위치: `docker-compose.e2e.yml` L1683–L1686
  - 상세: 주석이 목적을 명확히 설명하고, 스타일이 주변 env 선언과 동일하다. 별도 지적 사항 없음.

---

## 요약

네 파일 중 `stub.client.ts` 와 `docker-compose.e2e.yml` 의 변경은 소규모이고 패턴 일관성이 높아 유지보수성 문제가 경미하다. `llm.service.ts` 는 `process.env` 직접 참조와 `createClient` 내 stub 분기 위치가 NestJS DI 컨벤션 및 책임 분리 측면에서 개선 여지가 있으나, stub 동작 자체는 명확히 문서화됐다. 가장 큰 유지보수성 부담은 e2e 파일 (`execution-park-resume.e2e-spec.ts`) 에 집중된다: `createWorkflow`/`saveCanvas`/`poll`/`authHeader` 가 두 `describe` 블록에 중복되고, PR-B2a의 단일 `it` 이 215라인에 달해 실패 진단과 향후 단계 추가가 어려우며, JWT_SECRET 리터럴이 compose 파일과 테스트 파일 두 곳에 중복된다. 이 세 가지 WARNING 은 모두 test 코드에 국한되어 production 동작에 영향이 없으나, 장기적으로 e2e 회귀 가드의 유지 비용을 높인다.

## 위험도

LOW
