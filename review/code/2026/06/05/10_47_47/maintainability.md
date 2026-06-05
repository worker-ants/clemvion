# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.ts

- **[INFO]** `CHECKPOINT_SCHEMA_VERSION` 상수와 `clampNodeErrorMessage` 함수 사이에 빈 줄이 없음
  - 위치: diff hunk `@@ -255,6 +255,16 @@` — 상수 선언 직후 줄
  - 상세: 상수 선언 블록(JSDoc + const)이 끝난 뒤 바로 `function clampNodeErrorMessage` 가 이어진다. 두 선언이 서로 다른 책임이므로 빈 줄 한 줄로 시각적 경계를 두는 것이 관례에 맞다. 기존 코드는 같은 파일 내 다른 top-level 상수/함수 쌍 사이에 빈 줄을 두는 패턴을 따르고 있어 일관성 차이가 생긴다.
  - 제안: `const CHECKPOINT_SCHEMA_VERSION = 1;` 뒤에 빈 줄 1개 추가.

- **[INFO]** `buildRetryReentryState` 내 방어적 기본값 블록 — 반복 패턴이 6회 인라인 반복됨
  - 위치: diff hunk `@@ -4141,17 +4166,22 @@` ~ `@@ -4163,6 +4193,28 @@`
  - 상세: `typeof resumeFields.X === 'number' ? resumeFields.X : 0` 패턴이 `turnCount`, `totalInputTokens`, `totalOutputTokens`, `totalThinkingTokens`, `toolCalls` 5개 숫자 필드에 걸쳐 반복된다. 현재는 5개이지만 필드가 추가될 때마다 동일 구조를 복사해야 해 실수 유발 가능성이 있다.
  - 제안: 내부 헬퍼 함수(`coerceNumber(v: unknown, def = 0): number`)를 추출하거나 단일 배열로 필드명을 열거해 reduce 로 처리하면 변경 범위가 한 곳으로 집약된다. 단, 현재 파일 규모와 성능 영향이 없는 수준이므로 INFO 등급.

- **[INFO]** 버전 가드 조건문 — `isAiConversation && resumeCheckpoint` 이중 조건 진입 후 내부에서 다시 `typeof ckptVersion === 'number'` 체크
  - 위치: diff hunk `@@ -1620,6 +1630,21 @@`
  - 상세: 논리 자체는 정확하나 조건 레이어가 2단 중첩(`if(isAiConversation && resumeCheckpoint)` → `if(typeof ckptVersion === 'number' && ckptVersion > CHECKPOINT_SCHEMA_VERSION)`)되어 있다. 단일 복합 조건으로 평탄화하거나, `ckptVersion` 타입 가드를 외부로 빼면 들여쓰기 깊이와 인지 부하를 줄일 수 있다.
  - 제안: 직접 영향을 주는 수준은 아니지만, 추후 버전 가드 조건이 늘어날 때를 대비해 early-return guard 패턴으로 정리하는 것이 읽기 좋다.

---

### 파일 2: execution-engine.service.spec.ts

- **[WARNING]** `CheckpointSubject` 타입 선언이 `describe` 블록 안에 중첩 정의됨
  - 위치: `describe('_resumeCheckpoint schemaVersion + 견고화 (PR-A2a)')` 내부, 라인 66~84
  - 상세: `CheckpointSubject` 는 `buildResumeCheckpoint` / `buildRetryReentryState` / `contextService` 세 멤버를 추상화하는 인터페이스다. 이 타입은 같은 파일 내 다른 describe 블록에서도 유사한 타입 단언(`service as unknown as {...}`)이 반복되고 있으며, 미래에 추가되는 checkpoint 관련 테스트도 재사용할 가능성이 높다. 현재는 하나의 `describe` 안에만 정의되어 있어 재사용이 불가하다.
  - 제안: 파일 최상위 스코프(`describe('ExecutionEngineService', ...)` 바로 안)로 끌어올려 재사용성을 높이거나, 기존 `getPendings` 헬퍼처럼 테스트 헬퍼 함수로 승격한다.

