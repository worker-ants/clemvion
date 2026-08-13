# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 확인

`--impl-done` 모드, scope=`spec/5-system/`, diff-base=`origin/main`. 실제 `git diff origin/main...HEAD`
(HEAD 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434` 기준,
절대경로로 직접 확인)를 보면 **이번 라운드는 `spec/5-system/` 하위 파일을 전혀 변경하지 않는다.**
변경분은 다음으로 구성된다.

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 유틸)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
- `plan/in-progress/ie-resume-turn-boundary-cancel.md` (소급 정정 배너 추가)
- `plan/in-progress/update-returning-tuple-shape.md` (신규 plan)
- `review/code/**`, `review/consistency/**` (직전 라운드 산출물)

즉 `TypeORM UPDATE/DELETE RETURNING` 이 `[rows, rowCount]` 튜플로 온다는 사실을 놓쳐 7개 지점이
행 배열로 오취급하던 버그를 고치는 순수 백엔드 버그픽스이며, target 인 `spec/5-system/**` 문서 자체는
이번 diff 의 대상이 아니다. 새 plan 의 frontmatter 는 `spec_impact: none` 을 명시하고 있고, 본문에도
"이 PR 이 실제로 바꾸는 spec 은 0건" 이라고 스스로 밝혀 두었다 — spec 미변경이 누락이 아니라 의도임을
확인했다.

## 발견사항

정식 규약(`spec/conventions/**`) 관점에서 이번 diff 가 신규로 위반하는 항목은 없다.

- **명명 규약**: 신규 식별자는 `updateReturningRows` / `update-returning-rows.ts` 뿐이며 REST endpoint·
  DTO·audit action·에러 코드 등 `spec/conventions/**` 가 명명 규칙을 두는 범주에 속하지 않는다
  (`audit-actions.md`, `error-codes.md`, `cafe24-api-metadata.md` 등 어느 것도 내부 유틸 함수명을
  규율하지 않음). 위반 없음.
- **출력 포맷 규약**: API 응답·WS 이벤트 페이로드·에러 코드 신설/변경 없음. 이번 diff 가 쓰는
  `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS`/`OAUTH_STATE_MISMATCH` 는 모두 기존 코드이며
  포맷 변경이 없다. `error-codes.md` §4(내부 전용 분류 코드)도 Code 노드 핸들러 한정이라 이번 변경
  (일반 `Error` throw)과 무관. 위반 없음.
- **문서 구조 규약**: target 인 `spec/5-system/**` 문서 본문이 이번 diff 로 변경되지 않았으므로
  Overview/본문/Rationale 3섹션 구조에 대한 신규 위반 표면이 없음. 신규 plan 문서
  (`plan/in-progress/update-returning-tuple-shape.md`)는 `spec/conventions/**` 가 아니라
  `.claude/docs/plan-lifecycle.md` 관할이라 본 checker 범위 밖.
- **API 문서 규약(Swagger/DTO)**: 이번 diff 는 controller/DTO 를 건드리지 않는다. 위반 없음.
- **금지 항목**: `spec/conventions/**` 전체를 훑어도(`grep -rl "RETURNING\|rowCount\|assertRowArray"`)
  raw UPDATE/DELETE 결과 shape 처리에 관한 기존 규약이 없다 — 즉 이번에 고친 패턴 자체를 금지하거나
  요구하는 기존 정식 규약이 없으므로 "규약 위반" 으로 등급을 매길 근거가 없다. 신규 plan 문서도 이
  공백을 스스로 인지해 "regex 대신 AST 로" 및 "`updateReturningRows` 경유를 정식 규약으로 승격할지"
  를 **planner 위임 후속**으로 명시적으로 남겨 두었다(developer 는 `spec/` 쓰기 권한이 없어 이번 PR
  범위 밖이라는 점도 정확히 인지).

## 참고 (등급 없음 — 이미 자체 추적됨)

- **[INFO] 재발 패턴에 대한 정식 규약 부재 — 이미 백로그화됨**
  - target 위치: N/A (spec 문서 아님, `plan/in-progress/update-returning-tuple-shape.md` "## 후속" 절)
  - 위반 규약: 없음 (규약 신설 여부의 판단 자체가 이번 항목)
  - 상세: 같은 클래스의 결함(`agent-memory-admin`/`stuck-document-recovery`/이번 7곳)이 반복됐는데
    "raw UPDATE/DELETE RETURNING 은 `updateReturningRows` 경유" 를 강제하는 `spec/conventions/**`
    항목이 없다. 이는 이번 PR 이 새로 만든 갭이 아니라 기존에 없던 것이고, plan 문서가 이미
    `[planner 위임]` 으로 정확히 분류해 두었다.
  - 제안: 이번 검토가 새로 요구할 조치는 없음 — project-planner 턴에서 `spec/conventions/` 신설
    여부를 판단하면 됨(이미 plan 에 기록됨). CRITICAL/WARNING 으로 올릴 근거 없음.

## 요약

이번 라운드의 diff 는 `spec/5-system/` 문서를 전혀 변경하지 않는 순수 백엔드 버그픽스(TypeORM
UPDATE/DELETE `RETURNING` 이 `[rows, rowCount]` 튜플로 오는 것을 7개 지점이 행 배열로 오취급하던
결함 수정)이며, 새 plan 의 `spec_impact: none` 선언도 `spec-impl-evidence.md` 의 no-op sentinel
형식을 정확히 따른다. 신규 식별자·에러 코드·API 응답 포맷·문서 구조 어느 축에서도 `spec/conventions/**`
위반이 관측되지 않았고, 유일하게 남는 "정식 규약 공백"(raw query result 처리 패턴)은 이미 plan
문서가 planner 위임 후속으로 정확히 기록해 둔 상태다.

## 위험도
NONE
