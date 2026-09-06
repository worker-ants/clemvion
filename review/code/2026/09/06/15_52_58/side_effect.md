# 부작용(Side Effect) 리뷰

## 검토 방법 메모

프롬프트 번들(200+ 파일)의 대다수는 이전 9차례 `/ai-review`·`/consistency-check` 라운드(`10_13_22`~`15_30_59`)가 남긴 `review/**` 산출물이며 이번 diff 의 실질 코드가 아니다. `git diff --stat origin/main...HEAD -- codebase/` 로 실제 코드 변경 20개 파일을 확인하고, `git log --oneline origin/main..HEAD` 로 이 브랜치의 커밋 이력을 확인했다. **가장 최근 커밋(`fc6208adb`, 15:52:49)** 이 직전 라운드(`15_30_59`, 15:30:59 산출) 이후 유일하게 추가된 커밋이므로, 그 diff 를 직접 열어 신규 부작용 여부를 확인하는 데 집중했다:

- `.claude/hooks/_lib/review_guard.py` — `_strip_comment` 의 **docstring 문구만** 정정(따옴표 유무 분기 서술을 실제 코드와 일치시킴). 실행 로직(`if quote: ... else: ...` 분기)은 문자 그대로 동일 — `git show fc6208adb -- .claude/hooks/_lib/review_guard.py` 로 직접 대조.
- `.claude/tests/test_review_guard.py` — 회귀 테스트 1건 추가(단일값/인라인 리스트 형태의 인용+주석 조합). 순수 추가, 기존 테스트 제거·변경 없음.
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 기존 `it.each` 2-case 를 `(method × surface)` 4-case 로 확장(테스트 전용, 프로덕션 코드 무변경).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 후속 항목 등재(문서, 코드 아님).

나머지 프로덕션 코드(`triggers.service.ts`, `workflow-versions.service.ts`, `pg-error.ts`, `workspace-response.dto.ts`, `user-entity-exposure-guard.ts`, `user-secret-absence.ts` 등)는 직전 라운드(`15_30_59/side_effect.md`)가 이미 시그니처 변경·전역 상태·파일시스템/네트워크 호출 관점에서 상세 검증했고, 이번 커밋에서 그 파일들에 변경이 없음을 `git diff --stat` 로 재확인했다 — 아래 "이전 라운드 재확인" 항목으로 요약만 반복한다. 저장소 뮤테이션은 가하지 않았다(`git status --short` — 이번 세션 산출물 디렉터리만 untracked).

## 발견사항

- **[INFO]** `review_guard.py::_strip_comment` 변경은 docstring 정정뿐 — 실행 경로(spec-link 판정 결과)에 영향 없음
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_strip_comment` 함수(내부 `def` — 파일 내 유일 정의, 소스에서 `grep -n "def _strip_comment"` 로 위치 확인 가능)
  - 상세: 직전 라운드(`15_30_59`)가 인용 스칼라 분기(`if quote: ...`)를 이미 추가했고, 그 로직은 이번 커밋에서 한 글자도 바뀌지 않았다. 바뀐 것은 함수 docstring 첫 줄뿐이다("따옴표 없는 스칼라의" → "따옴표 유무로 갈라"). 이 함수는 push 게이트(`--impl-done` SPEC-CONSISTENCY)의 spec-link 판정에 쓰이는 공유 함수라 원래는 side-effect 관점에서 주시해야 하지만, 이번 diff 는 판정 결과를 바꾸는 로직 변경이 아니므로 게이트 동작에 새 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** 이전 라운드가 확인한 항목들의 재확인 — 이번 커밋에서 재발·추가 변경 없음
  - `TriggersService.create`/`update` 의 `save().catch(rethrowEndpointPathConflict)` — 특정 UNIQUE 위반만 `ConflictException` 으로 좁혀 변환하고 그 외는 `throw err` 로 원본 재던짐(삼키지 않음). 이번 커밋은 이 파일(`triggers.service.ts`, 비-spec)을 건드리지 않았고, `.spec.ts` 쪽만 표면 축(`driverError`/`top`)을 추가해 관측 커버리지를 넓혔다.
  - `WorkflowVersionsService.findOne` 반환 타입 축소(`Promise<WorkflowVersion>` → `Promise<WorkflowVersionDetail>`) — 유일 호출자(컨트롤러)에 명시적 반환 타입 애너테이션이 없어 컴파일 영향 없음, wire 형태는 민감 컬럼 제거 방향으로 좁아짐. 이번 커밋에서 무변경.
  - `WorkspaceMemberDto.joinedAt` 추가 — 이미 나가던 값(`WorkspacesService.listMembers` 는 이 브랜치 전체에서 로직 미변경)에 스키마만 뒤늦게 붙인 추가적(additive) 변경. 이번 커밋에서 무변경.
  - 신규 가드 3종(`user-entity-exposure-guard.ts`/`dto-jsdoc-citation-guard.ts`/`user-secret-absence.ts`)은 파일시스템 쓰기·`process.env`·네트워크 호출이 없는 읽기 전용 정적 분석/문자열 스캔임을 이전 라운드가 grep 전수 확인했고, 이번 커밋은 이 파일들을 건드리지 않았다.
  - 제안: 조치 불요 — 새로 지적할 것 없음.

## 요약

이번 라운드에서 실질적으로 검토할 신규 코드는 `review_guard.py` 의 docstring 한 줄 정정과 두 테스트 파일(`test_review_guard.py`, `triggers.service.spec.ts`)의 회귀 커버리지 확장뿐이며, 셋 다 실행 로직·공개 시그니처·전역 상태·파일시스템/네트워크 호출에 어떤 변화도 일으키지 않는다(순수 문서 정정 + 테스트 전용 확장). 그 외 프로덕션 코드(트리거 UNIQUE 충돌 처리, `WorkflowVersionsService.findOne` 투영, `WorkspaceMemberDto.joinedAt`, 신규 검출 가드 3종)는 직전 라운드(`15_30_59`)에서 이미 상세 검증됐고 이번 커밋에서 무변경임을 `git diff --stat`/`git show` 로 재확인했다. 신규 부작용은 발견되지 않았다.

## 위험도

NONE
