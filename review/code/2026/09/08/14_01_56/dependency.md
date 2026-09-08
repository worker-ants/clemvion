# 의존성(Dependency) 코드 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` 미변경
  - 위치: 해당 없음 — 리뷰 대상 82개 파일 목록(`### 파일 1`~`### 파일 82`)에 매니페스트·lockfile 이 하나도 없음을 확인
  - 상세: 이번 diff 는 backend/frontend 서비스 코드, repo-guard, plan 문서, 이전 리뷰 라운드(`review/code/2026/09/08/12_53_08`·`13_34_28`)와 consistency 산출물(`review/consistency/2026/09/08/*`)로 구성되며 어디에도 신규 npm 패키지 추가·버전 변경이 없다. 따라서 버전 고정, 라이선스 호환성, 알려진 취약점(CVE), 번들 크기 증가, 서드파티 버전 충돌 항목은 이번 diff 범위에서 전부 해당 없음(N/A)이다.
  - 제안: 없음.

- **[INFO]** `http-exception.filter.ts` 가 `typeorm` 의 `QueryFailedError` 직접 의존을 제거하고 내부 duck-typing 헬퍼로 대체 — 외부 라이브러리 결합도 감소
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`import { QueryFailedError } from 'typeorm';` 삭제 → `import { isPostgresUniqueViolation } from '../db/pg-error';`), 사용부는 `isUniqueViolation(exception)` → `isPostgresUniqueViolation(exception)` 로 치환된 자리
  - 상세: `codebase/backend/src/common/db/pg-error.ts` 를 직접 열어 확인한 결과 이 모듈은 어떤 외부 패키지도 import 하지 않고 `interface PgLikeError { code?; constraint?; driverError?: {...} }` 구조적 타이핑만으로 두 표면(`err.code` / `err.driverError.code`)을 흡수한다. 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 `typeorm` 클래스 계층에 의존했는데, 이제 전역 예외 필터는 `typeorm` 을 전혀 import 하지 않는다. ORM 라이브러리 결합도를 낮추는 방향의 개선이며 새 의존성 도입은 없다.
  - 제안: 없음(긍정적).

