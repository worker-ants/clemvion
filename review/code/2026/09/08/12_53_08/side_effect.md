# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 매칭 조건이 앱 전체 범위로 넓어졌다 (`@Catch()` 전수 대상)
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`else if (isPostgresUniqueViolation(exception))`)
  - 상세: 삭제된 로컬 `isUniqueViolation`(옛 8~16번째 gate 라인, diff `-`)은 `err instanceof QueryFailedError` 를 **먼저** 요구했다. 신설 `isPostgresUniqueViolation`(`../db/pg-error.ts`)은 그 전제 없이 `typeof err === 'object'` 이고 `.code`/`.driverError.code === '23505'` 이기만 하면 매칭한다. `GlobalExceptionFilter` 는 `@Catch()` — 애플리케이션에서 처리되지 않은 **모든** 예외가 지나는 단일 지점이므로, 이 술어 변경은 국소 모듈이 아니라 앱 전역 catch-all 의 분기 조건을 넓힌 것이다. 즉 `QueryFailedError` 가 아닌 일반 `Error`(또는 plain object)라도 우연히 `code === '23505'` 를 갖고 있으면 이제 500 대신 409 로 응답한다.
  - 근거: B-3 이 의도한 정확한 수정(raw 표면 `err.code` 를 놓치던 결함 봉인)이고, 새 테스트 2건(`raw 표면 … 23505 도 409로 간다` / `raw 표면의 non-23505 는 409로 새지 않는다`)이 양쪽을 회귀 고정한다. 코드베이스 전수 검색(`grep -rn "23505"`) 결과 다른 서비스들은 이미 서비스 레벨에서 자체적으로 23505 를 가로채 `ConflictException` 으로 변환하므로, 이 필터까지 raw 하게 도달하는 새 진짜-네거티브 케이스는 실측상 없다(plan 의 "blast radius ~0" 주장과 일치). 다만 **의도된 변경이라도 catch-all 필터의 매칭 폭이 넓어졌다는 사실 자체는 부작용 관점에서 기록해 둘 가치가 있다** — 향후 다른 모듈이 `code` 프로퍼티를 가진 커스텀 에러 객체를 의도치 않게 이 필터까지 흘려보내면(예: 외부 SDK 에러 객체가 우연히 `.code` 필드를 가짐) 조용히 409 로 응답할 수 있다.
  - 제안: 현재로선 조치 불요(테스트로 고정되어 있고 실측 blast radius 0). 다음에 이 필터에 새 raw 표면 판별을 추가할 때는 같은 폭으로 넓히기 전에 "이 앱에서 `code` 프로퍼티를 갖는 비-DB 에러가 존재하는지" 를 함께 확인할 것.

- **[INFO]** `tsconfig.build.json` exclude 확장 — 프로덕션 소비처 부재를 실측으로 확인, 안전
  - 위치: `codebase/backend/tsconfig.build.json` (exclude 배열, `"**/__test-utils__/**"` 추가)
  - 상세: `**/__test-utils__/**` 를 build 대상에서 빼면 그 디렉터리를 **런타임에 import** 하는 프로덕션 코드가 있을 경우 `dist` 빌드가 깨지거나 런타임에 모듈을 못 찾는 부작용이 생길 수 있다. 저장소 전수 검색(`grep -rln "__test-utils__"`)으로 확인한 결과, 소비처는 전부 `src/shared/testing/**`·`src/repo-guards/__tests__/**`(이미 같은 exclude 목록에 있음) 안에만 있고 프로덕션 모듈에서의 import 는 0건이다. 부작용 없음으로 판정.
  - 제안: 조치 불요. 참고 기록.

- **[INFO]** `.claude/test-stages.sh`: `cmd_build()` 에 타입체크 ratchet 서브프로세스 2회 추가 — 상태 변경 없음, 실행 시간만 증가
  - 위치: `.claude/test-stages.sh:80` (`_cmd_typecheck_ratchets()`), `.claude/test-stages.sh:95` (`cmd_build()` 호출부)
  - 상세: 새 함수는 `python3 scripts/check-{backend,frontend}-typecheck-ratchet.py` 를 `--update` 없이 호출한다 — 두 스크립트 모두 `tsc`(read-only 서브프로세스)를 돌려 baseline JSON 과 diff 를 비교할 뿐 파일을 쓰지 않는다(코드 확인: `_typecheck_ratchet.py` 의 쓰기 경로는 `--update` 플래그 분기에만 있음). 즉 새로운 파일시스템 부작용은 없다. 유일한 관측 가능한 변화는 `cmd_build()` 총 실행 시간 증가(문서상 backend+frontend 각 ~60초)와, 이 단계가 실패하면 이후 `_cmd_build_docker_images` 가 실행되지 않는다는 순서 변경 — 둘 다 plan(B-1)이 의도한 결과다.
  - 제안: 조치 불요.

