# Testing Review — exec-park-polish

## 발견사항

### [INFO] 파일 1: `.env.example` — 테스트 관점 영향 없음
- 위치: `codebase/backend/.env.example`
- 상세: `INTERACTION_JWT_SECRET` 주석 추가와 `LLM_STUB_MODE=false` 등재는 환경변수 문서화 변경이며, 직접적 테스트 대상이 아님. `LLM_STUB_MODE` 는 e2e 도커 환경에서 StubLlmClient 를 주입하는 용도임이 명확히 기재되어 있음.
- 제안: 없음 (문서 변경).

---

### [INFO] 파일 2: `execution-engine.service.spec.ts` — 메서드명 rename 추적 정확성
- 위치: diff 전체 (8곳 `driveResumeDetached` → `driveResumeAwaited`)
- 상세: 본 변경은 순수 rename 추적이다. 테스트 내 `svcAny.driveResumeDetached` spy(L11717, L11731) 가 `svcAny.driveResumeAwaited` 로 정확히 갱신됐고, 주석 7곳도 일관되게 수정됐음. 테스트 로직(mock 구성, assertion) 자체는 변경 없으므로 회귀 위험 없음.
- 제안: 없음 (rename-only 추적).

---

### [INFO] 파일 3: `execution-engine.service.ts` — `ProcessTurnResult` type alias 도입
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2646, L3790, L5235, L5310, L5847, L6461
- 상세: `void | ParkSignal` 인라인 혼용을 `ProcessTurnResult` named alias 로 통일했으며, 관련 메서드 시그니처 4종(`waitForFormSubmission`, `waitForButtonInteraction`, `waitForAiConversation`, `processAiResumeTurn`) 및 지역 변수가 일관되게 교체됐음. 타입 rename 이므로 런타임 동작 변경 없고 기존 테스트는 그대로 유효함. 별도 단위테스트 추가 불필요(컴파일 타임 계약 강화이며 테스트로 의미 있게 검증할 동작 변화 없음).
- 제안: 없음.

---

### [WARNING] 파일 4: `interaction-token.service.spec.ts` — 같은 describe 블록이 두 describe 에 중복 존재
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L2394~L2432 (itk describe) vs L1912~L1952 (iext describe)
- 상세: `constructor — secret 미설정 시 prod fail-closed` describe 블록이 `iext_*` 상위 describe 와 `itk_*` 상위 describe 양쪽에 동일 내용으로 각각 추가됐다. 생성자는 두 describe 가 공유하는 단일 클래스(`InteractionTokenService`)이므로 동일 테스트를 두 곳에서 실행하는 것은 중복이다.
  - 두 블록은 `process.env.NODE_ENV`, `INTERACTION_JWT_SECRET`, `JWT_SECRET` 에 대해 동일한 `afterEach` 복원 로직과 동일한 두 it-case 를 보유한다.
  - 중복 실행 자체가 오동작을 유발하진 않지만, 테스트 수가 불필요하게 늘어나며 향후 생성자 동작 변경 시 두 곳을 함께 수정해야 하는 유지보수 부담이 생긴다.
- 제안: 두 상위 describe 의 바깥 독립 describe 로 추출하거나, 하나를 제거하고 나머지 하나가 생성자 공유 계약을 명확히 표현하도록 한다. 예: 최상위에 `describe('InteractionTokenService — constructor', ...)` 를 별도로 두고 양쪽 내부 블록을 삭제.

---

