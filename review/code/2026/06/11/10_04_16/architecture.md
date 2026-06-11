# Architecture Review — prod-fail-closed-guards

## 발견사항

### **[INFO]** 단일 책임 원칙 — `production-guards.ts` 순수 함수 추출
- **위치**: `codebase/backend/src/common/config/production-guards.ts` 전체
- **상세**: `assertProductionConfig`가 순수 함수(env 맵 주입)로 분리되어 기존 `main.ts` 인라인 가드 로직을 응집했다. 부팅 진입점(`main.ts`)이 보안 검증 로직을 직접 보유하지 않고 위임하는 구조로 단일 책임 원칙을 잘 따른다.
- **제안**: 현상 유지. 변경 없이 양호.

### **[INFO]** 개방-폐쇄 원칙 — 가드 확장 구조
- **위치**: `production-guards.ts` L629-702
- **상세**: 신규 금지 플래그를 추가할 때 `assertProductionConfig` 함수 본문을 직접 수정해야 한다. 플래그가 소수이고 성격(fail-closed)이 동질적이어서 현 단계에서는 수용 범위다. 다만 플래그 종류가 늘어나면 Strategy/Registry 패턴으로 각 가드를 독립 규칙 객체로 등록하는 설계로 전환을 고려할 수 있다.
- **제안**: 현 규모에서는 INFO 수준. 가드가 7개 이상으로 증가하는 시점에 리팩터링 검토.

### **[INFO]** 의존성 역전 원칙 — 환경변수 맵 주입
- **위치**: `production-guards.ts` L654 `assertProductionConfig(env: NodeJS.ProcessEnv = process.env)`
- **상세**: 함수가 `process.env` 전역에 직접 결합하지 않고 기본값을 가진 파라미터로 외부 주입을 허용한다. 이는 테스트에서 전 분기를 격리된 env 맵으로 검증할 수 있도록 하며 DIP의 실용적 적용이다.
- **제안**: 현상 유지.

### **[INFO]** 레이어 책임 분리 — bootstrap vs. 비즈니스 로직
- **위치**: `main.ts` L902-919 (bootstrap 함수 내 `assertProductionConfig` 호출 + `ALLOW_PRIVATE_HOST_TARGETS` warn 블록)
- **상세**: 보안 부팅 가드(fail-closed)는 `production-guards.ts`로 위임하고, "warn 수준 정책"(`ALLOW_PRIVATE_HOST_TARGETS`)은 의도적으로 `main.ts`에 잔류시킨다. 정책 분류 기준(절대 금지 → throw, 정당 용도 있음 → warn)이 spec과 주석에 일관되게 명시되어 있어 레이어 책임 경계가 명확하다.
- **제안**: 현상 유지. warn 로직이 향후 여러 플래그로 증가한다면 `ALLOW_PRIVATE_HOST_TARGETS` warn도 `production-guards.ts` 내 별도 `warnProductionFlags(env, logger)` 함수로 추출하는 것을 고려할 수 있다.

### **[WARNING]** 단일 함수 내 두 가지 정책 혼재 — `assertProductionConfig`가 "throw 정책"만 담당해야 하는 경계가 암묵적
- **위치**: `production-guards.ts` + `main.ts` L908-919
- **상세**: `MCP_ALLOW_INSECURE_URL`(throw)과 `ALLOW_PRIVATE_HOST_TARGETS`(warn)은 동일 레이어(production 보안 가드)에 속하지만 정책이 달라 한쪽은 `production-guards.ts`에, 다른 한쪽은 `main.ts`에 분리되어 있다. 이 분리는 의도적이며 spec이 명시하지만, 추후 유지보수자가 새 플래그를 추가할 때 "어느 파일에 넣어야 하는가"의 경계가 코드 레벨에서 명확하지 않다. `production-guards.ts` 모듈 자체가 "throw 전용"임을 문서/타입 수준에서 강제하는 장치가 없다.
- **제안**: `production-guards.ts` 모듈 상단 주석에 "본 모듈은 throw 정책(fail-closed) 전용. warn 정책은 호출자(main.ts) 책임" 한 줄을 명시해 경계를 자기서술화한다. 코드 변경 없이 주석 한 줄로 해결 가능.

