# 의존성(Dependency) 코드 리뷰

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 이번 diff 는 `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` 을 전혀 건드리지 않는다
  - 위치: 해당 없음 (매니페스트·lockfile diff 부재를 `git diff --stat origin/main...HEAD -- '**/package.json' pnpm-lock.yaml pnpm-workspace.yaml` 로 직접 확인)
  - 상세: 51개 변경 파일 목록에 매니페스트류가 없다. 따라서 버전 고정, 라이선스 호환성, 알려진 취약점, 번들 크기 증가, 버전 충돌 항목은 이번 diff 범위에서 전부 해당 없음(N/A)이다.
  - 제안: 없음.

- **[INFO]** `http-exception.filter.ts` 가 `typeorm` 의 `QueryFailedError` 직접 의존을 제거하고 내부 duck-typing 헬퍼로 대체 — 외부 라이브러리 결합도 감소
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (게이트 8~13 부근 — `import { QueryFailedError } from 'typeorm';` 삭제, `import { isPostgresUniqueViolation } from '../db/pg-error';` 추가), 사용부 `:70`
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 `typeorm` 클래스 정체성에 의존했다. `codebase/backend/src/common/db/pg-error.ts` 를 직접 열어 확인한 결과 이 모듈은 **어떤 외부 패키지도 import 하지 않고** `interface PgLikeError { code?; constraint?; driverError?: {...} }` 형태의 구조적 타이핑만으로 두 표면(`err.code` / `err.driverError.code`)을 흡수한다. 그 결과 `http-exception.filter.ts` 는 이제 `typeorm` 을 전혀 import 하지 않는다(`grep -n "typeorm|QueryFailedError"` 결과 0건). 전역 예외 필터가 특정 ORM 라이브러리의 클래스 계층에 더 이상 묶이지 않는 방향의 개선이며, 새 의존성 도입은 없다.
  - 제안: 없음(긍정적).

- **[INFO]** 내부 의존성 fan-in 집중 — `pg-error.ts` 가 3개 서비스 파일의 SoT 로 승격
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70`, `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (게이트 31~34, 1268~1274, 1822~1828 — `isPostgresUniqueViolation` + `pgErrorConstraint` 두 함수 모두 사용)
  - 상세: `integration-oauth.service.ts` 는 종전에 `err.constraint ?? err.driverError?.constraint` 를 두 콜사이트(cafe24/makeshop)에서 손으로 반복하던 것을 `pgErrorConstraint(err)` 단일 호출로 교체했다. 이제 전역 예외 필터(모든 엔드포인트 경로)와 OAuth 통합 서비스(cafe24·makeshop 설치 경로)가 같은 `pg-error.ts` 모듈에 의존한다 — 내부 모듈 간 결합이 "각자 손으로 짠 중복 로직"에서 "단일 공유 유틸리티 의존"으로 수렴한 것이다. DRY 관점에서 바람직하지만, 이 파일에 결함이 생기면 영향 범위가 필터 전역 + OAuth 두 서비스로 넓어진다는 점은 리뷰어가 인지하고 있어야 한다(테스트는 두 표면·양방향 회귀를 모두 커버하고 있어 별도 조치 불요).
  - 제안: 없음(확인 사항) — 이미 회귀 테스트(`http-exception.filter.spec.ts` 신규 2건, cafe24/makeshop spec 의 `it.each` 두 표면 파라미터화)로 방어돼 있다.

- **[INFO]** 빌드 단계 wall-clock 증가 — 두 타입체크 ratchet 이 `cmd_build()` 안에 순차 추가
  - 위치: `.claude/test-stages.sh` (게이트 80~85 `_cmd_typecheck_ratchets()`, 95 호출부)
  - 상세: `python3 scripts/check-backend-typecheck-ratchet.py && python3 scripts/check-frontend-typecheck-ratchet.py` 가 `cmd_build()` 안에서 기존 `pnpm --filter backend build` 등 여러 빌드 스텝 뒤에 순차 추가된다. 두 스크립트는 서로 다른 패키지의 독립적인 전체 프로그램 typecheck 를 수행하며 상호 의존이 없어 원리적으로는 병렬화 가능하지만, 직전 리뷰(`review/code/2026/09/08/12_53_08/RESOLUTION.md` INFO#5)에서 이미 "측정하지 않은 최적화이고 `build` 단계가 이미 docker 이미지 빌드(172s)에 지배되며 병렬화 시 stderr 가 섞여 진단이 나빠진다"는 이유로 **won't-do** 로 처분됐다. 신규 외부 패키지 도입은 아니며 순수 로컬 빌드 스크립트 배선 변경이다.
  - 제안: 추가 조치 불요(이미 근거와 함께 defer 처분됨). 재지적 아님 — 참고로만 기록.

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 — 내부 모듈 참조 범위 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (게이트 70, 153), `codebase/frontend/src/lib/api/workflows.ts` (게이트 110~121, JSDoc 만 갱신)
  - 상세: 이 타입은 공유 타입 패키지(`codebase/packages/**`)를 거치지 않는 "손으로 맞춘 미러"이며, 백엔드 개명이 프런트엔드 타입 선언 자체에는 영향을 주지 않는다(프런트는 여전히 `WorkflowVersionDetail` 이름 유지, JSDoc 참조만 갱신). grep 상 백엔드 내부 참조는 선언·`findOne` 반환 타입 두 곳뿐이라 내부 의존 그래프에 다른 파급은 없다. 이름 충돌 해소가 목적이며 신규/불필요 의존성과는 무관하다.
  - 제안: 없음(확인 사항).

## 요약

이번 diff(51개 파일)는 `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml` 을 전혀 건드리지 않아 새 외부 의존성 추가·버전 변경·라이선스·취약점·번들 크기 항목은 모두 해당 없음이다. 유일하게 눈에 띄는 의존성 관련 움직임은 `http-exception.filter.ts` 가 `typeorm`의 `QueryFailedError` 직접 import 를 제거하고 순수 duck-typing 헬퍼(`pg-error.ts`, 외부 의존 0)로 대체해 ORM 라이브러리 결합도를 낮춘 것과, 전역 필터·OAuth 통합 서비스 두 축이 같은 내부 SoT 모듈(`pg-error.ts`)에 fan-in 하도록 수렴한 것이다. 이는 중복 제거·결합도 감소 방향의 긍정적 변화이며 회귀 테스트로 뒷받침된다. `.claude/test-stages.sh` 의 타입체크 ratchet 순차 추가는 로컬 빌드 wall-clock 을 다소 늘리지만 신규 의존성이 아니고 병렬화는 이미 근거와 함께 defer 처리됐다. 종합적으로 의존성 관점의 위험은 없다.

## 위험도

NONE
