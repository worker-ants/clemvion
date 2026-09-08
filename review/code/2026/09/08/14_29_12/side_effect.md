# 부작용(Side Effect) 코드 리뷰

## 사전 확인

이 배치는 이미 3차 `/ai-review`(`12_53_08`→`13_34_28`→`14_01_56`) + 4차 `--impl-done` consistency check 를 거쳤고, 이번 프롬프트 번들에는 그 이전 라운드들의 리뷰/컨시스턴시 산출물 자체(파일 27~110, `review/**`)도 diff 대상으로 포함돼 있다. 직전 라운드(`14_01_56`)의 `side_effect.md` 가 이미 지적한 두 항목(스크립트 docstring 이 `run-test.sh build` 편입 사실을 반영 못함 / `enclosingScopeName` 죽은 분기)이 이번 diff 에서 실제로 고쳐졌는지를 코드로 직접 재검증했다. 리뷰 도중 저장소에 어떤 파일도 쓰지 않았다 — `git status --short` 로 확인(본 세션이 만든 `review/code/2026/09/08/14_29_12/`·`review/consistency/2026/09/08/14_29_13/` 외 변경 없음, 다른 리뷰어의 뮤테이션 잔여물도 없음).

## 발견사항

- **[INFO]** `GlobalExceptionFilter`(전역 `@Catch()`, 모든 라우트 적용)의 unique-violation 판정이 `instanceof QueryFailedError` 요구 없는 덕타이핑으로 넓어졌다 — 재확인, 위험 낮음
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`} else if (isPostgresUniqueViolation(exception)) {`)
  - 상세: `pg-error.ts` 의 `isPostgresUniqueViolation`(→`pgErrorCode`)은 `typeof err === 'object'` 와 `.code`/`.driverError.code` 형태만 보는 순수 duck-typing 이라, `Error` 인스턴스조차 아닌 임의의 `{ code: '23505' }` 객체도 이 분기를 통과해 409 로 응답한다. 이 분기는 `catch()` 안에서 `instanceof HttpException` 다음·`instanceof Error` **이전**에 평가되므로, 우연히 `.code`(또는 `.driverError.code`) 가 `'23505'` 인 비-DB 예외가 던져지면 `instanceof Error` 분기가 하는 `logger.error`/`logger.warn` 로깅도 건너뛰고 조용히 409 로 응답한다 — 관측성 손실이 실제 위험의 형태다(오분류 자체보다 "그 오분류가 로그에 안 남는다"는 쪽). 직접 grep(`grep -rn "'23505'" codebase/backend/src`)한 결과 이 문자열을 쓰는 자리는 전부 실제 Postgres 판정 목적이라 현재 충돌하는 소비처는 없고, 회귀 테스트(`http-exception.filter.spec.ts:127-159`, gate 로 재확인)가 raw 표면 23505→409 / non-23505(23502)→500 양방향을 이미 고정해 뒀다. `@Catch()` 전역 등록(1개 필터가 앱 전체 예외를 받음)이라는 성격상 구조적으로는 "넓어진 표면"이지만, 실측된 blast radius 는 0이고 세 번의 이전 라운드가 이미 같은 결론에 도달했다 — 재상향할 새 근거는 찾지 못했다.
  - 제안: 현재 조치로 충분. 향후 `.code` 필드를 Postgres 와 무관한 의미로 쓰는 예외 객체 패턴이 새로 생기면 이 분기와 충돌할 수 있다는 점만 팀 컨벤션에 한 줄 남겨 둘 가치가 있다(이미 `pg-error.ts` 자체 JSDoc 에 "두 표면을 흡수한다"는 설계 의도가 적혀 있어 문서화 자체는 충분).

