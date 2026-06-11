# Architecture Review

## 발견사항

### [INFO] 단일 책임 원칙 — production-guards.ts 책임 분리가 명확함
- 위치: `codebase/backend/src/common/config/production-guards.ts`
- 상세: `assertProductionConfig` 는 "NODE_ENV=production 에서 절대 금지 항목만 throw" 라는 단일 정책을 담당한다. warn-only 정책(`ALLOW_PRIVATE_HOST_TARGETS`)은 명시적으로 `main.ts` 로 분리했고, 그 결정 기준("throw 면 여기, warn 이면 main.ts")이 JSDoc 에 명문화되어 있다. 이는 SRP 를 잘 준수한 설계다.
- 제안: 없음 (현재 상태 유지 권장).

### [INFO] 개방-폐쇄 원칙 — 신규 가드 추가 경로가 열려 있으나 수동 동기화 부담 존재
- 위치: `production-guards.ts`, `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS`
- 상세: 신규 절대-금지 플래그는 `assertProductionConfig` 함수 본문에 if-블록을 추가해야 하고, 신규 example 키는 `Set` 에 수동 추가해야 한다. 현재는 함수 크기가 작아 유지 가능하지만, 검사 항목이 늘어날수록 함수 내부가 비대해지는 구조다. "동기화 의무" 가 주석으로만 표현되어 있어 코드 내 자동 보장이 없다.
- 제안: 즉각 변경 불필요. 검사 항목이 10개를 넘어설 시점에 `GuardRule[]` 배열로 선언적 리팩토링을 검토한다.

### [INFO] 의존성 역전 — 순수 함수로 분리해 테스트 주입 가능
- 위치: `production-guards.ts` L704, `production-guards.spec.ts`
- 상세: `assertProductionConfig(env: NodeJS.ProcessEnv = process.env)` 시그니처가 의존성(`process.env`)을 외부에서 주입할 수 있도록 설계되었다. spec 파일이 `prodEnv()` 헬퍼로 다양한 env 맵을 주입해 전 분기를 검증한다. DIP 관점에서 올바른 패턴이다.
- 제안: 없음.

### [INFO] 레이어 책임 — main.ts 가 bootstrap 외 warn 정책을 inline 으로 소유
- 위치: `codebase/backend/src/main.ts` (ALLOW_PRIVATE_HOST_TARGETS warn 블록)
- 상세: `ALLOW_PRIVATE_HOST_TARGETS` warn 정책이 `main.ts` 에 직접 if-블록으로 위치한다. 이는 의도된 분리 기준("warn 이면 main.ts")이므로 현재 규모에서는 문제가 없다. 그러나 warn-only 가드가 3개 이상으로 늘어날 경우 `main.ts` 가 부트스트랩 외 정책 판단 책임을 혼합하게 된다.
- 제안: warn-only 가드가 복수화될 때 `warnProductionConfig(env, logger)` 를 `production-guards.ts` 에 추가하거나 별도 파일로 분리하는 방향을 고려한다.

### [INFO] 디자인 패턴 — fail-fast 단계적 에러 vs. 모아서 throw 트레이드오프
- 위치: `production-guards.ts` L711 (`fail` 내부 closure)
- 상세: 첫 위반에서 즉시 throw 하는 fail-fast 방식이다. 주석에서 의도를 설명하고 있다("운영자는 한 건씩 고치며 재부팅"). 이는 부팅 거부가 목적인 가드에서 합리적인 선택이다. 다만 운영자가 여러 항목을 동시에 고쳐야 할 때 반복 재부팅이 필요하다.
- 제안: 현재 검사 항목이 5개로 적어 fail-fast 가 적합하다. 항목이 많아지면 모든 위반을 모아 한 번에 throw 하는 방식으로 전환을 고려할 수 있으나, 현재 규모에서는 변경 불필요.

### [INFO] 모듈 경계 — INTERACTION_JWT_SECRET 가드가 이 모듈 밖에 존재
- 위치: `production-guards.ts` 모듈 주석, `src/modules/external-interaction/interaction-token.service.ts`
- 상세: JSDoc 에서 `INTERACTION_JWT_SECRET` 의 fail-closed 는 "동형이나 별도 서비스 생성자 throw 로 유지" 라고 명시되어 있다. 동일 정책(production fail-closed)이 두 위치에 분산되어 있어 미래 수정 시 두 곳을 함께 변경해야 하는 암묵적 결합이 있다.
- 제안: `INTERACTION_JWT_SECRET` 검사를 `assertProductionConfig` 로 통합하는 것이 일관성 측면에서 더 명확하다. 단, 해당 서비스 생성자에서 inject 받는 설계와의 호환성을 먼저 검토해야 한다. 즉각 변경은 불필요하나 향후 가드 확장 시 통합 여부를 재검토할 것을 권장한다.

### [INFO] 확장성 — example 키 Set 의 append-only 정책이 명문화됨
- 위치: `production-guards.ts` L683–691 (`KNOWN_EXAMPLE_ENCRYPTION_KEYS` JSDoc)
- 상세: "옛 값을 이 Set 에서 제거하지 말고 새 placeholder 를 추가한다" 는 정책이 주석으로 명시되어 있어 운영 중인 배포도 계속 차단한다. append-only 방식이 누락 위험을 방지하는 좋은 설계다. `INSECURE_JWT_SECRETS` 도 동일 패턴을 따른다.
- 제안: 없음.

### [INFO] 순환 의존성 없음
- 위치: 전체 변경 파일
- 상세: `production-guards.ts` 는 Node.js 내장 타입(`NodeJS.ProcessEnv`)만 사용하며 NestJS DI 컨테이너나 다른 모듈을 import 하지 않는다. `main.ts` 가 이를 import 하는 단방향 의존만 존재한다. 순환 참조 없음.
- 제안: 없음.

### [INFO] 추상화 수준 — isFlagOn 헬퍼 모듈 비공개가 적절함
- 위치: `production-guards.ts` L695–697
- 상세: `isFlagOn` 은 모듈 내부 private 함수로 정의되어 외부에 노출되지 않는다. `.env` 불리언 토글 파싱 규칙('true'/'1' 만 ON)을 한 곳에 캡슐화한 것은 적절한 추상화 수준이다. 단, 동일 규칙이 코드베이스 다른 곳에서도 필요해질 경우 공용 유틸로 승격할 수 있다.
- 제안: 현재 사용처가 이 모듈 하나이므로 비공개 유지가 적절하다.

---

## 요약

이번 변경은 기존에 `main.ts` 에 인라인으로 흩어져 있던 production 부팅 가드를 `common/config/production-guards.ts` 단일 순수 함수로 응집한 리팩토링이다. SRP, DIP, 모듈 경계 분리 모두 의도적이고 명시적으로 설계되어 있으며, throw-vs-warn 정책 기준이 JSDoc 에 문서화되어 확장 시 일관성을 유지할 수 있다. 주요 아키텍처 약점은 `INTERACTION_JWT_SECRET` fail-closed 가 별도 서비스 생성자에 남아 있어 동일 정책이 두 곳에 분산된 점과, warn-only 가드가 복수화될 때 `main.ts` 에 정책 판단 코드가 누적될 수 있다는 점이나, 두 사안 모두 현재 규모에서 즉각 개선이 필요한 수준은 아니다. 전반적으로 간결하고 테스트 가능한 구조이며, 장기적으로 가드 항목이 늘어날 때 선언적 규칙 배열 방식으로 전환 가능한 여지를 남겨 두었다.

## 위험도

LOW
