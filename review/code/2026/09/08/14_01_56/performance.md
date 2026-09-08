# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` 를 DB 레벨 `select` 투영으로 전환 — 성능 개선 (회귀 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-231` (`select: { id, userId, role, joinedAt, user: { id, email, name } }` 추가)
  - 상세: 종전에는 `relations: ['user']` 만으로 `User` 엔티티 전 컬럼(민감 7컬럼 포함)을 JOIN 으로 로드한 뒤 `.map()` 으로 6키만 골랐다. 이번 diff 는 `select` 절을 추가해 DB 레벨에서 필요한 컬럼만 가져오도록 좁혔다 — 네트워크·직렬화·GC 대상이 되는 불필요한 컬럼(민감 데이터 포함)이 애초에 로드되지 않는다. `relations`+`select` 조합은 여전히 단일 LEFT JOIN 쿼리이므로 N+1 로 퇴화하지 않는다. 순수하게 긍정적인 변경이라 기록만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 이전 라운드에서 지적된 `resolveBuildFileNames()` 반복 호출이 이번 diff 에서 캐싱으로 해소됨 — 다만 `findDevDepLeaks` 경유의 내부 재호출 1건은 남아 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts:39` (`const buildFiles = resolveBuildFileNames(backendDir);` — describe 최상단으로 승격)
  - 상세: 종전에는 캐너리 테스트와 `repo-guards 는 빌드 대상이 아니다` 테스트가 각각 `resolveBuildFileNames(backendDir)` 를 독립 호출해 `tsconfig.build.json` 재파싱 + 800여 파일 glob 해석이 반복됐다(`review/code/2026/09/08/12_53_08` performance.md INFO#2). 이번 diff 는 `buildFiles` 를 describe 블록 최상단에서 한 번만 계산해 캐너리 테스트와 신설된 `it.each(['repo-guards', 'shared/testing', '__test-utils__'])` 세 케이스가 모두 재사용하도록 고쳤다 — 직접 호출 횟수가 2회→1회로 줄었다. 다만 같은 파일 54행의 `findDevDepLeaks(backendDir)` 는 내부에서 자신만의 `resolveBuildFileNames(backendDir)` 를 다시 호출한다(`production-build-devdep-guard.ts:112`) — 이는 `buildFiles` 캐시와 공유되지 않는 별도 경로다. `findDevDepLeaks` 자체가 각 빌드 대상 파일을 다시 읽고 `ts.createSourceFile` 로 파싱하는(805+ 파일) 더 무거운 작업을 어차피 1회 수행해야 하므로 실질 비용 증가는 아니지만, 헤더 주석("빌드 대상 목록은 한 번만 해석한다")이 이 경로를 포함하지 않는다는 점만 참고로 남긴다.
  - 제안: 조치 불요(테스트 스위트 한정, 실행 시간 영향 미미). 완전히 닫으려면 `findDevDepLeaks` 를 `(files: string[]) => DevDepLeak[]` 형태로 바꿔 `buildFiles` 를 주입받게 하는 정도이나 이번 PR 범위를 넘는다.

- **[INFO]** `cmd_build()` 에 타입체크 ratchet 두 개가 순차 추가되어 로컬/CI `build` 단계 wall-clock 이 늘어난다
  - 위치: `.claude/test-stages.sh:80-85` (`_cmd_typecheck_ratchets()` 정의, `python3 ... check-backend-typecheck-ratchet.py && python3 ... check-frontend-typecheck-ratchet.py`), 호출부 `.claude/test-stages.sh:95` (`_cmd_typecheck_ratchets &&`)
  - 상세: 두 스크립트는 서로 다른 패키지(backend/frontend)의 독립적인 전체 프로그램 `tsc` 류 타입체크를 수행하며 상호 의존이 없어 원리적으로 병렬화 가능하다. `&&` 순차 실행이라 두 typecheck 시간이 그대로 합산되어 `cmd_build()` 총 소요시간에 더해진다. 다만 이는 CI 전용 게이트(`backend-checks.yml`/`frontend-checks.yml`)를 로컬 `build` 단계로 당겨온 의도된 트레이드오프(회귀 조기 발견 vs 로컬 시간)이지 결함이 아니다.
  - 제안: 급하지 않음. 로컬 반복 실행 빈도가 높아 체감된다면 두 스크립트를 백그라운드 job + `wait` 로 병렬화하는 것을 고려할 만하다(실패 시 어느 쪽인지 구분하는 로직이 함께 필요).

- **[INFO]** `pg-error.ts` SoT 로의 통합(`isPostgresUniqueViolation`/`pgErrorConstraint`)은 순수 O(1) 리팩터 — 성능 특성 변화 없음
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:12`(import), `:70`(`isPostgresUniqueViolation(exception)`); `codebase/backend/src/modules/integrations/integration-oauth.service.ts:1268-1274`, `:1822-1828`(`pgErrorConstraint(err)`)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `instanceof QueryFailedError` 검사 후 프로퍼티 접근이었고, 신설 `isPostgresUniqueViolation`/`pgErrorConstraint`(`codebase/backend/src/common/db/pg-error.ts`)는 `typeof === 'object'` 검사 후 `??` 체이닝 프로퍼티 접근이다. 둘 다 O(1)이며 예외 처리 hot path(전역 필터, 모든 요청 경로)에 미치는 영향은 무시할 수준이다. `integration-oauth.service.ts` 의 손-작성 constraint 추출 중복 제거도 동일하게 O(1) 유지.
  - 제안: 조치 불요.

## 요약

이번 diff 에서 런타임 프로덕션 코드에 영향을 주는 변경은 `http-exception.filter.ts`/`integration-oauth.service.ts` 의 `pg-error.ts` SoT 치환(순수 O(1) 리팩터, 특성 변화 없음)과 `workspaces.service.ts` 의 `listMembers` DB 투영(불필요 컬럼 로드 제거 — 실질적 성능 개선이자 N+1 로 퇴화하지 않음) 두 곳뿐이다. 나머지는 harness/테스트/문서 변경으로, 이전 라운드(`review/code/2026/09/08/12_53_08`)가 지적한 `production-build-devdep.spec.ts` 의 `resolveBuildFileNames()` 반복 호출은 이번 diff 에서 describe 최상단 캐싱으로 해소됐다(단, `findDevDepLeaks` 내부의 별도 재호출 1건은 캐시 공유 밖에 남아 있으나 실질 비용 증가는 아니다). `cmd_build()` 에 순차 추가된 타입체크 ratchet 두 개는 로컬/CI 빌드 시간을 늘리지만 의도된 트레이드오프다. Critical·Warning 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