- **[INFO]** `workflow-versions.service.ts`: exported 타입 이름 변경(`WorkflowVersionDetail` → `WorkflowVersionDetailProjection`) — 소비처 0건 확인, 시그니처/런타임 영향 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (게이트 69, 타입 선언부) / `:152` (`findOne` 리턴 타입)
  - 상세: `grep -rn "WorkflowVersionDetail\b" codebase/backend/src` 로 확인한 결과 이 타입 이름을 참조하는 자리는 정의 파일 자신(JSDoc 내 텍스트 언급)뿐이고, `workflow-versions.controller.ts` 는 `this.workflowVersionsService.findOne(...)` 의 반환값을 타입 이름으로 참조하지 않고 추론에 맡긴다(구조적 타이핑이라 반환 shape 자체는 변경 없음). 백엔드 내부에 이 이름을 직접 import 하는 다른 파일은 없다. 프런트엔드의 동명 타입(`codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail`)은 별도 손-미러 선언이라 이번 개명의 영향을 받지 않는다(같은 PR 이 그 파일의 JSDoc 만 갱신). 공개 HTTP 계약(응답 wire shape)도 변경 없음 — 순수 내부 타입 식별자 리네임.
  - 제안: 조치 불요.

- **[INFO]** `workspaces.service.ts` `listMembers`: DB 쿼리에 `select` 투영 추가 — 로드되는 컬럼이 좁아짐(의도된 축소, 확대 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:225` (`select: {...}` 블록)
  - 상세: `relations: ['user']` 는 유지한 채 `select` 로 `id/userId/role/joinedAt` 과 중첩 `user: { id, email, name }` 만 로드하도록 좁혔다. 이는 이전에 전체 `User` 컬럼(비밀번호 해시 등 민감 7컬럼 포함)을 로드한 뒤 JS 단에서 걸러내던 것을 DB 레벨 투영으로 옮긴 것 — 노출 표면을 **줄이는** 방향의 변경이라 부작용 우려가 낮다. 함수의 반환 shape(`.map()` 결과)은 동일하게 유지되어 호출자(컨트롤러 등)에 영향 없음. `select`+`relations` 동시 지정이 TypeORM 에서 기대대로 동작하는지는 정확성(correctness) 리뷰 영역이라 여기서는 판정하지 않음.
  - 제안: 조치 불요(정확성 축은 별도 리뷰어 영역).

- **[INFO]** `review/consistency/2026/09/08/12_21_11/**` 8개 신규 파일 커밋 — 프로젝트 규약상 정상 산출물, 코드 부작용 없음
  - 위치: `review/consistency/2026/09/08/12_21_11/{SUMMARY.md,meta.json,_retry_state.json,cross_spec.md,convention_compliance.md,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: 전부 `new file mode 100644` 이고 기존 파일과 경로 충돌 없음. `--impl-prep` consistency-check 산출물을 `review/` 에 남기는 것은 CLAUDE.md 저장 위치 규약과 일치한다. 실행 코드가 아니므로 전역 상태·환경변수·네트워크 관련 부작용 없음.
  - 제안: 조치 불요.

## 뮤테이션 검증

이번 리뷰에서는 저장소 파일을 뮤테이션하지 않았다(정적 코드 리딩 + `grep`/`git status --short` 만 사용). 세션 종료 시 `git status --short` 확인 결과 이 리뷰가 남긴 잔여물은 없다(사전에 존재하던 `review/code/2026/09/08/12_53_08/` 산출물 디렉터리 외 변경 없음).

## 요약

핵심 변경 4건(B-3 전역 예외 필터 pg-error SoT 전환, B-4 `listMembers` DB 투영, B-1/B-2 typecheck ratchet 빌드 단계 편입 + tsconfig exclude 확장, B-8 백엔드 타입 개명)을 각각 blast-radius 관점에서 실측 검증했다 — 소비처 grep 전수 확인, 파일시스템 쓰기 경로 확인, exported 타입 참조 확인을 모두 거쳤으며 CRITICAL/WARNING 급 의도치 않은 부작용은 발견되지 않았다. 유일하게 주목할 만한 것은 `http-exception.filter.ts` 의 매칭 조건이 앱 전역 catch-all 필터 안에서 넓어졌다는 점인데, 이는 문서화된 의도적 수정이고 양방향 회귀 테스트로 고정돼 있으며 실측 blast radius 가 0이라 INFO 로 하향한다. 나머지 항목(tsconfig exclude, typecheck ratchet 서브프로세스 추가, 타입 리네임, DB select 투영, consistency 리뷰 산출물 커밋)은 전부 검증 결과 부작용 없음 또는 노출 표면을 줄이는 방향으로 확인됐다.

## 위험도

LOW
