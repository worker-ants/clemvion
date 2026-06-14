# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 모듈 로드 시 crypto randomBytes 즉시 실행 — DEV_EPHEMERAL_SECRET
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` 라인 922
- 상세: `const DEV_EPHEMERAL_SECRET = randomBytes(32).toString('hex');` 는 모듈 임포트 시점(클래스 인스턴스화 이전)에 즉시 실행된다. 이는 의도된 설계(주석에 명시)이고 프로세스 부트 시 1회만 실행되므로 실제 위험은 없다. 동일 프로세스에서 여러 `InteractionTokenService` 인스턴스가 생성되어도 모두 동일 ephemeral secret를 공유해 mint↔verify 라운드트립이 일관되게 동작한다. prod에서는 env secret 필수(fail-closed) 로직이 있어 이 값은 사용되지 않는다.
- 제안: 현행 설계 유지.

### [INFO] TERMINAL_REVOKE_RECONCILE_QUEUE 상수 이동 — 기존 직접 임포트 경로 소멸
- 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts` (상수 제거) → `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts` (신규 단일 진실)
- 상세: 상수 문자열 값 `'terminal-revoke-reconcile'` 은 동일하게 유지되므로 런타임 BullMQ 큐 이름에 변화 없다. diff 범위 내의 모든 소비자(모듈, spec, 테스트, system-status.constants)가 새 경로로 갱신되었다. `terminal-revoke-reconciler.service` 에서 직접 import하던 외부 파일이 diff 범위 밖에 잔존한다면 TypeScript 컴파일 에러가 발생하나, 이는 빌드 단계에서 감지된다.
- 제안: 빌드 통과 확인으로 충분. 수정 불필요.

### [INFO] interaction.controller.ts — Swagger 데코레이터 교체로 인한 OpenAPI 스키마 변경
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` 라인 64, 107, 130, 158
- 상세: `@ApiAcceptedResponse({ type: Dto })` / `@ApiOkResponse({ type: Dto })` 가 `@ApiAcceptedWrappedResponse(Dto)` / `@ApiOkWrappedResponse(Dto)` 로 교체되었다. 이 데코레이터는 Swagger 문서 생성만 제어하며, 런타임 HTTP 응답 직렬화(`InteractionService.*` 반환값)에는 영향을 주지 않는다. OpenAPI 스키마가 `Dto` → `{ data: Dto }` 래퍼 구조로 변경되므로, Swagger 스펙을 의존하는 SDK 자동 생성 클라이언트가 있을 경우 재생성이 필요하다.
- 제안: 실제 HTTP 응답 직렬화가 `{ data: ... }` 래퍼를 포함하는지 확인해 문서와 구현 일치 여부 검증 권장. 런타임 부작용은 없다.

### [INFO] 테스트 파일 내 makeService 함수 섀도잉 — 의도된 패턴
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts` 라인 208 vs 491
- 상세: 최상위 `makeService(redis?)` 와 `reconcileTerminalRevocations` describe 블록 내 로컬 `makeService(repo)` 가 동명으로 존재한다. 이는 기존 패턴이며 이번 diff가 도입한 것이 아니다. 새로 추가된 두 테스트 케이스(`batchLimit 하한`, `RECONCILE_CONCURRENCY(20) 초과`)는 블록 내 로컬 함수를 올바르게 사용한다. 상태 공유 부작용 없음.
- 제안: 수정 불필요.

## 요약

이번 변경은 부작용 관점에서 전반적으로 안전하다. 핵심 변경 세 가지 — (1) `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수를 전용 types 파일로 분리, (2) 하드코딩 fallback secret을 모듈 로드 시 1회 생성하는 ephemeral random으로 교체, (3) Swagger 데코레이터를 래핑 버전으로 교체 — 모두 런타임 큐 이름, JWT 시크릿 취득 로직, HTTP 응답 직렬화에 의도치 않은 변경을 가하지 않는다. `DEV_EPHEMERAL_SECRET`은 모듈 스코프 상수이나 prod 환경에서는 fail-closed 로직에 의해 진입하지 않는다. 환경 변수는 기존 패턴(`process.env.NODE_ENV`, `process.env.INTERACTION_JWT_SECRET`, `process.env.JWT_SECRET`)을 읽기만 하며 신규 env 쓰기는 없다. 네트워크 호출·파일시스템 부작용·이벤트 발생 변경은 없다.

## 위험도

LOW