- **[INFO]** `_cmd_typecheck_ratchets()` 를 `cmd_build()` 안에 편입 — 로컬 `run-test.sh build` 단계의 실패 표면이 넓어짐, 대상 스크립트 자체 docstring 은 이번 diff 로 정정 완료(직전 라운드 WARNING 재검증 GREEN)
  - 위치: `.claude/test-stages.sh:80-85`(`_cmd_typecheck_ratchets` 신설), `:95`(`cmd_build()` 안 `_cmd_typecheck_ratchets &&` 호출) / `scripts/check-backend-typecheck-ratchet.py:35-39`, `scripts/check-frontend-typecheck-ratchet.py:38-42`(정정 블록)
  - 상세: `cmd_build()` 는 이 저장소에서 `run-test.sh build` 의 유일한 진입점(`grep -rn "cmd_build\b" .claude Makefile` 로 확인 — 다른 호출자 없음)이라 영향 범위가 그 한 스테이지에 국한된다. 직전 라운드(`review/code/2026/09/08/14_01_56/side_effect.md`)가 "`PROJECT.md` 는 갱신됐는데 대상 스크립트 자신의 '로컬에서 돌리는 법' docstring 은 여전히 `run-test.sh` 4단계에 없다고 적고 있다"고 WARNING 을 냈는데, 이번 diff 의 두 스크립트 파일(파일 109·110)이 정확히 그 문장을 취소선 + `정정 (2026-09-08)` 블록으로 갈아 실제 코드와 문서가 다시 일치한다 — 코드로 직접 대조해 확인. `&&` 순차 체이닝이라 backend ratchet 이 실패하면 frontend ratchet 은 그 실행에서 평가되지 않는데(둘 다 실패해도 한쪽만 보고됨), `cmd_build()` 의 다른 모든 단계도 이미 같은 `&&` 관례를 쓰고 있어 이번 추가가 새로 도입한 패턴은 아니다.
  - 제안: 조치 불요(재검증 완료). 두 ratchet 이 실패 시 실패 스크립트만 보고되는 성질(`&&` fail-fast)은 기존 `cmd_build()` 관례와 일관되므로 심각도 낮음.

- **[INFO]** `tsconfig.build.json` 에 `**/__test-utils__/**` exclude 추가 — 빌드 산출물(dist) 구성이 축소되는 빌드타임 부작용, 프로덕션 참조 부재 직접 확인
  - 위치: `codebase/backend/tsconfig.build.json:20-28`
  - 상세: `grep -rl "__test-utils__" codebase/backend/src --include="*.ts" | grep -v -E "(\.spec\.ts$|__test-utils__/|__tests__/)"` 를 직접 실행한 결과 `src/shared/testing/pg-error-fixtures.ts` 한 곳만 `__test-utils__` 를 import 하는데, 이 파일 자체가 이미 상위 exclude 패턴(`src/shared/testing/**`)으로 빌드 대상에서 빠져 있어 dist 에 실리지 않는다. 즉 이번 exclude 로 dist 에서 사라지는 어떤 파일도 "빌드에 남는 프로덕션 코드"가 참조하지 않는다 — 런타임 `require()` 실패로 이어질 자리 없음.
  - 제안: 없음(검증 완료).

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` — export 타입 rename(시그니처 축), 저장소 내 호출자 영향 없음 확인
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70`(선언), `:153`(`findOne` 반환 타입)
  - 상세: `grep -rn "WorkflowVersionDetailProjection" codebase/backend/src --include="*.ts"` 결과 선언 자리와 반환 타입 자리 두 곳뿐이고, 컨트롤러(`workflow-versions.controller.ts:81`, `return this.workflowVersionsService.findOne(...)`)는 이 타입을 이름으로 직접 참조하지 않고 반환값을 그대로 넘기므로 rename 에 영향받지 않는다. 프런트엔드의 동명 미러 타입(`codebase/frontend/src/lib/api/workflows.ts`)은 원래도 별도 선언(공유 타입 패키지 미경유)이라 이 rename 이 그쪽 타입 정의나 wire 계약을 바꾸지 않는다 — JSDoc 갱신만 있고 필드 변화 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** `WorkspacesService.listMembers` — 쿼리에 `select` 투영 추가, 시그니처(반환 타입)·wire 응답 불변 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`(쿼리), `:233-240`(`.map` 반환)
  - 상세: `relations: ['user']` 를 유지한 채 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 를 추가했다. 메서드 반환 타입(`Array<{ id, userId, email, name, role, joinedAt }>`)과 `.map` 매핑은 diff 전후 동일 — 함수 시그니처·응답 wire 계약 모두 불변이고, DB 레벨에서 `User` 민감 컬럼이 애초에 로드되지 않도록 좁히는 방어 심화다. `select`+`relations` 동시 지정이 TypeORM 에서 유효한 조합인지는 이 배치의 신규 단위 테스트(`workspaces.service.spec.ts` gate 1177-1196, `select.user` 가 boolean 이 아니라 객체인지 단언)로 이미 고정돼 있다.
  - 제안: 없음(확인 완료).

- **[INFO]** 신규 repo-guard(`endpoint-path-conflict-wrap-guard.ts`)는 읽기 전용 AST 스캔 — 전역 변수·env·네트워크·파일 쓰기 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`(신설, 168줄)
  - 상세: `grep -n "writeFile\|process.env\|global\.\|globalThis\."` 결과 0건 — 형제 가드(`user-entity-exposure-guard.ts`)와 같은 성격(테스트 시점에 소스 파일을 `fs.readFileSync` 로 읽어 AST 만 검사)이라 부작용 표면을 새로 열지 않는다.
  - 제안: 없음(확인 완료).

