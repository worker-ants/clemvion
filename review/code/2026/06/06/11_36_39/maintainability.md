# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: codebase/backend/src/modules/llm/clients/stub.client.ts

- **[INFO]** 매직 넘버: echo 길이 상한 200, embedding 차원 3, usage 토큰 고정값
  - 위치: `stub.client.ts` L29 (`slice(0, 200)`), L41 (`[0, 0, 0]`), L33 (`inputTokens: 1, outputTokens: 1, totalTokens: 2`)
  - 상세: 세 값 모두 의미 있는 숫자이나 named constant 없이 인라인으로 작성됐다. 특히 `200` 은 stub.client.spec.ts 에서도 `'x'.repeat(200)` 으로 하드코딩되어 동기화 포인트가 두 군데로 분리됐다. 파일 전체가 테스트 전용 stub 이고 값 자체가 임의적(arbitrary)이므로 심각도는 낮으나, 향후 슬라이싱 한도 조정 시 spec 파일과 테스트 파일을 동시에 수정해야 하는 번거로움이 생긴다.
  - 제안: 파일 상단에 `const ECHO_MAX_CHARS = 200;`, `const EMBEDDING_DIMS = 3;`, `const STUB_TOKEN_COUNT = 1;` 등을 추출하고 `stub.client.spec.ts` 에서 동일 상수를 import 해 동기화한다.

- **[INFO]** `embed` 메서드의 벡터 차원 불일치 가능성에 대한 TODO 부재
  - 위치: `stub.client.ts` L40–41
  - 상세: 파일 클래스 주석에 "형태만 충족"이라 언급하나, embedding 차원이 production 모델과 다르다는 경고가 메서드 레벨 주석에 없다. embedding e2e 가 추가될 때 이를 놓치기 쉽다.
  - 제안: `embed` 메서드 상단에 `// TODO: embedding e2e 추가 시 실제 provider 차원(1536 등)에 맞게 교체 필요` 를 남긴다.

---

### 파일 2: codebase/backend/src/modules/llm/llm.service.ts

- **[WARNING]** `createClient` 내부에서 `process.env` 직접 참조 — NestJS DI 패턴과 불일치
  - 위치: `llm.service.ts` — 변경 diff의 stub 분기 (`if (process.env.LLM_STUB_MODE === 'true')`)
  - 상세: NestJS 서비스에서 설정 읽기는 `ConfigService` 를 통해 단일화하는 것이 컨벤션이다. `process.env` 직접 접근은 (1) 타입 안전성 우회, (2) 단위 테스트에서 env 조작이 필요해 `ConfigModule` override 없이 환경변수를 직접 세팅해야 하는 격리 어려움을 유발한다. RESOLUTION.md 에서 `OAUTH_STUB_MODE` 선례와 일관성을 이유로 wontfix 처리했으나, `main.ts` 부팅 가드에서도 동일 패턴(`process.env` 직접 비교)을 사용하므로 최소한 코드베이스 내 패턴 일관성은 충족된다. 단, 향후 stub 모드 설정이 늘어날 경우 이 패턴이 누적되는 기술 부채가 된다.
  - 제안: 단기적으로는 현 패턴 유지(RESOLUTION 결정 존중). 중기적으로 `isStubEnabled(envKey: string): boolean` 헬퍼를 정의하고 모든 stub 분기에서 재사용해 `=== 'true'` 비교를 중앙화한다.

- **[WARNING]** stub 분기와 캐시 로직의 혼재 — `createClient` 책임 과다 (이미 fix 된 경계 케이스)
  - 위치: `llm.service.ts` — 변경 diff (stub 분기를 캐시 체크 앞으로 이동 + `instanceof StubLlmClient` 캐시 히트 체크)
  - 상세: 이번 PR 에서 캐시 체크보다 stub 분기를 앞으로 이동해 W5/I7 은 수정됐다. 그러나 수정 후 `createClient` 는 여전히 (a) stub 캐시 조회, (b) stub 생성/캐시 저장, (c) 일반 캐시 조회, (d) 실 클라이언트 생성/캐시 저장의 4개 책임을 순차로 담당한다. `instanceof StubLlmClient` 체크는 stub-mode 에서 캐시된 실 클라이언트가 없음을 보장하는 일종의 방어 코드인데, 이 `instanceof` 패턴이 stub-mode/비-stub-mode 경계를 판별하는 의존성을 `LlmService` 가 `StubLlmClient` 구체 타입에 직접 지게 만든다. 기능은 올바르게 동작하나 향후 stub 교체 시 수정 지점이 늘어난다.
  - 제안: `resolveStubClient(configId): LLMClient | null` 을 별도 private 메서드로 추출해 stub 판별·캐시 로직을 분리하거나, 최소한 stub 분기 블록 전체에 설명 주석을 추가해 의도를 명시한다.

- **[INFO]** `withRetry` 내 `maxRetries` / `MAX_BACKOFF_MS` 매직 넘버 (기존 코드, 이번 PR 변경 범위 외)
  - 위치: `llm.service.ts` L507 (`maxRetries = 3`), L526 (`MAX_BACKOFF_MS = 60_000` — 로컬 상수)
  - 상세: 파일 상단에 `LIST_MODELS_TIMEOUT_MS`, `LIST_MODELS_CACHE_TTL_MS` 가 모듈 레벨 named constant 로 정의된 반면, retry 관련 값은 함수 시그니처 기본값과 함수 내 로컬 상수로 산재한다. 이번 PR 직접 변경 범위는 아니나, LLM 정책 조정 시 일관성 없이 수정 지점이 분산된다.
  - 제안: `const LLM_MAX_RETRIES = 3;`, `const LLM_MAX_BACKOFF_MS = 60_000;` 을 파일 상단 상수 블록에 추가하고 기존 사용처를 교체한다.

