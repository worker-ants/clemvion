# Testing Review — PR-B2a RESOLUTION 후 (exec-park-durable-resume 11_36_39)

## 발견사항

### [INFO] `StubLlmClient` 단위 테스트 신설 — 경계값 커버리지 적절
- 위치: `/codebase/backend/src/modules/llm/clients/stub.client.spec.ts` (신규)
- 상세: 이전 리뷰(11_22_25 W2)에서 지적된 단위 테스트 부재가 수정됐다. 신규 spec 은 (1) 멀티턴 마지막 user echo, (2) user 메시지 없을 때 빈 echo, (3) 200자 슬라이싱, (4) model 미지정 fallback, (5) embed 결정적 반환, (6) listModels, (7) testConnection 7케이스를 커버한다. 핵심 계약이 모두 고정됐다.
- 잔여 갭: `embed([])` 빈 배열 입력 → `[]` 반환 케이스가 포함되지 않았다. 현재 구현은 `texts.map(() => [0, 0, 0])` 이므로 빈 배열에 대해서는 올바르게 `[]` 를 반환하지만 테스트로 명시적으로 고정되어 있지 않다. INFO 수준이며 회귀 위험은 낮다.

### [INFO] `LlmService` stub 캐시 일관성 테스트 — stub→normal 전환 케이스 불완전
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts` L635–642
- 상세: 추가된 세 케이스 (a) stub 반환+실경로 미진입, (b) 미설정 정상경로, (c) stub 캐시 재사용 은 이전 W3 요구사항을 충족한다. 그러나 (d) 이미 stub 이 캐시된 상태에서 `LLM_STUB_MODE=false` 로 변경해 다시 `createClient` 를 호출하면 어떤 클라이언트가 반환되는지 — 즉 캐시 무효화 여부 — 를 검증하지 않는다. 현재 구현은 `LLM_STUB_MODE=true` 분기를 캐시 체크 앞에 두되, `false` 전환 시에는 캐시에 `StubLlmClient` 인스턴스가 남아 `cached instanceof StubLlmClient` 체크를 건너뛰고 일반 캐시 히트를 반환한다(`this.clientCache.get(config.id)` 에 stub 이 있는 경우). 이 경로가 단위 테스트에서 커버되지 않는다. 실 운영/e2e 에서는 발현 안 함(process 시작 후 모드 변경 없음).

### [INFO] `afterEach` 환경변수 복원 — 테스트 격리 정상
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts` L614–618
- 상세: `prev = process.env.LLM_STUB_MODE` 를 `afterEach` 에서 복원하는 패턴이 올바르게 구현됐다. `prev === undefined` 이면 `delete` 로 완전 제거하여 다른 테스트가 stub 모드 env 를 물려받지 않는다. `OAUTH_STUB_MODE` 선례와 동일한 격리 패턴.

### [INFO] `StubLlmClient` 공유 인스턴스 사용 — `beforeEach` 재생성 없음
- 위치: `/codebase/backend/src/modules/llm/clients/stub.client.spec.ts` L13
- 상세: `const client = new StubLlmClient()` 가 `describe` 최상단에서 한 번만 생성되고 모든 `it` 에서 공유된다. `StubLlmClient` 는 상태를 갖지 않는 순수 구현체이므로 공유해도 테스트 격리에 문제없다. 만약 향후 내부 상태(통화 횟수 카운터 등)가 추가되면 `beforeEach` 로 분리해야 하지만 현재 설계에서는 적절하다.

### [WARNING] `main.ts` 프로덕션 가드 — 단위 테스트로 검증 불가
- 위치: `/codebase/backend/src/main.ts` (추가된 가드), 대응 테스트 없음
- 상세: W1 수정으로 `main.ts` 에 `NODE_ENV=production && LLM_STUB_MODE=true → throw` 가드가 추가됐다. 이는 OAUTH_STUB_MODE 와 동일한 패턴인데, OAUTH_STUB_MODE 가드도 별도 단위 테스트가 없다(선례). `bootstrap()` 함수가 `void bootstrap()` 으로 모듈 최상단에서 즉시 실행되는 구조라 Jest 단위 테스트에서 직접 import 해 테스트하기 어렵다. 프로덕션 오설정 방어 가드가 테스트로 고정되지 않는다.
- 제안: `bootstrap` 을 named export 로 분리하거나, 가드 로직을 `validateBootstrapEnv()` 순수 함수로 추출하고 해당 함수를 단위 테스트로 커버한다. 이는 선례(OAUTH_STUB_MODE) 와 동일한 개선 방향으로, 현재 PR 범위를 초과하는 후속 작업.

### [INFO] e2e `waitForUserTurn` — assistant turn 확인 없이 re-park poll 진행 (이월된 이슈)
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` (e2e spec, 이전 I6/W6 일부)
- 상세: 이전 리뷰에서 지적된 `waitForAssistantTurn` 부재가 이월(follow-up)된 상태다. RESOLUTION 에서 명시적으로 "이월" 처리됐으므로 현재 PR 에서의 수정 대상은 아니나, 이론적 race window 가 여전히 존재한다. stub 즉시 반환으로 실패율이 낮다.

### [INFO] e2e `poll` 중복 정의 및 timeout 불일치 — 이월
- 위치: `execution-park-resume.e2e-spec.ts` PR-B1 vs PR-B2a `poll` 함수
- 상세: RESOLUTION 에서 W6/W7 이 follow-up 으로 이월됐다. 두 `poll` 함수의 timeout 불일치(15_000 vs 20_000) 및 헬퍼 중복이 미해결 상태다.

## 요약

RESOLUTION(11_22_25)이 적용된 현재 코드는 주요 테스트 누락(W2: StubLlmClient spec 신설, W3: LLM_STUB_MODE 분기 3케이스, W1: 프로덕션 가드)을 모두 처리했다. `stub.client.spec.ts` 가 신설돼 결정적 stub 의 핵심 계약을 고정하고, `llm.service.spec.ts` 의 LLM_STUB_MODE 블록이 추가돼 stub 반환/정상경로/캐시 일관성을 검증하며, 테스트 환경변수 격리도 `afterEach` 복원으로 올바르게 처리됐다. 잔여 갭은 (1) `embed([])` 빈 배열 케이스 명시 누락, (2) stub→normal 모드 전환 시 캐시 동작 미검증, (3) `main.ts` 가드 단위 테스트 불가 구조, (4) `waitForAssistantTurn` 부재로 인한 이론적 race window 로 모두 LOW 수준이며 RESOLUTION 에서 이월 처리된 항목과 일치한다.

## 위험도

LOW
