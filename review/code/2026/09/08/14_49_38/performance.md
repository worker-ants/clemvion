# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` DB 레벨 `select` 투영 — 순수 성능 개선(회귀 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` (`select: { id, userId, role, joinedAt, user: { id, email, name } }` 블록)
  - 상세: 종전 `relations: ['user']` 는 `User` 엔티티 전 컬럼(민감 7컬럼 포함)을 단일 JOIN 으로 로드한 뒤 JS `.map` 으로 6키로 좁혔다. 이번 변경은 `relations`+`select` 조합을 그대로 유지하면서 TypeORM 컬럼 투영을 추가해, 애초에 불필요한 컬럼이 네트워크·메모리로 올라오지 않는다. 여전히 단일 쿼리(JOIN)이며 N+1 로 퇴화하지 않는다. 목적은 보안(민감 컬럼 비적재)이지만 부수적으로 쿼리 payload 를 줄이는 성능 이점도 있다.
  - 제안: 조치 불요. 긍정적 변경으로 기록만 남긴다.

- **[INFO]** `production-build-devdep.spec.ts` — 이전 라운드에서 지적된 `resolveBuildFileNames()` 중복 호출이 이번 diff 에서 해소됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — `describe` 블록 최상단 `const buildFiles = resolveBuildFileNames(backendDir);` (기존 캐너리 테스트 및 `it.each(['repo-guards', 'shared/testing', '__test-utils__'])` 세 케이스가 이를 공유)
  - 상세: 직전 리뷰(`review/code/2026/09/08/12_53_08/performance.md` INFO#2)가 `it` 마다 `resolveBuildFileNames()`(내부에서 `tsconfig.build.json` 파싱 + 800여 파일 glob 재해석)를 독립 호출하던 것을 지적했는데, 이번 diff 가 `describe` 최상단으로 호출을 끌어올려 모든 `it`/`it.each` 케이스가 한 번 계산한 결과를 공유하도록 고쳤다. 테스트 스위트 실행 시간을 줄이는 방향의 개선이라 기록만 남긴다.
  - 제안: 조치 불요.

- **[INFO]** `endpoint-path-conflict-wrap.spec.ts` 신설 AST 가드 — 스캔 범위·캐싱 규율이 모두 양호
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts` (함수/블록: 최상위 `describe('\`endpoint_path\` 충돌 래핑 래칫', ...)` 안 `const files = collectTsFiles(TRIGGERS_DIR); const sites = findTriggerRepositorySaves(files, SRC_ROOT);`), 파서 로직은 `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (함수 `findTriggerRepositorySaves`)
  - 상세: 신규 AST 스캐너는 (1) 스캔 대상을 `src/modules/triggers` 로 좁혔고(전체 `src` 가 아님), (2) `describe` 최상단에서 파일 목록·스캔 결과를 한 번만 계산해 모든 `it` 가 공유한다 — 위 `production-build-devdep.spec.ts` 가 방금 고친 것과 같은 패턴을 처음부터 올바르게 적용했다. `findTriggerRepositorySaves` 는 파일당 1회 `ts.createSourceFile` + 1회 AST 순회로 O(파일 수 × 노드 수) 이고 중첩 스캔이 없다. 형제 가드(`user-entity-exposure-guard.ts`)와 동일한 구조라 새로운 패턴이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `cmd_build()` 에 타입체크 ratchet 두 개가 순차 추가 — 로컬 빌드 wall-clock 증가(의도된 트레이드오프)
  - 위치: `.claude/test-stages.sh:80-85` (`_cmd_typecheck_ratchets()`), 호출부 `.claude/test-stages.sh:95` (`cmd_build()` 안 `_cmd_typecheck_ratchets &&`)
  - 상세: `check-backend-typecheck-ratchet.py && check-frontend-typecheck-ratchet.py` 가 `&&` 로 순차 실행된다. 두 스크립트는 서로 다른 패키지의 독립적인 전체 프로그램 typecheck 이므로 상호 의존이 없어 원칙적으로 병렬화 가능하지만, `cmd_build()` 자체가 이미 backend/frontend/channel-web-chat build·typecheck 단계를 순차로 밟고 있어 이번 추가는 기존 패턴을 그대로 따른 것이다. CI 게이트를 로컬로 당겨 왔다는 명시적 트레이드오프(#1292 CI 전용 실패 재발 방지)이므로 결함이 아니다.
  - 제안: 급한 조치 불요. 로컬 반복 실행 빈도가 높아 체감 지연이 문제가 되면 `wait` 기반 병렬 실행 + 실패 쪽 구분 로직을 고려.

- **[INFO]** `tsconfig.build.json` exclude 확장(`**/__test-utils__/**`) — 프로덕션 빌드 스캔 범위 축소(개선)
  - 위치: `codebase/backend/tsconfig.build.json:20-35`
  - 상세: `__test-utils__/` 5개 파일이 이전에는 `tsconfig.build.json` include 대상이라 `nest build` 가 이들을 컴파일해 dist 에 실었다. 이번 exclude 추가로 프로덕션 `tsc` 컴파일 대상 파일 수가 줄어 빌드 시간·dist 크기가 소폭 감소한다. `production-build-devdep.spec.ts` 의 신규 `it.each` 케이스가 이 축소를 실측으로 고정한다.
  - 제안: 조치 불요.

## 요약

이번 배치(B-1~B-8)는 harness/문서/테스트 변경이 대부분이며, 런타임 핫패스(요청 처리 경로)에 실질적으로 영향을 주는 프로덕션 코드 변경은 두 곳뿐이다 — `http-exception.filter.ts`의 `isUniqueViolation` → `isPostgresUniqueViolation` 치환과 `integration-oauth.service.ts`의 손-작성 constraint 추출 → `pgErrorConstraint()` 치환은 둘 다 O(1) 속성 접근을 그대로 유지하는 순수 리팩터(SoT 통합)라 성능 특성 변화가 없다. `workspaces.service.ts`의 `listMembers` DB 레벨 `select` 투영은 오히려 불필요한 컬럼 로드를 없애는 성능 개선이며 여전히 단일 쿼리라 N+1 로 퇴화하지 않는다. 신설된 `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts` AST 스캐너는 스캔 범위를 `triggers` 모듈로 좁히고 `describe` 최상단에서 한 번만 계산해 공유하는 등 캐싱 규율을 처음부터 잘 지켰고, `production-build-devdep.spec.ts`는 직전 라운드에서 지적된 `resolveBuildFileNames()` 반복 호출 문제를 이번 diff 에서 실제로 고쳤다(테스트 스위트 실행 시간 개선). 유일하게 시간이 늘어나는 지점은 `.claude/test-stages.sh`의 `cmd_build()`에 순차 추가된 두 typecheck ratchet 인데, 이는 프로덕션 런타임이 아니라 로컬/CI 빌드 파이프라인 시간에만 영향을 주며 CI 전용 검사를 로컬로 당겨 오는 의도된 트레이드오프다. Critical·Warning 급 성능 결함은 발견되지 않았다.

## 위험도

NONE