- **[INFO]** `enclosingScopeName` 승격 시 넣었던 죽은 분기(`isFn` 우선순위)가 이번 diff 에서 실제로 삭제됨을 코드로 재확인
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts`(`enclosingScopeName`, `enclosingName` 대체)
  - 상세: 직전 라운드(`review/code/2026/09/08/14_01_56`)가 뮤테이션으로 "초기자가 함수인 변수를 우선"하는 분기가 죽은 코드임을 실측했고, RESOLUTION.md(파일 59, W1)가 "지웠다"고 서술한다. 파일을 직접 열어 확인한 결과 현재 구현은 `fallback` 변수 하나만 유지하며 형제 가드의 원래 알고리즘(메서드/함수/getter 우선 → 가장 가까운 변수 → `'<module>'`)과 동일하다 — 서술과 실제 코드가 일치하고 새로 만든 부작용 없음.
  - 제안: 없음(확인 완료).

## 요약

이번 배치(B-1~B-8 + 3차 리뷰 fix 누적분)에서 전역/공유 상태를 예상 밖으로 바꾸는 결함, 새 전역 변수 도입, 의도치 않은 파일 생성·삭제, 환경 변수 read/write, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다. 유일하게 구조적으로 "넓어지는" 변경은 전역 `@Catch()` 필터의 unique-violation 판정(덕타이핑 확장)인데, 세 차례의 독립 리뷰가 동일하게 실측 blast radius 0·양방향 회귀 테스트 존재로 수렴했고 이번 재검토에서도 새로 뒤집을 근거를 찾지 못했다(관측성 손실 가능성만 INFO 로 재기록). `cmd_build()` 에 타입체크 ratchet 2개를 편입한 것은 로컬 `build` 스테이지의 실패 표면을 넓히는 의도된 변경이며, 직전 라운드가 지적한 "대상 스크립트 자신의 docstring 이 그 사실을 반영 못한다"는 WARNING 은 이번 diff(`scripts/check-{backend,frontend}-typecheck-ratchet.py`)로 실제로 해소됐음을 코드 대조로 확인했다. `tsconfig.build.json` exclude 확장·`WorkflowVersionDetail` rename·`listMembers` DB 투영은 모두 시그니처·wire 계약을 바꾸지 않거나(후자 둘) 프로덕션 참조가 없음(전자)을 grep 으로 직접 재검증했다. 신규 repo-guard 는 읽기 전용이라 부작용 표면이 없고, 이전 라운드가 지적한 죽은 코드 분기도 실제로 제거되어 있다. 리뷰 수행 중 저장소 파일을 뮤테이션하지 않았다.

## 위험도

LOW
