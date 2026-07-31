# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 새 외부 패키지 없음 — 기존 `typeorm`/`@nestjs/*` API 재사용
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:1-33` (import 블록)
  - 상세: 이번 변경(`RETRY_STATE_KEY` 상수화, `claimSpawnedRetryRow` 신규 private 메서드, `applyRetryLastTurn` 재배선)의 import 는 `@nestjs/common`, `@nestjs/typeorm`, `typeorm` 뿐이며 전부 이 파일에 이미 존재하던 의존성이다. 커밋 범위(`71ce6c12b..414550a1d`, 즉 b351731f0 + 414550a1d) 전체를 `git diff --stat`으로 확인한 결과 `package.json`/`pnpm-lock.yaml` 등 어떤 매니페스트 파일도 변경되지 않았다 — 신규 의존성 추가 0건. 신규 `claimSpawnedRetryRow` 의 원자 claim 로직도 별도 락 라이브러리(redis-lock, p-limit 등)를 들여오지 않고 기존 `nodeExecutionRepository.createQueryBuilder()` + raw JSONB 연산(`- 'key'`, `jsonb_exists`) 패턴을 재사용한다 — `retryLastTurn` 의 기존 atomic-consume, 그리고 JSDoc 이 언급하는 형제 continuation 4종(`claimResumeEntry` 계열)과 동일한 기존 사내 관용구다.
  - 제안: 해당 없음 (권장 관행 그대로 준수).

- **[WARNING]** CRITICAL #2 수정의 근거 서술이 caret 범위로 고정되지 않은 특정 패치 버전(`typeorm@0.3.30`)의 비계약적(undocumented) 내부 동작에 결속됨
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:392` (주석 "TypeORM 0.3.30 의 jsonb diff 가 DB 를 재-SELECT 해 옛 값과 비교하고…") 및 실제 수정 라인 `:396` (`delete spawnedRow.inputData[RETRY_STATE_KEY];`). 대조: `codebase/backend/package.json:88` (`"typeorm": "^0.3.28"`).
  - 상세: `pnpm-lock.yaml` 확인 결과 현재 해석된 버전은 정확히 `typeorm@0.3.30` 이라 주석의 버전 인용 자체는 지금 시점엔 정확하다. 그러나 `package.json` 은 이를 **caret 범위**(`^0.3.28`)로 선언하므로, 통상적인 `pnpm update`/lockfile 재생성만으로 0.3.x 상위 패치(0.3.31, 0.3.4x …)로 조용히 이동할 수 있고, 그 시점에 이 "jsonb diff 시 stale in-memory 값이 DB 재-SELECT 로 되살아난다" 는 TypeORM 내부 구현 디테일이 바뀌거나 사라질 수 있다 — 이 저장소 안에서 "TypeORM 0.3.30" 을 명시적으로 인용하는 곳은 이 한 줄뿐이다(`grep -rn "typeorm 0.3.30"` 신규). 다행히 실제 방어 코드(`delete spawnedRow.inputData[RETRY_STATE_KEY]`)는 그 특정 버그가 미래에 사라지더라도 여전히 안전한 일반 원칙(claim 이 DB 에서 지운 값은 in-memory 사본에도 반영해야 한다)을 구현하고 있어 **기능적으로 깨지지는 않는다** — 다만 주석이 근거를 "이 정확한 패치 버전의 알려진 결함" 으로 좁게 서술해 향후 typeorm 업그레이드 시 독자가 "이 delete 가 아직도 필요한가?" 를 오판할 여지를 남긴다. Dependency 관점에서는 (a) 정정 불변식이 특정 버전의 내부(비-public-API) 동작에 근거하고 있고, (b) 그 버전이 caret 범위라 향후 무인지 업그레이드가 가능하며, (c) 이 결속을 감지할 버전-체크나 회귀 테스트가 없다는 3가지가 겹친 것이 리스크다.
  - 제안: 필수 차단 사유는 아니나, 다음 중 하나를 권장: (1) 주석을 "TypeORM 0.3.30 기준 확인됨, 이후 버전에서도 이 delete 는 안전을 위해 유지" 식으로 버전-불문 방어임을 명확히 하거나, (2) typeorm 업그레이드 체크리스트/CHANGELOG 에 "jsonb diff 관련 관찰을 재검증" 항목을 남겨 향후 마이그레이션 시 놓치지 않게 한다. 코드 변경은 불필요.

