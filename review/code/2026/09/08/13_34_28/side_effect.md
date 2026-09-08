# 부작용(Side Effect) 코드 리뷰

## 검증 방법

정적 코드 리딩 외에 실제 저장소 파일을 열어 참조/영향 범위를 직접 확인했다(저장소 뮤테이션
없음, 종료 시점 `git status --short` 로 확인 — untracked 는 이 리뷰 세션 디렉터리들뿐):

- `grep -rn "WorkflowVersionDetail\b"` 로 백엔드 전체에서 개명 대상 타입의 잔여 참조를 확인
- 컨트롤러(`workflow-versions.controller.ts`)가 반환 타입을 명시 참조하지 않고 추론에 의존함을 확인
- `pg-error.ts` (이번 diff 밖의 기존 SoT 파일)의 실제 구현을 열어 `isPostgresUniqueViolation`/
  `pgErrorConstraint` 의 판정 범위를 직접 확인
- `git diff origin/main..HEAD --stat -- codebase/backend/src/common/db/pg-error.ts` 로 SoT 파일
  자체는 이번 배치가 건드리지 않았음을 확인
- 저장소 전체에서 `code === '23505'`/`code: '23505'` 를 다루는 다른 서비스 5곳
  (`workflow-test-datasets.service.ts`·`nodes.service.ts`·`auth.service.ts`·
  `auth-oauth.service.ts`·`workspace-invitations.service.ts`)을 열어, 전역 필터 판정 확장이
  이들과 충돌하는 살아있는 경로가 있는지 확인
- `.claude/test-stages.sh` 전체와 `endpoint-path-conflict-wrap-guard.ts`(AST 스캐너, `fs.readFileSync`
  read-only 확인)를 직접 열어 새 코드의 부작용 표면을 확인

## 발견사항

- **[INFO]** 전역 예외 필터(`@Catch()`)의 unique-violation 판정 범위가 앱 전체로 넓어졌다 — 의도된 수정이나 "이벤트/콜백 트리거 조건 변경" 축에서 기록할 가치가 있다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`} else if (isPostgresUniqueViolation(exception)) {`)
  - 상세: `GlobalExceptionFilter` 는 `@Catch()` 데코레이터로 **애플리케이션 전체의 처리되지 않은 모든 예외**를 가로채는 단일 전역 컴포넌트다. 종전 로컬 `isUniqueViolation`(삭제됨)은 `err instanceof QueryFailedError` 를 먼저 요구했는데, 새로 배선된 `isPostgresUniqueViolation`(`../db/pg-error.ts`, 이번 diff 가 건드리지 않은 기존 SoT)은 `err` 가 객체이고 `.code` 또는 `.driverError.code` 가 `'23505'` 이기만 하면 참이다 — `Error`/`QueryFailedError` 여부를 전혀 묻지 않는다. 즉 이제 코드베이스 어디선가 `Error` 가 아닌 임의의 plain object 를 `throw` 하면서 우연히 `code: '23505'` 프로퍼티를 갖고 있으면(실제 Postgres 에러가 아니어도) 이 전역 분기가 409 `RESOURCE_CONFLICT` 로 응답한다. 이는 국소 처리가 없는 **모든** 컨트롤러/서비스 경로에 걸리는 전역 동작 변경이다. 다만 실측 확인 결과: (1) 같은 SQLSTATE 를 로컬에서 다루는 5개 서비스(`workflow-test-datasets.service.ts`·`nodes.service.ts`·`auth.service.ts`·`auth-oauth.service.ts`·`workspace-invitations.service.ts`)는 전부 실제 DB 에러(TypeORM `Repository.save/find` 경유, 곧 `QueryFailedError` 로 wrap됨)만 다루고 있어 이 전역 분기와 충돌하는 non-Error 객체를 만들지 않는다, (2) `CHANGELOG.md`·plan 이 "우리 스키마를 치는 raw query 가 요청 경로에 없다"로 blast radius 를 명시적으로 0 으로 실측·기록했고, (3) 회귀 테스트(`http-exception.filter.spec.ts` 신규 2건)가 확장 방향(23505→409)과 비확장 방향(23502→500) 둘 다 캐너리로 고정했다. 새로운 위험을 만들지는 않지만, "전역 필터의 매칭 폭이 넓어졌다"는 사실 자체는 이 배치 밖의 향후 코드가 `code`/`driverError.code` 프로퍼티를 가진 비-Postgres 객체를 던지는 패턴을 도입할 경우의 잠재적 충돌점이라 기록해 둔다.
  - 제안: 현재 조치로 충분(이미 CHANGELOG·회귀 테스트로 고정됨). 추가 조치는 불요.