### **[INFO]** 모듈 응집도 — `INSECURE_JWT_SECRETS`, `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 상수 공개 export
- **위치**: `production-guards.ts` L629-643, `production-guards.spec.ts` L389-390
- **상세**: 두 상수를 `export`하여 테스트가 같은 값 집합으로 검증할 수 있도록 했다. 이는 테스트와 구현이 동일 source of truth를 공유해 허위 통과를 방지하는 좋은 응집 설계다. 다른 모듈이 이 상수에 의존하게 되면 의도치 않은 결합이 생길 수 있으나, 현재는 test 전용 용도이므로 문제없다.
- **제안**: 현상 유지.

### **[INFO]** 순환 의존성 없음
- **위치**: `production-guards.ts` → 의존 없음; `main.ts` → `production-guards.ts` (단방향)
- **상세**: `production-guards.ts`는 외부 모듈 의존이 전혀 없는 리프 모듈이다. `main.ts`에서 단방향으로 import하며, NestJS AppModule 초기화 이전에 호출되므로 DI 컨테이너 순환 위험도 없다.
- **제안**: 현상 유지.

### **[INFO]** 확장성 — 신규 예시 키 추가 경로
- **위치**: `production-guards.ts` L638-643 `KNOWN_EXAMPLE_ENCRYPTION_KEYS`
- **상세**: `.env.example` 플레이스홀더가 변경될 때마다 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set에 구 예시 키를 보존하는 패턴(옛 `0123…` 키도 현재 포함됨)은 배포 중인 구버전 설정의 운영 사고를 차단하는 실용적 설계다. 단, 이 Set이 무한정 증가하는 구조이므로 "언제까지 보관할 것인가"에 대한 정책이 없다.
- **제안**: 주석에 "각 항목에 'deprecated since YYYY-MM' 형식으로 삭제 예정일 기재" 컨벤션을 추가하면 후속 정리 시점을 명확히 할 수 있다. 현재 항목이 2개로 적어 INFO 수준.

### **[INFO]** `isFlagOn` 헬퍼 — 미공개 로컬 함수의 적절한 추상화 수준
- **위치**: `production-guards.ts` L645-647
- **상세**: `'true' | '1'` 두 값을 처리하는 단일 목적 헬퍼가 모듈 내부에 비공개(export 없음)로 존재한다. OAUTH/LLM/MCP 가드 3곳에 중복 없이 재사용되며 과도한 추상화나 부족한 추상화 없이 적절한 레벨이다.
- **제안**: 현상 유지.

### **[INFO]** `.env.example` placeholder 변경 — 아키텍처적 함의
- **위치**: `.env.example` diff (ENCRYPTION_KEY `0123…` → `0000…`)
- **상세**: 플레이스홀더를 변경하면 구 값을 `KNOWN_EXAMPLE_ENCRYPTION_KEYS`에 보존하지 않으면 구 값으로 운영 중인 배포가 부팅 가드를 통과해버리는 회귀가 생긴다. 본 PR은 구 값(`0123…`)을 Set에 유지해 이 위험을 올바르게 처리한다. 플레이스홀더-가드 Set 간 동기화 의무가 암묵적이다.
- **제안**: `production-guards.ts` 주석에 ".env.example 플레이스홀더 변경 시 구 값을 이 Set에 추가할 의무"를 명시하거나, KNOWN_EXAMPLE_ENCRYPTION_KEYS 항목에 출처 파일과 변경 날짜를 주석으로 기재해 추적성을 높인다.

---

## 요약

본 PR은 분산되어 있던 production fail-closed 가드를 `production-guards.ts` 단일 순수 함수로 응집하고 `main.ts` bootstrap에서 1회 호출하는 구조로 리팩터링했다. SOLID 관점에서 단일 책임·의존성 역전이 잘 적용되었으며, 순수 함수 설계로 전 분기의 단위 테스트 커버리지가 확보되었다. 모듈 경계도 명확하고 순환 의존성이 없다. 주요 주의사항은 두 가지다: (1) "throw 정책 전용" vs "warn 정책은 호출자 담당"이라는 경계가 주석 수준에서만 암묵적이므로 자기서술화가 필요하고, (2) `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set과 `.env.example` 플레이스홀더 간의 동기화 의무가 코드 레벨에서 강제되지 않는다. 두 사항 모두 간단한 주석 추가로 해결 가능한 수준이며 설계 자체의 결함은 없다.

---

## 위험도

LOW
