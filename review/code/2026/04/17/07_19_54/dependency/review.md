### 발견사항

- **[INFO]** `p-limit@^7.3.0` — ESM-only 패키지를 CJS 환경(Jest/ts-jest)에서 사용
  - 위치: `backend/package.json` → `transformIgnorePatterns`
  - 상세: `p-limit` v7.x와 내부 의존인 `yocto-queue`는 ESM-only입니다. 이를 위해 `transformIgnorePatterns`에 예외 추가가 필요해졌고, `moduleNameMapper`의 `.js` → 확장자 없음 매핑과 함께 동작합니다. 런타임(Node.js/NestJS)에서는 문제없지만 설정 복잡도가 증가합니다.
  - 제안: `p-limit@3.x` (CJS 지원)를 사용하면 `transformIgnorePatterns` 예외 없이 동작합니다. 또는 현재처럼 v7을 유지한다면 `@types/node`의 ESM interop 설정이 `tsconfig`에 명시되어 있는지 확인하세요.

- **[INFO]** `yocto-queue`가 `transformIgnorePatterns`에 직접 명시됨
  - 위치: `backend/package.json` L125
  - 상세: `p-limit`의 내부 의존성인 `yocto-queue`가 간접 의존임에도 Jest 설정에 직접 노출됩니다. 버전 업그레이드 시 추가 ESM-only 의존성이 생기면 패턴을 계속 추가해야 하는 유지보수 부담이 있습니다.
  - 제안: 패턴을 `node_modules/(?!(uuid|p-limit|yocto-queue)/)` 형태로 통합 관리하거나, `p-limit@3`으로 다운그레이드하여 근본 원인을 제거하세요.

- **[INFO]** `p-limit`은 실제 필요하며 적절히 사용됨
  - 위치: `parallel-executor.ts`
  - 상세: `maxConcurrency` 세마포어 구현에 `p-limit`은 합리적인 선택입니다. `Semaphore` 직접 구현 대비 검증된 라이브러리 활용이 적절합니다. 라이선스는 MIT입니다.

- **[INFO]** 내부 모듈 의존 관계는 적절함
  - 위치: `execution-engine.module.ts`
  - 상세: `ParallelExecutor`가 `@Injectable()`로 선언되어 NestJS DI에 올바르게 등록되었으며, 모듈의 `providers` 배열에도 포함되었습니다. `exports`에는 포함되지 않아 모듈 경계가 적절히 유지됩니다.

---

### 요약

이번 변경의 핵심 신규 외부 의존성은 `p-limit@^7.3.0`으로, MIT 라이선스의 경량 패키지입니다. 기능적으로 적합하나 ESM-only 특성으로 인해 Jest 설정에 두 개의 패키지명(`p-limit`, `yocto-queue`)이 예외로 추가되었습니다. 보안 취약점이나 버전 충돌 위험은 없으나, `p-limit@3.x` (CJS)로 교체하면 설정 복잡도를 줄이고 간접 의존성 노출 문제도 해소할 수 있습니다. 나머지 변경은 기존 의존성 범위 내에서 내부 모듈을 올바르게 연결한 것으로 의존성 관점의 이슈는 없습니다.

### 위험도

**LOW**