### [INFO] 파일 4: `interaction-token.service.spec.ts` — `process.env` 직접 조작의 격리 문제
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` L1915~L1925, L2396~L2406 (`const OLD_ENV = process.env.NODE_ENV; afterEach 복원`)
- 상세: 두 블록 모두 `const OLD_ENV = process.env.NODE_ENV` 를 블록 정의 시점(describe 스코프, 즉 module 로드 시)에 캡처한다. `afterEach` 에서 캡처 값으로 복원하는 방식은 올바르게 구현됐으나, `beforeEach` 가 아닌 describe 레벨 상수로 캡처하므로 테스트 파일 내 순서 의존이 있을 경우 이전 테스트가 `NODE_ENV` 를 변경한 상태로 초기 값이 굳어질 수 있다. 현재 구조에서는 `it` 실행 전 describe 선언 시점에 캡처되므로 위험이 낮지만, 특히 두 동일 블록이 병렬 worker 에서 실행될 경우 환경 경합이 발생할 수 있다. Jest 기본값은 파일 단위 격리(단일 VM)이므로 현재 코드베이스에서는 안전하지만, `--runInBand` 외 병렬 설정 변경 시 주의 필요.
- 제안: `const OLD_ENV` 캡처를 `beforeEach` 안으로 이동(또는 `let OLD_ENV: string | undefined; beforeEach(() => { OLD_ENV = process.env.NODE_ENV; })`). 단기적으로는 낮은 위험.

---

### [INFO] 파일 5: `interaction-token.service.ts` — prod fail-closed 가드 테스트 충분성
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` L2457~L2476
- 상세: 신규 prod fail-closed 가드(NODE_ENV=production + secret 전무 → throw)에 대응하는 단위테스트가 `interaction-token.service.spec.ts` 에 2개 추가됐고 두 케이스(prod throw, dev no-throw) 를 명확히 커버한다. 커버리지 관점에서 다음 엣지 케이스가 테스트되지 않았음:
  1. `NODE_ENV=production` + `INTERACTION_JWT_SECRET` 만 설정(JWT_SECRET 없음) → throw 안 해야 함.
  2. `NODE_ENV=production` + `JWT_SECRET` 만 설정(INTERACTION_JWT_SECRET 없음) → throw 안 해야 함.
  3. `NODE_ENV=staging` 같이 neither production 도 development 도 아닌 환경 → dev fallback 으로 분류되는지.
  - 현재 두 테스트는 "secret 전무" 케이스만 커버하며 fallback 체인의 개별 환경변수 작동은 상위 describe 블록의 기존 테스트가 간접적으로 검증한다(makeService 는 `interaction.jwtSecret` 를 설정). 3번(staging) 은 `process.env.NODE_ENV !== 'production'` 조건상 dev-safe 로 떨어지므로 INFO 등급으로 분류.
- 제안: 선택적으로 케이스 1·2 를 추가해 "prod 에서 둘 중 하나라도 있으면 정상 부팅" 을 명시 검증하면 계약이 더 명확해짐.

---

### [INFO] 파일 6~9: 계획 문서 · spec 문서 — 테스트 관련성 없음
- 위치: `plan/in-progress/exec-park-polish.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/4-execution-engine.md`, `spec/conventions/execution-context.md`
- 상세: 계획·spec 문서 변경으로 직접 테스트 대상이 아님. plan 내 "B2 단위테스트" 항목이 실제 spec.ts 변경과 대응하므로 계획-구현 정합성 확인됨.
- 제안: 없음.

---

## 요약

이번 변경의 핵심은 세 가지다: (1) `driveResumeDetached` → `driveResumeAwaited` rename, (2) `ProcessTurnResult` type alias 도입, (3) `InteractionTokenService` prod fail-closed 가드 + 단위테스트. rename 과 type alias 는 순수 리팩터링이라 기존 322개 unit 테스트가 그대로 유효하며 테스트 추가 불필요하다. 신규 가드 테스트는 prod throw / dev no-throw 두 핵심 케이스를 커버하지만, 같은 내용의 describe 블록이 두 상위 describe 에 중복 추가된 점이 단일 WARNING 이다 — 기능 오류는 없지만 유지보수 부담이 생기므로 통합 권장. `process.env` 캡처 타이밍 및 prod 에서 "partial secret" 케이스 미테스트는 현재 실사용 위험이 낮아 INFO 로 분류한다.

## 위험도

LOW
