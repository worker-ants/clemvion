# 의존성(Dependency) 리뷰 — system-status-page

## 발견사항

### [INFO] 새 외부 패키지 추가 없음 — 기존 의존성만 활용
- 위치: 전체 변경 파일
- 상세: 이번 변경(`codebase/backend/src/modules/system-status/`, `codebase/frontend/src/app/(main)/system-status/`)은 `package.json` 수정 없이 기존 의존성만 사용한다.
  - 백엔드: `@nestjs/bullmq`, `bullmq`, `@nestjs/swagger`, `@nestjs/common` — 모두 기존에 등록된 패키지.
  - 프론트엔드: `@tanstack/react-query`, `lucide-react`, 프로젝트 내부 UI 컴포넌트 — 모두 기존에 등록된 패키지.
  - e2e 테스트: `supertest`, `pg`, `@jest/globals` — 모두 기존 devDependency 또는 transitive dep.
- 제안: 변경 없이 유지.

### [INFO] `@jest/globals` 명시적 devDependency 미등록 — transitive 경로로 해소
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` 1번째 줄
- 상세: `@jest/globals`는 `package.json`에 직접 등재되지 않았으나 `jest@30.3.0`의 transitive 의존성으로 `node_modules/@jest/globals`가 설치되어 있어 현재는 동작한다. Jest 메이저 업그레이드 시 peer 구조 변경으로 임포트가 깨질 수 있으나, 기존 다른 e2e 파일이 이 패턴을 공통으로 사용한다면 기존 관행과 동일하게 유지해도 무방하다.
- 제안: 프로젝트 내 e2e 파일 공통 패턴 확인 후, Jest 글로벌 자동주입 방식이 표준이라면 `import` 라인 제거 검토. 현행 패턴이 공통이라면 유지.

### [INFO] `lucide-react` — 신규 아이콘 임포트, 기존 패키지 범위 내
- 위치: `codebase/frontend/src/components/layout/sidebar.tsx`, `codebase/frontend/src/app/(main)/system-status/page.tsx`
- 상세: `Activity`, `Info`, `Loader2`, `RefreshCw` 아이콘을 새로 임포트하지만 `lucide-react@^1.7.0`는 이미 `package.json`에 등재되어 있고 해당 아이콘들은 동 패키지에 포함된다. lucide-react의 트리쉐이킹 지원으로 번들 크기 영향은 무시 가능하다.
- 제안: 변경 없이 유지.

### [INFO] 내부 의존성 — 12개 큐 상수 임포트 fan-in 구조
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts`
- 상세: 12개 큐 이름 상수를 각 도메인 모듈 소스 파일에서 직접 임포트한다. 큐 이름 문자열 중복 리터럴을 방지하는 단일 진실 패턴으로 적절하다. 단, `system-status` 모듈이 8개 이상의 내부 모듈에 직접 의존하는 fan-in 구조가 되어 향후 큐 상수 소재 파일 이동 시 일괄 갱신이 필요하다는 점은 인지할 필요가 있다.
- 제안: 현행 유지. 큐 상수를 공용 파일로 추출하는 것은 별도 리팩터링 범위.

### [INFO] `BullModule.registerQueue` `sharedConnection: true` — Redis 연결 공유 적절
- 위치: `codebase/backend/src/modules/system-status/system-status.module.ts`
- 상세: 각 큐를 `sharedConnection: true`로 등록해 모니터링용 Queue 클라이언트가 별도 Redis 연결을 생성하지 않도록 한다. 이전 `ai-review INFO-12` Redis 연결 통합 정책과 일치한다. `@nestjs/bullmq@^11.0.4` + `bullmq@^5.76.6`는 이미 등록된 버전으로 호환 문제 없음.
- 제안: 변경 없이 유지.

---

## 요약

이번 변경은 신규 `system-status` 모듈(백엔드)과 페이지(프론트엔드)를 추가하면서 `package.json`에 어떠한 외부 의존성도 추가하지 않았다. 사용된 모든 패키지(`@nestjs/bullmq`, `bullmq`, `@nestjs/swagger`, `@tanstack/react-query`, `lucide-react`, `supertest`, `pg`)는 기존에 버전이 고정(`^` caret 범위)된 상태로 등재되어 있으며 알려진 취약점·라이선스 충돌·버전 불일치가 없다. 내부 의존성 관점에서 큐 이름 상수를 각 도메인 모듈에서 직접 재사용하는 패턴은 단일 진실 원칙에 부합한다. e2e 테스트에서 `@jest/globals`를 직접 임포트하나 transitive 경로로 해소되어 있어 기존 관행과 동일하다면 별도 조치가 필요하지 않다. 전반적으로 의존성 위험은 없다.

## 위험도

NONE

STATUS: SUCCESS