- **[INFO]** 신규 `claimSpawnedRetryRow` 는 기존 유사 claim 계열과 로직이 수렴하지만 공유 헬퍼로 통합되지 않음 — 의도된 결정으로 판단, 조치 불요
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:520-534` (`claimSpawnedRetryRow`)
  - 상세: 이 메서드의 JSDoc(주변 컨텍스트, `:471` 부근)이 스스로 "형제 continuation 4종(`claimResumeEntry`)이 이미 같은 성질을 수용" 한다고 명시한다. 즉 프로젝트 내에 조건부 UPDATE 기반 원자 claim 패턴이 이미 최소 4곳 더 존재하고, 이번 PR 이 5번째 사례를 추가한 셈이다. 제네릭 claim 헬퍼로 뽑아내는 리팩토링은 하지 않았다 — 이는 과거 결정(리뷰 이력의 reaper/engine DRY 리팩토링에서 "진짜 동일 보일러플레이트만 추출, axes 발산 시 full-unification 은 defer")과 일치하는 선택이며, 이번 PR 자체가 CRITICAL 버그 수정이라 스코프 확장(제네릭화)을 미루는 것이 합리적이다. 새 결함은 아님.
  - 제안: 없음 — 필요 시 별도 후속 plan 항목으로만 고려(현재 등재 요구 없음).

- **[INFO]** `RETRY_STATE_KEY` 상수는 파일-scope private — 프로젝트 전역 SSOT 는 아니지만 PR 이 명시한 스코프와 일치
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42`
  - 상세: `_retryState` 리터럴은 이 파일 밖에도 최소 12개 파일(예: `ai-turn-orchestrator.service.ts`, `continuation/continuation-execution.processor.ts`, `execution-engine.service.ts`, `utils/resume-state.schema.ts`, `websocket/websocket.gateway.ts` 등)에 문자열로 남아 있다. `RETRY_STATE_KEY` 는 `export` 되지 않아 이 파일 내부(4곳 이상 중복 — JSDoc 자체가 명시한 스코프)만 SSOT 화한다. JSDoc 이 애초에 "raw SQL … 과 TS 프로퍼티 접근에 리터럴로 4곳 이상 중복" 이라고 스코프를 이 파일로 한정해 서술하므로 이는 갭이 아니라 의도된 범위다 — 다만 프로젝트 전체로 봤을 때 동일 리터럴이 여전히 여러 모듈에 흩어져 있다는 사실 자체는 남는다(내부 의존성 관찰 사항으로만 기록, 이번 PR 의 결함은 아님).
  - 제안: 없음 — 프로젝트 전역 통합이 필요하다고 판단되면 별도 plan 항목으로.

- **[INFO]** 내부 모듈 의존 관계 — 신규 순환 DI 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 클래스 전체(생성자는 diff 범위 밖, 미변경)
  - 상세: `AiTurnOrchestrator` 에 대한 `forwardRef` 순환 주입, `ENGINE_DRIVER`(`RetryEngineDriver` ISP slice) 주입은 모두 이번 diff 이전부터 존재하던 배선이며 이번 두 커밋에서 생성자·인터페이스(`engine-driver.interface.ts`)는 변경되지 않았다. 신규 `claimSpawnedRetryRow` 는 이미 주입된 `nodeExecutionRepository` 만 사용하므로 새로운 모듈 간 의존 엣지를 추가하지 않는다.
  - 제안: 없음.

## 요약

이번 변경(#10 동반 PR + 후속 2차 claim 삽입 위치 수정)은 `package.json`/lockfile 을 전혀 건드리지 않는 순수 애플리케이션 로직 수정으로, 신규 외부 의존성·라이선스·취약점·번들 크기 이슈는 없다. 유일하게 주목할 지점은 CRITICAL #2 수정 근거가 "TypeORM 0.3.30" 이라는 특정 패치 버전의 비공개 내부(jsonb diff) 동작을 명시적으로 인용하는데, `package.json` 은 이를 caret 범위(`^0.3.28`)로만 고정해 향후 무인지 마이너/패치 업그레이드 시 그 근거 서술이 stale 해질 여지가 있다는 것이다(실제 방어 코드는 버전 불문 안전하므로 기능적 회귀 위험은 낮음). 그 외 내부 의존성 측면에서는 기존 sibling claim 패턴·기존 driver 인터페이스를 그대로 재사용해 신규 결합을 만들지 않았고, `RETRY_STATE_KEY` 상수화는 파일 내부 리터럴 drift 리스크를 줄이는 긍정적 변화다.

## 위험도
LOW
