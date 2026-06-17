# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/4-execution-engine.md` (impl-done diff, origin/main 기준)
도입 신규 식별자: `WORKFLOW_EXECUTOR` (DI 토큰 상수), `NodeBootstrapService` (NestJS 서비스 클래스), `node-bootstrap.service.ts` (파일 경로)

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** `C-1`, `m-3` ID 가 여러 refactor 파일에서 각각 다른 의미로 중복 사용
  - target 신규 식별자: diff 주석 내 `C-1 step1 (m-3)` 참조 — `02-architecture.md` 의 C-1(ExecutionEngineService god-class 분할)·m-3(bootstrap 이동)을 지칭
  - 기존 사용처:
    - `plan/in-progress/refactor/04-security.md:11` — C-1 = "JWT secret 기본값 fallback"
    - `plan/in-progress/refactor/05-database.md:14` — C-1 = "refresh 토큰 rotation 비원자성"
    - `plan/in-progress/refactor/06-concurrency.md:11` — C-1 = "cancelWaitingExecution fire-and-forget"
    - `plan/in-progress/refactor/07-dependency.md:10` — C-1 = "jsonwebtoken devDependencies 분류 오류"
    - `plan/in-progress/refactor/03-maintainability.md:20` — C-1 = "execution-engine.service.ts god-class"
    - `plan/in-progress/refactor/04-security.md:360`, `06-concurrency.md:284` — m-3 도 각각 다른 의미
  - 상세: ID 는 파일 내 로컬 네임스페이스이므로 실제 코드 식별자 충돌은 없다. 단, diff 주석의 `C-1 step1 (m-3)` 표현이 독자에게 어느 파일의 항목인지 즉시 불명확할 수 있다. 파일 경로 없이 인용하면 혼동 가능.
  - 제안: 주석에 파일을 명시하거나(`02-architecture.md C-1 / m-3`) 현재 상태 유지 모두 가능. 코드 동작에는 무영향.

---

### 2. 엔티티/타입명 충돌

- **[INFO]** `NodeBootstrapService` 파일 위치가 plan 기술과 다름
  - target 신규 식별자: `NodeBootstrapService` — `/modules/execution-engine/node-bootstrap.service.ts` 에 배치
  - 기존 사용처(plan): `plan/in-progress/refactor/02-architecture.md:401` — "nodes 모듈에 `NodeBootstrapService`(`OnModuleInit`) — bootstrap 호출 이관"
  - 상세: plan 은 `nodes.module.ts` 의 `NodesModule` 안에 두는 것을 명시("nodes 모듈에")했으나, 구현은 `ExecutionEngineModule`(`modules/execution-engine/`) 내부에 배치했다. 클래스명 자체의 충돌은 없고 기존 사용 중인 `BootstrapService` 패턴도 없다. 위치 차이는 forwardRef 해소 방식의 설계 변경을 의미할 수 있다(`ExecutionEngineModule`이 `NodeBootstrapService`를 소유하면 `NodesModule`의 forwardRef가 아직 정리됐는지 별도 확인 필요).
  - 제안: 코드 동작에 영향 없음. plan `02-architecture.md:401` 의 "nodes 모듈에" 기술이 실제 배치(`execution-engine` 모듈)와 달라졌으므로, plan 문서를 실제 모듈 위치(`execution-engine`)로 업데이트하는 것을 권장. 필수는 아님.

---

### 3. API endpoint 충돌

해당 없음. 이번 변경은 DI 토큰·내부 서비스 분리로 새 HTTP endpoint를 도입하지 않는다.

---

### 4. 이벤트/메시지명 충돌

해당 없음. 새 이벤트 이름이 없다.

---

### 5. 환경변수·설정키 충돌

- **[INFO]** `WORKFLOW_EXECUTOR` 상수의 값(`'WORKFLOW_EXECUTOR'`) 이 NestJS DI 토큰 문자열로 전역 등록됨
  - target 신규 식별자: `export const WORKFLOW_EXECUTOR = 'WORKFLOW_EXECUTOR'` (`nodes/core/workflow-executor.interface.ts:84`)
  - 기존 사용처: `grep` 결과 동일 문자열 `'WORKFLOW_EXECUTOR'` 를 DI 토큰으로 사용하는 다른 위치 없음. (`WORKFLOW_REVIEW_REQUIRED`, `WORKFLOW_VERIFY_REQUIRED`, `WORKFLOW_NOT_FOUND` 등 다른 `WORKFLOW_*` 문자열은 에러 코드/상태 리터럴로만 사용 — DI 토큰 아님)
  - 상세: 충돌 없음. 단, NestJS DI 토큰 문자열은 프로세스 내 전역 네임스페이스이므로 향후 다른 모듈이 동일 문자열 토큰을 정의할 경우 DI 오염이 발생할 수 있다. 현재는 단일 정의, 단일 바인딩(`execution-engine.module.ts`).
  - 제안: 현재 문제 없음. 명시적 Symbol 토큰(`Symbol('WORKFLOW_EXECUTOR')`)으로 변경하면 문자열 충돌 가능성을 원천 차단할 수 있으나, NestJS 생태계에서 문자열 토큰도 관행적이므로 선택적.

---

### 6. 파일 경로 충돌

- **[INFO]** `node-bootstrap.service.ts` 파일명 컨벤션 일치 확인
  - target 신규 식별자: `codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts`
  - 기존 사용처: `execution-engine` 모듈의 기존 파일들(`execution-engine.service.ts`, `execution-engine.module.ts`, `node-handler-dependencies.provider.ts` 등)은 NestJS 컨벤션(`<name>.service.ts`, `<name>.module.ts`, `<name>.provider.ts`)을 따름
  - 상세: 신규 파일 `node-bootstrap.service.ts` 도 동일 컨벤션을 따르며, origin/main 에 같은 이름의 파일이 존재하지 않음. 충돌 없음.
  - 제안: 없음.

---

## 요약

이번 변경이 도입하는 세 식별자 — `WORKFLOW_EXECUTOR` DI 토큰 상수, `NodeBootstrapService` 서비스 클래스, `node-bootstrap.service.ts` 파일 — 는 기존 코드베이스·spec·plan 어디에서도 다른 의미로 이미 사용 중인 사례가 없다. `WORKFLOW_EXECUTOR` 는 이미 존재하던 `WorkflowExecutor` 인터페이스의 DI 토큰화로, spec이 정의한 계약의 정확한 용처이며 plan도 동일 이름을 권장(02-architecture.md:400)했다. `plan/in-progress/refactor/02-architecture.md:401` 이 "nodes 모듈에" 라고 명시한 반면 실제 구현은 `execution-engine` 모듈에 배치되었다는 위치 차이만 존재하며, 이는 기능 충돌이 아닌 plan 문서 업데이트 사안이다. `C-1`/`m-3` ID는 refactor 파일별 로컬 식별자라 실제 코드 네임스페이스 충돌은 없다.

## 위험도

NONE

STATUS: OK