- **[WARNING]** `RESUME_INCOMPATIBLE_STATE` 통합 테스트 — `try/finally` 패턴으로 `waitForAiConversation` 를 직접 monkey-patch 후 복원
  - 위치: 라인 196~224 (통합 테스트 `'Multi-turn AI 노드 + _resumeCheckpoint schemaVersion 미래 버전 → RESUME_INCOMPATIBLE_STATE'`)
  - 상세: `svcAny.waitForAiConversation = jest.fn(...)` 으로 private 메서드를 런타임에 교체하고 `finally` 에서 `origWait` 로 복원하는 패턴은 이미 `jest.spyOn` 으로 동일한 목적을 달성할 수 있다. `jest.spyOn` 은 `mockRestore()` 로 원본 복원을 보장하고, 코드 의도도 더 명확하다. 현재 패턴은 `finally` 에서의 복원이 누락될 경우 후속 테스트에 side-effect 를 남길 위험이 있다.
  - 제안: `jest.spyOn(svcAny, 'waitForAiConversation').mockResolvedValue(undefined)` 로 교체하고 `afterEach` 또는 `spy.mockRestore()` 로 정리.

- **[INFO]** `cancelSetCalls` 추출 로직 — 인라인 복잡 체이닝
  - 위치: 라인 209~221
  - 상세: `mockExecutionRepo.createQueryBuilder.mock.results.flatMap(...)` → `.set?.mock?.calls` → `.map(...).filter(Boolean)` 로 이어지는 3단 체인이 한 표현식 안에 있어 디버깅 시 중간값을 확인하기 어렵다. 이 패턴은 다른 테스트(`recoverStuckExecutions` 등)에서도 유사하게 등장한다.
  - 제안: 중간 단계를 각각 변수로 분리하거나, 이 검증 패턴을 describe 스코프 헬퍼 함수로 추출하면 다른 `RESUME_*` 에러 코드 검증 시에도 재사용 가능하다.

- **[INFO]** 테스트 픽스처 ID — `'exec-a2a-1'`, `'exec-a2a-2'`, `'wf-1'`, `'node-1'` 등 테스트 로컬 문자열 상수가 직접 박힘
  - 위치: 라인 104~144 전반
  - 상세: 이 파일 전체에서 테스트 ID 문자열을 인라인으로 정의하는 관행은 이미 확립된 패턴이다(`executionId = 'execution-1'`, `workflowId = 'workflow-1'`). 신규 블록의 `'exec-a2a-1'` 등은 기존 패턴과 일치하므로 심각한 문제는 아니지만, 최상위 상수와의 혼용(`executionId` 재사용 vs. 로컬 리터럴)이 산발적으로 발생하고 있다. 향후 ID가 변경될 때 영향 범위 파악이 어려울 수 있다.
  - 제안: 현재 스코프에서는 일관성을 크게 해치지 않으므로 관찰 수준으로 기록. 테스트 전반의 픽스처 ID 관리 방식을 통일하는 리팩터링 시 같이 정리한다.

---

## 요약

이번 변경(`PR-A2a`)은 `CHECKPOINT_SCHEMA_VERSION` 상수 도입, 버전 가드 로직, 방어적 기본값 정규화라는 세 가지 기능적 책임을 명확히 분리해 구현했다. 네이밍은 코드베이스 관례를 준수하고 JSDoc 주석이 충분히 제공되어 가독성이 양호하다. 서비스 코드에서 상수 선언 후 빈 줄 누락이라는 사소한 일관성 문제와, 숫자 필드 방어적 기본값 패턴의 반복이 있으나 기능상 위험 수준은 아니다. 테스트 코드에서는 private 메서드를 직접 monkey-patch 하는 패턴이 `jest.spyOn` 으로 교체되면 복원 안전성과 가독성이 개선되며, `CheckpointSubject` 타입의 스코프 승격과 `cancelSetCalls` 검증 체인의 분리도 유지보수성을 높인다. 전체적으로 코드 품질은 양호하고 위험도는 낮다.

## 위험도

LOW
