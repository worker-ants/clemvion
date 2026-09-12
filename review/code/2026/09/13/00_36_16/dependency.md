# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 이번 변경분에 새 외부 패키지 도입 없음 — 전량 내부 모듈/문서 변경
  - 위치: 전체 diff (`codebase/backend/package.json`, `pnpm-lock.yaml` 등 매니페스트 파일 변경분 없음 — `git diff --stat` 로 확인)
  - 상세: 11개 변경 파일(`CHANGELOG.md`, `uuid.ts`/`uuid.spec.ts`, `login-history.service.ts`/`.spec.ts`, `background-runs.service.ts`/`.spec.ts`, 2개 e2e spec, 2개 plan 문서) 중 코드 변경은 기존 유틸 함수 `isUuidShaped`(`codebase/backend/src/common/utils/uuid.ts`, 손으로 짠 정규식, `UUID_SHAPE_PATTERN`)를 두 서비스에서 새로 `import` 하는 것뿐이다. import 되는 심볼(`@nestjs/common`, `@nestjs/typeorm`, `typeorm`, `@jest/globals`, `node:crypto`, `pg`, `supertest`)은 모두 diff 이전부터 해당 파일들이 이미 쓰던 기존 의존성이고 버전 변경도 없다.
  - 제안: 해당 없음 (조치 불필요)

- **[INFO]** 새 내부 모듈 의존 방향은 기존 계층 규약과 일치 — 역방향/순환 없음
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:8` (`import { isUuidShaped } from '../../common/utils/uuid';`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:22` (`import { isUuidShaped } from '../../../common/utils/uuid';`)
  - 상세: 두 feature 모듈(`auth`, `executions/background-runs`)이 공유 유틸 `common/utils/uuid`를 소비하는 방향이며, `common/utils/uuid.ts` 쪽은 두 모듈 어느 쪽도 import 하지 않는다(파일 컨텍스트 확인). `uuid.ts` docstring(§refactor 02 M-7)에도 "shared util 로 승격" 배경이 이미 있어, 이번 두 소비처 추가는 기존 패턴의 반복이지 새 계층 위반이 아니다. 상대경로 depth(`../../` vs `../../../`)도 각 파일의 실제 디렉터리 깊이와 일치해 잘못된 import 경로는 없다.
  - 제안: 해당 없음. 단, `uuid.spec.ts`/`uuid.ts` 자체 docstring이 이미 명시한 대로 — 향후 `isUuidShaped` 소비처가 하나라도 더 늘면 이 파일(dependency 관점에서는 "내부 의존 그래프의 fan-in 지점")의 회귀 캐너리 테스트도 함께 늘려야 한다는 점을 인수인계 문서 그대로 유지.

- **[INFO]** e2e 스펙 2건이 늘어난 것은 신규 의존성이 아니라 기존 스위트 내 케이스 추가
  - 위치: `codebase/backend/test/background-monitoring.e2e-spec.ts` (기존 파일에 `it(...)` 블록 추가, `pg`/`supertest` 는 파일 최상단에서 diff 이전부터 이미 import), `codebase/backend/test/session-revocation.e2e-spec.ts` (동일 패턴)
  - 상세: 두 파일 모두 `new file mode`가 아니라 기존 파일 수정이며, `Client`(`pg`)·`request`(`supertest`)·`randomUUID`(`node:crypto`) 등은 이 스펙 파일이 원래부터 쓰던 것이다. 빌드/CI 시간에 미치는 영향은 새 테스트 케이스 3개(background-monitoring 1개, session-revocation 1개, service unit spec 3개) 수준으로 무시 가능.
  - 제안: 해당 없음

## 요약

이번 diff는 CHANGELOG·plan 문서 갱신과 기존 유틸 `isUuidShaped`를 두 서비스(`login-history.service.ts`, `background-runs.service.ts`)의 커서 디코더에 새로 연결하는 내부 리팩터링/버그 픽스 후속 라운드로, 신규 외부 패키지 추가·버전 변경·라이선스 이슈·알려진 취약점 노출이 전혀 없다. 새로 생긴 것은 오직 프로젝트 내부 모듈 간 import 관계(두 feature 서비스 → `common/utils/uuid`) 뿐이며, 이는 기존 계층 방향(공유 유틸을 도메인 모듈이 소비)과 일치하고 순환·역방향 의존도 발견되지 않았다. 의존성 관점에서는 조치가 필요한 항목이 없다.

## 위험도

NONE