---

### 파일 3: codebase/backend/src/main.ts

- **[INFO]** 새 가드 블록의 오류 메시지 스타일 불일치
  - 위치: `main.ts` — 신규 추가된 LLM_STUB_MODE 가드 (`throw new Error('LLM_STUB_MODE=true is not allowed when NODE_ENV=production')`)
  - 상세: 바로 위의 OAUTH_STUB_MODE 가드 오류 메시지는 `throw new Error(\n  'OAUTH_STUB_MODE=true is not allowed when NODE_ENV=production',\n)` 처럼 멀티라인 포매팅이고, 신규 LLM_STUB_MODE 가드는 동일 내용을 단일 라인으로 작성해 Prettier 80자 제한을 초과한다. 기능적 문제는 없으나 기존 코드 스타일과 불일치한다.
  - 제안: 기존 OAUTH_STUB_MODE 오류 메시지와 동일한 포매팅으로 맞춘다:
    ```ts
    throw new Error(
      'LLM_STUB_MODE=true is not allowed when NODE_ENV=production',
    );
    ```

---

### 파일 4: codebase/backend/src/modules/llm/llm.service.spec.ts

- **[INFO]** `describe('LLM_STUB_MODE (createClient) — review W3')` — describe 레이블에 리뷰 트래커 참조 포함
  - 위치: `llm.service.spec.ts` 추가 describe 블록 헤더
  - 상세: `— review W3` 이라는 리뷰 트래커 식별자가 describe 레이블에 포함돼 있다. 테스트 레이블은 기능 의도를 기술해야 하며, 리뷰 프로세스 추적 정보는 테스트 파일에 포함하는 게 맞지 않다. Jest 출력에서 해당 describe 이름이 그대로 표시되어 혼란을 줄 수 있다.
  - 제안: 레이블을 `describe('LLM_STUB_MODE (createClient)')` 로 줄이고, 리뷰 트래커 참조는 블록 내부 주석으로 이동한다.

- **[INFO]** `as never` 캐스트 — `config` 객체 타입 우회
  - 위치: `llm.service.spec.ts` 추가 블록 내 `const config = { ... } as never;`
  - 상세: `LlmConfig` entity 객체를 `as never` 로 캐스트해 타입 체커를 완전히 우회한다. `as never` 는 TypeScript 에서 가장 강한 타입 우회 패턴으로, 실제 `LlmConfig` 구조가 변경돼도 테스트가 타입 오류 없이 통과된다.
  - 제안: `as Partial<LlmConfig>` 또는 테스트 팩토리 함수를 사용해 필요한 필드만 명시하고, `as never` 대신 `as unknown as LlmConfig` 를 사용해 의도를 명시화한다.

---

### 파일 5: codebase/backend/src/modules/llm/clients/stub.client.spec.ts (신규)

- **[INFO]** 상수 `200` 이 spec 파일과 테스트 파일에 중복 하드코딩
  - 위치: `stub.client.spec.ts` L68–71 (`'x'.repeat(500)` / `'x'.repeat(200)`)
  - 상세: `stub.client.ts` 에서 `slice(0, 200)` 으로 정의된 값이 테스트에서도 리터럴 `200` 으로 반복된다. `stub.client.ts` 에서 named constant 가 export 되지 않으므로 두 파일이 독립적으로 동일 숫자를 관리한다.
  - 제안: `stub.client.ts` 에서 `export const ECHO_MAX_CHARS = 200;` 을 export 하고, `stub.client.spec.ts` 에서 import 해 테스트 표현식을 `'x'.repeat(ECHO_MAX_CHARS)` 로 교체한다.

- **[INFO]** `embed` 테스트에서 벡터 차원(`[0, 0, 0]`)을 하드코딩
  - 위치: `stub.client.spec.ts` L81–85
  - 상세: `stub.client.ts` 의 `[0, 0, 0]` 과 테스트의 `[[0,0,0],[0,0,0]]` 이 독립적으로 유지된다.
  - 제안: `EMBEDDING_DIMS` 상수를 export 해 `Array(EMBEDDING_DIMS).fill(0)` 으로 통일하거나, 차원 상수를 테스트에서 import 한다.

---

## 요약

이번 PR 변경(LLM_STUB_MODE env-gate, StubLlmClient 신설, main.ts 프로덕션 가드, 관련 단위 테스트)의 유지보수성은 전반적으로 양호하다. `OAUTH_STUB_MODE` 선례 패턴을 의식적으로 따라 일관성을 유지했으며, 주석이 stub 목적과 제약을 명확히 설명한다. 개선 여지는 세 곳에 집중된다. (1) `stub.client.ts` 와 `stub.client.spec.ts` 가 `200`, `[0,0,0]` 같은 매직 넘버를 독립적으로 중복 관리해 한 쪽 변경 시 동기화를 놓치기 쉽다. (2) `createClient` 가 stub 캐시 조회, stub 생성, 일반 캐시 조회, 실 클라이언트 생성의 4개 책임을 순차로 담당해 향후 stub 교체 시 수정 지점이 많다. (3) 테스트 코드에서 `as never` 캐스트 패턴과 describe 레이블 내 리뷰 트래커 참조가 코드베이스 컨벤션과 맞지 않는다. 이 세 이슈는 모두 production 동작에 영향이 없으며 test 코드 품질과 향후 수정 비용에 국한되는 LOW 수준이다.

## 위험도

LOW

STATUS: SUCCESS