- **[INFO]** `.claude/test-stages.sh` `cmd_build()` 의 pass/fail 계약이 두 typecheck ratchet 스크립트의 성공 여부까지 포함하도록 넓어졌다
  - 위치: `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()` 함수와 `cmd_build()` 안의 `_cmd_typecheck_ratchets &&` 호출
  - 상세: `cmd_build` 는 이전에는 각 패키지의 `pnpm build`/`typecheck`/`_run_internal build`/`_cmd_build_docker_images` 성공 여부만으로 exit code 가 결정됐다. 이번 변경으로 `python3 scripts/check-backend-typecheck-ratchet.py`·`check-frontend-typecheck-ratchet.py`(이번 diff 가 건드리지 않은 기존 스크립트, CI 워크플로에서 이미 쓰이던 것) 두 개가 `&&` 체인에 추가돼, 두 스크립트 중 하나라도 비제로면 로컬 `run-test.sh build` 전체가 실패하게 됐다. 두 스크립트는 `--update` 플래그 없이 호출되므로 baseline 파일에 쓰기(fs 부작용)는 일어나지 않는다 — 순수 read+비교, exit code 만 반환. 이는 CI 게이트를 로컬로 당겨오는 의도된 변경이고 PROJECT.md·plan 에 명시적으로 문서화됐다. 부작용 관점에서 유일한 주목점은 "빌드 실패"의 **원인 표면**이 늘어났다는 것 — `cmd_build` 를 호출하는 다른 자동화(harness 등)가 있다면 실패 사유 분류 로직에 영향을 줄 수 있으나, 저장소 안에서 `cmd_build` 를 직접 호출하는 다른 소비처는 `run-test.sh` 하나뿐임을 확인했다.
  - 제안: 조치 불요(문서화·검증 완료).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 export 된 타입 식별자 변경이나, 실측상 파급 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:69`(선언), `:152`(`findOne` 반환 타입 시그니처)
  - 상세: 이 타입은 모듈에서 `export type` 으로 노출되는 공개 식별자라 원칙적으로 "인터페이스 변경" 축에 해당하지만, `grep -rn "WorkflowVersionDetail\b" codebase/backend/src --include="*.ts"` 로 직접 확인한 결과 이 파일의 선언·JSDoc 두 곳 외에는 어떤 `.ts`/`.spec.ts` 파일도 이 심볼을 import/참조하지 않는다. `workflow-versions.controller.ts` 는 `WorkflowVersionsService` 클래스만 import 하고 `findOne` 의 반환 타입은 TypeScript 추론에 맡기므로(`return this.workflowVersionsService.findOne(...)` — 명시적 타입 표기 없음) 컴파일 타임 파급이 없다. 프런트엔드의 동명 타입(`codebase/frontend/src/lib/api/workflows.ts` `WorkflowVersionDetail`)은 별도 손-미러 선언이라 이번 개명과 무관하게 그대로 존재한다(JSDoc 만 갱신).
  - 제안: 조치 불요(확인 완료).

- **[INFO]** `listMembers` 쿼리 옵션에 `select` 투영 추가 — 함수 시그니처·응답 wire 계약은 불변
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` (`listMembers`)
  - 상세: `memberRepository.find()` 호출 옵션에 `select` 절이 추가돼 DB 레벨에서 로드되는 컬럼이 좁혀졌으나, `listMembers` 의 매개변수·반환 타입(`Promise<Array<{ id, userId, email, name, role, joinedAt }>>`)과 이후 `.map()` 매핑은 전혀 바뀌지 않았다. `where: { workspaceId }` 는 `select` 절에 `workspaceId` 가 없어도 TypeORM 이 WHERE 절 생성에 내부적으로 사용하므로(선택되지 않은 컬럼이라도 필터링에는 영향 없음) 쿼리 결과 집합이 달라지지 않는다. 시그니처·호출자 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 `fs.readFileSync` 로만 소스를 읽는 순수 정적 분석 — 프로덕션 코드 경로에 배선되지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (`findTriggerRepositorySaves`), 소비처 `endpoint-path-conflict-wrap.spec.ts`
  - 상세: `fs`/`path`/`typescript` 만 사용하며 파일 쓰기·네트워크·환경변수 접근이 없다. `SRC_ROOT`(`path.resolve(__dirname, '..', '..')`)는 이 파일이 `src/repo-guards/__tests__/` 에 위치하므로 `src/` 로 정확히 해석됨을 직접 확인했다. 테스트 스위트에서만 호출되며 런타임 서버 코드 경로와 무관하다.
  - 제안: 조치 불요.

- **[정보/확인]** 커밋에 함께 포함된 `review/code/2026/09/08/12_53_08/**`·`review/consistency/2026/09/08/12_21_11/**`·`review/consistency/2026/09/08/13_22_38/**` (총 33개 파일)는 신규 파일 생성이지만, 이 프로젝트 관례상 `review/**` 는 gitignore 대상이 아니라 이전 라운드의 리뷰/일관성 검토 산출물을 커밋에 포함하는 정상 워크플로다(`git diff origin/main..HEAD --stat` 로 51개 파일 전체 대조, 예상 밖 파일 없음). 부작용 관점에서 우려되는 "예상치 못한 파일 생성"에 해당하지 않는다.

## 요약

이번 diff(배치 B, `03f665c63`~`05b899d1f`, `origin/main` 대비 51개 파일)에서 CRITICAL/WARNING 급 부작용은 발견되지 않았다. 유일하게 "부작용" 관점에서 무게 있게 볼 지점은 `GlobalExceptionFilter` 의 unique-violation 판정이 `instanceof QueryFailedError` 요구를 제거해 앱 전체 예외 경로에 걸리는 전역 이벤트 핸들러의 매칭 폭이 넓어졌다는 것인데, 저장소 안의 유사 패턴 5곳을 직접 열어 대조한 결과 실제로 충돌하는 살아있는 경로는 없었고, 저자 스스로 blast radius 를 실측(0)해 CHANGELOG 에 남겼으며 양방향 회귀 테스트로 고정했다. `cmd_build()` 에 typecheck ratchet 두 개를 추가한 것은 로컬 빌드의 실패 조건을 넓히는 의도된 변경이고 fs 쓰기 부작용은 없다(baseline 갱신 플래그 미전달). `WorkflowVersionDetail` 타입 개명은 grep 으로 잔여 참조 0 건을 직접 확인했고, `listMembers` 의 DB 투영은 시그니처·wire 계약을 그대로 유지한다. 신규 AST 가드는 read-only 정적 스캔이라 프로덕션 부작용이 없다. 함께 커밋된 리뷰 산출물 다수는 프로젝트 관례에 부합하는 정상적인 워크플로 파일이다.

## 위험도

LOW
