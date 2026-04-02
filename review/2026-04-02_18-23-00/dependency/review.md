### 발견사항

- **[INFO]** 내부 로컬 패키지 `@workflow/expression-engine` 추가
  - 위치: `backend/package.json`, `frontend/package.json`
  - 상세: `file:../packages/expression-engine` 로컬 경로 참조. monorepo 공유 패키지로 프론트엔드·백엔드 양쪽에 동시 추가됨. 스펙(`8.2`)의 설계 의도에 부합하는 구조.
  - 제안: 이상 없음.

- **[WARNING]** `expression-engine` 패키지의 `dayjs` 버전이 backend 직접 의존성과 상이
  - 위치: `../packages/expression-engine` → `dayjs: ^1.11.13`, `backend/package.json` → `dayjs: ^1.11.20`
  - 상세: 두 위치에 `dayjs`가 중복 설치될 수 있으며, 최소 요구 버전이 다름. npm workspace를 사용하지 않는 구조에서는 동일 패키지가 두 번 번들링될 가능성이 있음.
  - 제안: `packages/expression-engine`의 `dayjs`를 `^1.11.20`으로 맞추거나, workspace hoist 설정을 통해 단일 인스턴스를 보장.

- **[WARNING]** `frontend/package.json` 빌드 스크립트에 `--webpack` 플래그 추가
  - 위치: `frontend/package.json` → `"build": "next build --webpack"`
  - 상세: Next.js 15+에서 `--webpack`은 Turbopack 비활성화 플래그로, `transpilePackages`가 로컬 패키지에서 동작하지 않아 추가된 것으로 보임. 이는 근본 원인 해결이 아닌 우회(workaround)이며, 향후 Turbopack 지원 시 제거가 필요한 기술 부채.
  - 제안: 로컬 패키지의 `main`/`exports` 필드 또는 `tsconfig.json` 설정을 확인하여 Turbopack과도 호환되도록 수정 후 플래그 제거 검토.

- **[INFO]** `expression-engine` devDependencies의 `@types/jest: ^30.0.0` — 패키지 내 독립 jest 설정
  - 위치: `../packages/expression-engine` devDependencies
  - 상세: 로컬 패키지가 자체 jest + ts-jest 설정을 가짐. monorepo 루트 테스트 파이프라인에 포함되지 않으면 CI에서 누락될 수 있음.
  - 제안: 루트 `package.json` 또는 CI 스크립트에 `packages/expression-engine`의 테스트 실행을 포함시킬 것.

- **[INFO]** `ExpressionResolverService`에서 `Logger` 인스턴스 선언 후 미사용
  - 위치: `expression-resolver.service.ts:15`
  - 상세: `private readonly logger = new Logger(...)` 선언되었으나 서비스 어디에도 `this.logger`를 호출하지 않음. 의존성 관점에서 `@nestjs/common`의 `Logger` import가 실질적으로 불필요.
  - 제안: 로깅이 필요한 시점(표현식 에러 캐치, 디버그)에 실제 사용하거나, 사용 전까지 선언 제거.

- **[INFO]** `resolveString`의 full-expression 분기 논리 버그 (기능 이슈이나 의존성 API 사용 관련)
  - 위치: `expression-resolver.service.ts:149–155`
  - 상세: `FULL_EXPRESSION_PATTERN` 체크 분기가 있으나, `evaluate()`가 이미 mixed-text에서 string interpolation을 수행하면 분기 결과가 동일함. `evaluate()` API가 mixed-text에서 string을 반환하는지, 아니면 마지막 표현식 값만 반환하는지에 따라 결과가 달라짐. `@workflow/expression-engine`의 `evaluate()` 계약(contract)을 명확히 문서화하거나 테스트에서 검증 필요.
  - 제안: `evaluate()`가 full-expression과 mixed-text를 동일하게 처리한다면 `FULL_EXPRESSION_PATTERN` 분기를 제거. 다르게 처리한다면 현재 코드에서 두 분기 모두 `return result`로 동일한 처리를 하고 있으므로 실제 타입 보존 로직이 누락된 것. `evaluate()` 반환 타입을 이용하여 분기 처리를 수정할 것.

---

### 요약

이번 변경의 핵심은 `@workflow/expression-engine` 로컬 패키지를 백엔드·프론트엔드 양쪽에 공유 의존성으로 추가한 것으로, 스펙에 정의된 공유 파서/평가기 설계와 일치하는 적절한 구조입니다. Critical 수준의 문제는 없으나, `dayjs` 버전 불일치로 인한 중복 번들링 가능성, Turbopack 비호환 우회를 위한 `--webpack` 플래그로 인한 빌드 성능 저하, 그리고 `expression-engine` 자체 테스트의 CI 누락 가능성이 Warning 수준의 리스크로 존재합니다. 또한 `ExpressionResolverService`의 `Logger` 미사용 및 `resolveString` full-expression 분기 중복 처리는 코드 품질 측면에서 정리가 필요합니다.

### 위험도

**LOW**