- **[INFO]** 내부 의존성 fan-in 두 축 — `pg-error.ts` SoT 를 필터+OAuth 서비스가 공유, `source-scan.ts` 의 `enclosingScopeName` 을 두 repo-guard 가 공유
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70`, `codebase/backend/src/modules/integrations/integration-oauth.service.ts`(`import { isPostgresUniqueViolation, pgErrorConstraint } from '../../common/db/pg-error'`, 사용부 게이트 1268~1274/1822~1828) / `codebase/backend/src/common/__test-utils__/source-scan.ts`(신설 `enclosingScopeName`, 게이트 101~127), 소비처 `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 와 신설 `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  - 상세: (1) `integration-oauth.service.ts` 는 두 콜사이트(cafe24/makeshop)에서 손으로 반복하던 `err.constraint ?? err.driverError?.constraint` 를 `pgErrorConstraint(err)` 단일 호출로 교체했다 — 전역 필터(모든 엔드포인트)와 OAuth 서비스가 같은 `pg-error.ts` 모듈에 의존하게 됐다. (2) 이번 라운드에서 새로 추가된 `endpoint-path-conflict-wrap-guard.ts` 가 기존 `user-entity-exposure-guard.ts` 의 로컬 `enclosingName` 을 `common/__test-utils__/source-scan.ts` 로 승격한 `enclosingScopeName` 을 함께 소비하도록 리팩터됐다(형제 AST 워커 중복 제거, 직전 라운드 architecture WARNING#1 후속). 둘 다 "각자 손으로 짠 중복 로직"을 "단일 공유 유틸리티 의존"으로 수렴시키는 DRY 방향이며, 공유 모듈에 결함이 생기면 영향 범위가 넓어진다는 점은 인지할 사항이나 양쪽 다 회귀 테스트가 동반돼 있다.
  - 제안: 없음(확인 사항).

- **[INFO]** `tsconfig.build.json` 신규 exclude `**/__test-utils__/**` — 프로덕션 코드의 역참조 부재를 직접 확인
  - 위치: `codebase/backend/tsconfig.build.json` (게이트 21~28)
  - 상세: 이 exclude 가 `common/__test-utils__/*`·`modules/integrations/__test-utils__/*` 를 빌드 대상에서 제외하는데, 만약 프로덕션(비-테스트) 코드가 이 경로를 import 하고 있었다면 dist 참조 불일치를 만들 수 있었다. `grep -rn "__test-utils__" codebase/backend/src --include="*.ts"` 로 전수 확인한 결과 소비처는 전부 `src/repo-guards/__tests__/**`(이미 기존 `"src/repo-guards/**"` exclude 로 빌드 제외됨) 아니면 `*.spec.ts` 뿐이었고, `workspace-id-fixtures.ts`/`oauth-config-mock.ts` 는 자기 자신 외 프로덕션 소비처가 0건이었다. 즉 이번 exclude 확장은 안전하며 CHANGELOG/plan 이 주장하는 "죽은 코드가 dist 에 실릴 뿐"이라는 근거와 실측이 일치한다.
  - 제안: 없음(검증 완료).

- **[INFO]** 빌드 단계 wall-clock 증가 — 두 타입체크 ratchet 이 `cmd_build()` 안에 순차 추가(신규 외부 도구 아님)
  - 위치: `.claude/test-stages.sh` (`_cmd_typecheck_ratchets()`, `cmd_build()` 안 호출부)
  - 상세: `python3 scripts/check-backend-typecheck-ratchet.py && python3 scripts/check-frontend-typecheck-ratchet.py` 가 기존 `pnpm --filter backend/frontend build` 등 여러 빌드 스텝 뒤에 순차 추가된다. 두 스크립트는 이미 CI(`backend-checks.yml`/`frontend-checks.yml`)에서 쓰이던 기존 도구이고 `python3` 도 기존 요구사항이라 신규 외부 의존성이 아니다. 두 스크립트는 서로 다른 패키지를 검사해 원리적으로 병렬화 가능하지만, 직전 리뷰(`review/code/2026/09/08/12_53_08/RESOLUTION.md` INFO#5)에서 "`build` 단계가 이미 docker 이미지 빌드(172s)에 지배되고 병렬화 시 stderr 가 섞여 진단이 나빠진다"는 근거로 이미 won't-do 처분됐다.
  - 제안: 추가 조치 불요(재지적 아님, 참고 기록).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 — 내부 모듈 참조 범위 재확인, 공유 패키지화 아님
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (선언부, `findOne` 반환 타입), `codebase/frontend/src/lib/api/workflows.ts` (JSDoc 만 갱신, 타입 선언 자체는 `WorkflowVersionDetail` 이름 유지)
  - 상세: 이 타입은 `codebase/packages/**` 공유 타입 패키지를 거치지 않는 손-미러이며, 백엔드 개명이 프런트엔드 타입 선언에는 영향을 주지 않는다. grep 상 백엔드 내부 참조는 선언·`findOne` 반환 타입 두 곳뿐이라 내부 의존 그래프 파급은 제한적이다. 이름 충돌 해소가 목적이며 신규/불필요 의존성과 무관하다.
  - 제안: 없음(확인 사항).

## 요약

이번 diff(82개 파일, 코드·plan·이전 리뷰/consistency 산출물 포함)는 `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` 을 전혀 건드리지 않아 새 외부 의존성 추가·버전 변경·라이선스·취약점·번들 크기 항목은 모두 해당 없음이다. 실질적으로 관찰되는 의존성 움직임은 전부 내부 모듈 결합도 방향의 개선이다 — `http-exception.filter.ts` 가 `typeorm` `QueryFailedError` 직접 import 를 제거하고 외부 의존 0인 `pg-error.ts` 헬퍼로 이전했고, 전역 필터·OAuth 통합 서비스·두 repo-guard(AST 워커)가 각각 `pg-error.ts`/`source-scan.ts` 라는 단일 내부 SoT 로 fan-in 해 중복 로직을 제거했다. `tsconfig.build.json` 의 `**/__test-utils__/**` exclude 확장은 실제로 프로덕션 코드의 역참조가 없음을 grep 으로 직접 확인해 안전을 검증했다. 빌드 단계에 순차 추가된 두 타입체크 ratchet 은 신규 도구 도입이 아니며 병렬화 defer 결정이 이미 있다. 이전 라운드 dependency 리뷰(`review/code/2026/09/08/13_34_28/dependency.md`)의 결론(위험도 NONE)과 이번 확장된 diff 도 일치한다.

## 위험도

NONE
