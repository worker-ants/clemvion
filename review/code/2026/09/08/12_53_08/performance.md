# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** DB 컬럼 투영 도입 — 성능 개선(회귀 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` (`listMembers`)
  - 상세: 종전 `relations: ['user']` 는 `User` 엔티티 전 컬럼(민감 7컬럼 포함)을 JOIN 으로 로드한 뒤 JS 단 `.map` 으로 좁혔다. 이번 변경은 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 DB 레벨 투영을 적용해, 애초에 불필요한 컬럼이 네트워크·메모리로 올라오지 않는다. `relations`+`select` 조합은 TypeORM 이 단일 JOIN 쿼리로 처리하므로 N+1 로 퇴화하지 않는다. 순수하게 긍정적인 변경이라 기록만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** 테스트 스위트 내 `resolveBuildFileNames()` 반복 호출 — 캐싱 기회
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` (신규 `it('\`__test-utils__\` 는 빌드 대상이 아니다', …)` 블록, 파일 내 79행 부근)
  - 상세: `resolveBuildFileNames(backendDir)` 가 `describe` 블록 안에서 `it` 마다 독립 호출된다(캐너리·`repo-guards` 체크·이번에 추가된 `__test-utils__` 체크, 총 3회 + `findDevDepLeaks` 내부의 1회로 사실상 4회). 구현체(`production-build-devdep-guard.ts:26-36`)는 매 호출마다 `tsconfig.build.json` 을 다시 읽고 `ts.parseJsonConfigFileContent` 로 include/exclude 글롭을 처음부터 재해석한다(현재 805+ 파일 스캔). 이번 diff 는 기존에 이미 2회 중복 호출되던 패턴에 세 번째 호출을 추가한 것이라 새로운 결함 유형은 아니고, 실행 대상도 프로덕션이 아니라 테스트 스위트(로컬/CI 빌드 게이트)이므로 사용자 체감 영향은 없다.
  - 제안: `describe` 최상단에서 `const buildFiles = resolveBuildFileNames(backendDir);` 로 한 번만 계산해 세 `it` 블록이 공유하도록 리팩터링하면 중복 글롭·tsconfig 파싱 비용을 1/3로 줄일 수 있다. 급하지 않음(테스트 실행시간 수십~수백 ms 수준 추정).

- **[INFO]** `cmd_build()` 안 타입체크 ratchet 두 개가 순차 실행
  - 위치: `.claude/test-stages.sh:80-85` (`_cmd_typecheck_ratchets`), 호출부 `.claude/test-stages.sh:95` (`cmd_build()` 안 `_cmd_typecheck_ratchets &&`)
  - 상세: `check-backend-typecheck-ratchet.py && check-frontend-typecheck-ratchet.py` 가 `&&` 로 순차 실행된다. 두 스크립트는 서로 다른 패키지(`codebase/backend` vs `codebase/frontend`)의 독립적인 `tsc --noEmit` 류 전체 프로그램 typecheck 를 수행하는 것으로 보이며 상호 의존이 없다. `cmd_build()` 는 이미 `pnpm --filter backend build`, `pnpm --filter frontend build` 등 여러 빌드 단계를 순차로 밟고 있어, 이번 추가로 로컬 `build` 단계 wall-clock 시간이 늘어난다(의도된 트레이드오프 — CI 전용 게이트를 로컬로 당겨온 것이므로 결함은 아님).
  - 제안: 급한 조치는 아니나, 두 ratchet 을 병렬 실행(`wait` 로 두 백그라운드 job 을 기다리는 형태)하면 실패 시 어느 쪽인지 구분하는 로직만 추가하면 되므로 로컬 반복 실행 빈도가 높다면 고려할 만하다.

## 요약

이번 diff 는 대부분 harness/테스트/문서 변경(`test-stages.sh`, `PROJECT.md`, repo-guard·spec 신설, plan 문서)이며 런타임 핫패스에 영향을 주는 변경은 두 곳뿐이다. `http-exception.filter.ts` 의 `isUniqueViolation` → `isPostgresUniqueViolation` 치환과 `integration-oauth.service.ts` 의 손-작성 constraint 추출 → `pgErrorConstraint()` 치환은 둘 다 O(1) 속성 접근을 그대로 유지하는 순수 리팩터(중복 제거)라 성능 특성 변화가 없다. `workspaces.service.ts` 의 `listMembers` DB-레벨 `select` 투영은 오히려 불필요한 컬럼 로드를 제거하는 **성능 개선**이며 N+1 로 퇴화하지 않는다. 신설된 `endpoint-path-conflict-wrap-guard.ts` AST 스캐너는 스캔 대상을 `triggers` 모듈로 좁히고 `describe` 최상단에서 한 번만 계산해 재사용하는 등 캐싱 규율을 잘 지킨다. 유일하게 눈에 띄는 비효율은 `production-build-devdep.spec.ts` 에서 `resolveBuildFileNames()` 를 테스트별로 반복 호출하는 기존 패턴에 세 번째 호출이 추가된 것과, `cmd_build()` 에 순차 추가된 두 typecheck ratchet 인데, 둘 다 프로덕션 런타임이 아닌 테스트/빌드 파이프라인 시간에만 영향을 주는 경미한 사항이다. Critical·Warning 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
