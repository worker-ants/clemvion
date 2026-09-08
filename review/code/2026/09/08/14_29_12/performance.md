# 성능(Performance) 코드 리뷰

## 검토 범위

이번 번들(110개 파일)은 실질적으로 3라운드의 `/ai-review` fix 를 거친 배치 B(B-1~B-8) +
그 산출물(review/consistency/**, review/code/**)의 누적 diff다. 런타임 성능에 영향을 줄 수
있는 실제 소스 변경은 다음으로 좁혀진다 — 나머지는 문서(CHANGELOG/PROJECT.md/plan)·리뷰
산출물(review/**)·테스트 전용 코드다.

- `codebase/backend/src/common/filters/http-exception.filter.ts` — `isUniqueViolation` →
  `isPostgresUniqueViolation`/`pgErrorConstraint` 치환
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — 손-작성
  constraint 추출 → `pgErrorConstraint()` 치환
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `listMembers` DB `select`
  투영
- `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — 타입 개명
  (런타임 영향 없음)
- `codebase/backend/src/repo-guards/__tests__/{endpoint-path-conflict-wrap-guard.ts, user-entity-exposure-guard.ts, source-scan.ts}`
  — 신규 AST 가드 + `enclosingScopeName` 승격(테스트 전용, CI/로컬 게이트 시간에만 영향)
- `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — 반복 호출
  캐싱(이미 fix 반영됨)
- `.claude/test-stages.sh` — `cmd_build()` 에 타입체크 ratchet 2개 추가

## 발견사항

- **[INFO]** `listMembers` DB 레벨 `select` 투영 — 성능 개선(회귀 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`,
    `memberRepository.find({ where, relations: ['user'], select: { id, userId, role,
    joinedAt, user: { id, email, name } } })`)
  - 상세: 종전 `relations: ['user']` 단독은 `User` 전 컬럼(민감 7컬럼 포함)을 JOIN 으로 싣고
    이후 JS `.map` 으로 6키만 골랐다. 이번 변경은 `select` 를 함께 줘 TypeORM 이 단일 JOIN
    쿼리에서부터 필요한 컬럼만 가져오게 한다 — N+1 로 퇴화하지 않고(관계+select 조합은 여전히
    단일 쿼리), 네트워크·메모리로 올라오는 바이트 수만 줄어드는 순수 개선이다.
  - 제안: 조치 불요.

- **[INFO]** `resolveBuildFileNames()` 반복 호출 — 직전 라운드 지적이 이미 반영됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts`
    (`describe` 최상단 `const buildFiles = resolveBuildFileNames(backendDir);`, 그 아래
    캐너리 테스트와 `it.each([...])` 세 케이스가 공유)
  - 상세: 1라운드(`review/code/2026/09/08/12_53_08/performance.md` INFO)가 `it` 마다
    `tsconfig.build.json` 재파싱 + 800여 파일 glob 재해석이 반복된다고 지적했고, 이번 diff 는
    그 호출을 `describe` 최상단 1회로 접어 `it.each` 세 케이스(`repo-guards`/
    `shared/testing`/`__test-utils__`)가 공유하도록 고쳤다. 테스트 스위트 실행 시간만
    줄어드는 방향이라 회귀는 아니다 — 확인 기록.
  - 제안: 조치 불요(이미 반영됨).

- **[INFO]** `cmd_build()` 에 추가된 타입체크 ratchet 2개가 순차(`&&`) 실행된다
  - 위치: `.claude/test-stages.sh` `_cmd_typecheck_ratchets()`
    (`python3 .../check-backend-typecheck-ratchet.py && python3 .../check-frontend-typecheck-ratchet.py`),
    호출부는 `cmd_build()` 안 `_cmd_typecheck_ratchets &&`
  - 상세: 두 ratchet 은 서로 다른 패키지(`codebase/backend` vs `codebase/frontend`)의 독립적인
    전체-프로그램 `tsc` 타입체크이고 상호 의존이 없다. `cmd_build()` 는 이미 backend/frontend/
    channel-web-chat 각각의 `build`+`typecheck` 단계를 순차로 밟고 있어, 이번 추가는 로컬
    `run-test.sh build` wall-clock 시간을 늘리는 방향이다(CI 전용 게이트를 로컬로 당겨온
    의도된 트레이드오프이므로 결함은 아니다 — 3라운드 리뷰(`RESOLUTION.md`)도 이 항목을 다시
    지적하지 않았다).
  - 제안: 급하지 않음. 로컬 반복 빈도가 높다면 `&`+`wait`로 두 job 을 병렬화하고 실패 시
    어느 쪽인지 구분하는 로직만 추가하면 된다(1라운드 리뷰가 이미 낸 제안과 동일, 아직
    미반영이나 위험도상 defer 해도 무방).

- **[INFO]** 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 스캔 범위를 `modules/triggers`
  로 좁혀 O(파일 수) 로 유계
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
    (`findTriggerRepositorySaves`), 소비처
    `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts`
    (`const TRIGGERS_DIR = path.join(SRC_ROOT, 'modules', 'triggers')`)
  - 상세: `collectTsFiles(TRIGGERS_DIR)` 로 파일 목록을 좁힌 뒤 파일당 1회 `ts.createSourceFile`
    + 단일 AST walk 만 수행한다(형제 가드 `user-entity-exposure-guard.ts` 와 동일 패턴).
    `enclosingScopeName`(`source-scan.ts` 로 승격)도 노드의 부모 체인만 O(depth) 로 순회해
    추가 비용이 없다. 전 저장소(`src` 전체)를 스캔하지 않는 설계라 저장소가 커져도 이 가드의
    실행 시간은 트리거 모듈 크기에만 비례한다 — 테스트 전용이라 프로덕션 경로 영향도 없다.
  - 제안: 조치 불요.

- **[INFO]** `http-exception.filter.ts`/`integration-oauth.service.ts` 의 SoT 치환은 순수
  O(1) 리팩터
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` (`isUniqueViolation`
    로컬 함수 제거 → `isPostgresUniqueViolation` 사용), `codebase/backend/src/modules/integrations/integration-oauth.service.ts`
    (손-작성 `constraint = (err as …)?.constraint ?? …` 8줄 → `pgErrorConstraint(err)` 1줄,
    두 콜사이트)
  - 상세: 둘 다 예외 처리 경로(에러가 실제 발생했을 때만 실행)에서 옵셔널 체이닝 몇 단계를
    함수 호출로 옮긴 것으로, 호출 빈도·복잡도 모두 변화 없다. 예외 필터는 요청당 최대 1회만
    거치므로 hot-path 반복 비용과 무관하다.
  - 제안: 조치 불요.

## 요약

이번 번들에서 런타임 핫패스(요청 처리 경로)에 실질적으로 영향을 주는 변경은 `listMembers`
DB 투영 하나뿐이며, 이는 불필요한 컬럼 로드를 없애는 **개선**이지 회귀가 아니다(단일 JOIN
쿼리 유지, N+1 없음). 예외 필터·OAuth 서비스의 SoT 치환은 O(1) 속성 접근을 함수 호출로
옮긴 순수 리팩터로 성능 특성 변화가 없다. 신규 AST 가드와 `enclosingScopeName` 승격은
스캔 범위를 좁게 유지하고 반복 호출을 캐싱하는 등(1라운드 지적이 실제로 반영됨) 이 저장소의
기존 성능 관례를 잘 따른다. 유일하게 남은 경미한 사항은 `.claude/test-stages.sh` 의 두
typecheck ratchet 이 순차 실행되어 로컬 `build` 단계 시간을 늘리는 것인데, 이는 CI 전용
게이트를 로컬로 당겨온 의도된 트레이드오프이고 3라운드에 걸친 fix 사이클에서도 우선순위
있는 결함으로 재지적되지 않았다. Critical·Warning 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
