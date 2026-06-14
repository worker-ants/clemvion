# Testing Review — EIA Follow-up Code Quality

## 발견사항

### [INFO] interaction-token.service.spec.ts — 새 테스트 3건 추가, 커버리지 갭 충실히 보강
- 위치: `interaction-token.service.spec.ts` lines 137–178
- 상세:
  - `batchLimit 하한 — 0/음수는 1 로 clamp` 테스트: 경계값(0 입력)이 1로 clamp되는지 검증. 올바른 엣지 케이스 보강.
  - `RECONCILE_CONCURRENCY(20) 초과 — 다중 청크 전부 처리·집계 정확` 테스트: 25건 데이터로 청크(20+5) 경계에서 집계가 누락되지 않음을 검증. 다중 청크 경로가 기존에 테스트되지 않았으므로 유의미한 커버리지 추가.
  - `만료 토큰이라도 execution_token row 는 정리한다` assertion 추가: `repo.delete` 호출 여부를 만료 토큰 경로에서도 확인. 기존 테스트가 `revoked` 집계만 검증하고 DB 정리 여부는 미검증이었던 갭을 채움.
- 제안: 이 추가는 적절하며 별도 조치 불필요.

### [INFO] terminal-revoke-reconciler.service.spec.ts — opts 필드 검증 강화
- 위치: `terminal-revoke-reconciler.service.spec.ts` diff lines +38~+48
- 상세: 기존 테스트는 `upsertJobScheduler` 3번째 인자의 `name` 만 검증. 변경 후 `opts.removeOnComplete.age`, `opts.removeOnFail.age` 도 함께 검증하여 job 보존 정책(24h/7d)이 실제로 설정되는지 확인. 이는 운영 환경에서 중요한 설정이므로 회귀 방지 효과가 있다.
- 제안: 적절한 강화. 특이사항 없음.

### [INFO] terminal-revoke-reconciler.types.ts — 상수 분리 자체는 테스트 대상 아님
- 위치: `terminal-revoke-reconciler.types.ts` (신규 파일)
- 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 별도 types 파일로 분리. 타입/상수만 포함하므로 단독 테스트 불필요. `terminal-revoke-reconciler.service.spec.ts`가 이 파일에서 import해 기존 테스트가 변경 없이 통과하는 것을 확인.
- 제안: 없음.

### [INFO] interaction.controller.ts — Swagger 데코레이터 변경에 대한 컨트롤러 테스트 영향
- 위치: `interaction.controller.ts` (4개 엔드포인트의 Swagger 데코레이터 교체)
- 상세: `@ApiAcceptedResponse({ type: ... })` → `@ApiAcceptedWrappedResponse(...)`, `@ApiOkResponse({ type: ... })` → `@ApiOkWrappedResponse(...)` 로 교체. 런타임 동작에는 영향 없음. Swagger 스키마 생성만 변경. `interaction.controller.spec.ts`의 기존 테스트는 서비스 위임과 request 처리를 검증하므로 영향 없이 유효.
- 제안: `api-wrapped.spec.ts`에 `ApiAcceptedWrappedResponse`와 `ApiOkWrappedResponse` decorator 함수 자체에 대한 통합 테스트가 없다. 이 두 함수는 스키마 빌더(이미 테스트됨)를 감싸는 단순 래퍼이므로 현재 INFO 수준이나, 컨트롤러에서 `ApiExtraModels`가 올바르게 등록되는지 e2e에서 Swagger 스펙을 검증하면 더 안전하다.

### [INFO] DEV_EPHEMERAL_SECRET 도입에 대한 테스트 호환성
- 위치: `interaction-token.service.ts` line 849 + `interaction-token.service.spec.ts`
- 상세: 기존 `'interaction-fallback'` 고정 fallback secret 이 `randomBytes(32).toString('hex')` ephemeral로 교체. 기존 spec은 모두 `TEST_SECRET`을 ConfigService mock으로 명시 주입하므로 DEV_EPHEMERAL_SECRET 경로를 타지 않아 영향 없음. `constructor — secret 미설정 시 prod fail-closed` describe 블록은 `noSecretConfig`(get이 undefined 반환)를 사용하지만, `process.env.NODE_ENV = 'test'` 케이스에서는 throw 없이 인스턴스 생성만 확인하며 실제 토큰 발급/검증은 하지 않는다 — ephemeral secret이 쓰이는 경로는 별도 테스트가 없다.
- 제안: `NODE_ENV != production` + secret 미설정 시 ephemeral secret으로 mint↔verify 라운드트립이 성공하는지 검증하는 테스트를 추가하면 fallback 경로의 기능 보증이 된다. 현재는 생성자가 throw 안 함만 검증. 위험도는 낮음(dev/test 전용 경로).

### [INFO] `external-interaction.module.ts` 변경에 대한 모듈 테스트 부재
- 위치: `external-interaction.module.ts` diff (import 경로 변경)
- 상세: `TERMINAL_REVOKE_RECONCILE_QUEUE` import 경로만 변경(`terminal-revoke-reconciler.service` → `terminal-revoke-reconciler.types`). 동작 변경 없음. 모듈 레벨 통합 테스트 파일은 없으나, NestJS 모듈 메타데이터 변경은 컴파일 타임에 TypeScript가 잡고, 런타임 연결은 e2e가 커버하므로 별도 단위 테스트 불필요.
- 제안: 없음.

### [INFO] `system-status.constants.ts` import 경로 변경 — 기존 테스트 영향
- 위치: `system-status.constants.ts` line 7 (diff)
- 상세: `system-status` 관련 e2e spec (`test/system-status.e2e-spec.ts`)이 주석으로 언급됨. `TERMINAL_REVOKE_RECONCILE_QUEUE`의 값(`'terminal-revoke-reconcile'`)은 변경되지 않으므로 `EXPECTED_QUEUE_NAMES` 목록과 일치는 유지됨. 기존 e2e 회귀 없음.
- 제안: 없음.

## 요약

이번 변경의 테스트 커버리지는 전반적으로 양호하다. 핵심 비즈니스 로직인 `reconcileTerminalRevocations`의 다중 청크 처리, batchLimit 하한 clamp, 만료 토큰 행 정리 세 가지 갭이 새 테스트로 채워졌다. `TerminalRevokeReconcilerService` 테스트도 job 보존 정책 설정값까지 검증하도록 강화되었다. 주요 리팩터(상수 파일 분리, Swagger 데코레이터 교체)는 런타임 동작 불변이며 기존 테스트가 유효하다. 다만 DEV_EPHEMERAL_SECRET fallback 경로의 mint↔verify 라운드트립과 `ApiAcceptedWrappedResponse`/`ApiOkWrappedResponse` 데코레이터 자체의 Swagger 스키마 검증은 테스트되지 않으나 모두 낮은 위험도다.

## 위험도

LOW
