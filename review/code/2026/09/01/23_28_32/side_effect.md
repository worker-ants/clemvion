# 부작용(Side Effect) 코드 리뷰

## 검토 범위

이번 changeset(112개 파일)의 실질 코드 변경은 4개 파일뿐이다 — `.claude/hooks/_lib/plan_guard.py`
(정규식 확장), `.claude/tests/test_plan_guard.py`(대응 테스트), `codebase/frontend/src/lib/docs/__tests__/
spec-links.test.ts`(fixture 보강), `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규
테스트 파일). 나머지는 `codebase/backend/src/nodes/core/error-codes.ts`(주석-only), `spec/conventions/
error-codes.md`·`.claude/docs/plan-lifecycle.md`(문서 서술 추가), `plan/**`(체크박스/도구 잔재 정리),
`review/code/**`·`review/consistency/**`(과거 라운드 세션 산출물 커밋)로, 실행 경로에 영향을 주지 않는다.
이 changeset 은 이미 3라운드의 코드 리뷰(`22_25_37`/`22_44_29`/`23_09_35`)를 거쳤고, 그 side_effect
리포트들이 남긴 주장을 소스 추적으로 독립 재검증했다 — 재검증 결과는 아래에 기록한다.

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 확인했으나 문제 없음 (근거 기록 — 독립 재검증)

- **`plan_guard.py` `_CHECKBOX`/`_QUOTED` 정규식 확장의 blast radius를 직접 추적**
  - 위치: `.claude/hooks/_lib/plan_guard.py:95`(`_CHECKBOX` 정의), `:98`(`_QUOTED` 정의), `:248-286`
    (`_all_checkboxes_done`), `:320`(유일 호출부), `:341-345`(`push_blocks` property)
  - 상세: `_CHECKBOX`/`_QUOTED` 는 모듈 전역 `re.compile` 상수이며 저장소 전체에서 `_all_checkboxes_done`
    한 곳에서만 쓰인다(재확인). 이 함수의 반환값은 `evaluate_plan()` 안에서 `complete_pending` 리스트를
    만드는 데만 쓰이고, `complete_pending` 은 `PlanDecision.complete_but_in_progress` 필드로만 흘러간다.
    push 하드 블록을 결정하는 `push_blocks` 프로퍼티는 `return self.untouched` 이고, `untouched` 는
    `handled`(plan 파일이 diff 에 있는지) 로만 결정되며 `complete_pending`/`_all_checkboxes_done` 과는
    독립이다(`plan_guard.py:341-345`, `:323-339` 직접 대조). 즉 이번 정규식 확장의 최대 영향은 Stop
    훅의 소프트 넛지 문구뿐이고 `git push` 하드 블록에는 영향이 없다 — 3라운드 side_effect 리포트의
    동일 주장을 코드로 재추적해 일치를 확인했다.
  - `_all_checkboxes_done` 의 새 비대칭 로직(열린 항목은 인용문 안이어도 카운트, 닫힌 항목은 자기 것만
    카운트)에 대응하는 테스트 6종(`test_open_checkbox_inside_blockquote_counts`,
    `test_nested_blockquote_open_checkbox_counts`, `test_narrative_bracket_mention_is_not_a_checkbox`,
    `test_quoted_done_checkbox_alone_is_not_completion`, `test_own_done_plus_quoted_done_is_completion`,
    `test_quoted_open_still_vetoes_alongside_own_done`)이 전부 `tempfile.TemporaryDirectory()` 기반이라
    저장소 트리에 부작용이 없다(`.claude/tests/test_plan_guard.py:265-345` 직접 열람 확인).

- **`stray-tool-tags.test.ts`(신규 파일) — 파일시스템 부작용 없음을 전문 확인**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(199줄 전문 열람)
  - 상세: `findStrayTags`/`collectScanTargets` 는 `repoRoot()` 기준 `plan/`·`spec/` 하위를 `fs.readFileSync`
    로만 읽고 쓰지 않는다. 유일하게 파일을 쓰는 테스트("archive/ 는 스캔하지 않는다")는
    `fs.mkdtempSync(path.join(os.tmpdir(), "stray-tags-fixture-"))` 로 저장소 밖 임시 디렉터리를 만들고
    `finally { fs.rmSync(tmp, { recursive: true, force: true }) }` 로 정리한다 — 예외가 나도 정리되는
    구조다. 저장소 트리 안에는 아무것도 쓰지 않는다.

- **`error-codes.ts` 변경은 JSDoc 주석뿐** — 위치: `codebase/backend/src/nodes/core/error-codes.ts:1-12`.
  `export const ErrorCode = {...}` 본체·멤버 키는 diff 밖(주석 아래)이라 시그니처·공개 인터페이스·런타임
  값 변경이 없다(실제 파일 열람으로 재확인).

- **환경 변수 읽기/쓰기, 네트워크 호출 없음** — 4개 코드 파일 전체에서 `os.environ`/`getenv`/`fetch`/`axios`
  등을 grep 했으나 매치 없음.

## 이미 등재된 부작용-인접 사항 (신규 아님, 참고만)

- `plan_guard.py` 의 `_CHECKBOX` 확장이 자매 스크립트 `.claude/tools/plan-stale-audit.sh:123-125` 의
  독립 정규식 사본에는 반영되지 않아 두 "완료 판정" 이 어긋난다 — `plan/in-progress/
  harness-review-gate-followups.md` 에 이미 등재됐고(재개 신호 명시), 하드 게이트는 `plan_guard.py`
  쪽이라 이 drift 자체가 차단력에 영향을 주지는 않는다. 새로 발견한 사항이 아니라 기록만 남긴다.

## 요약

실질 코드 변경은 4개 파일(`plan_guard.py` 정규식 확장 + 대응 테스트 3개 파일)로 좁고, 유일한 실행-경로
변경인 `_CHECKBOX`/`_QUOTED` 확장의 영향 범위를 `push_blocks` 프로퍼티까지 직접 추적해 "push 하드 블록엔
영향 없음, Stop 소프트 넛지에만 영향" 이라는 이전 라운드의 주장을 독립 재검증했고 일치했다. 신규 테스트
파일(`stray-tool-tags.test.ts`)의 유일한 파일 쓰기는 `os.tmpdir()` 기반 격리 디렉터리 + `finally` 정리로
저장소 트리에 잔재를 남기지 않는다. 시그니처·공개 인터페이스·전역 변경 가능 상태·환경 변수·네트워크
호출·이벤트/콜백 표면의 변경은 발견되지 않았다. 이번 4라운드에서 새로 지적할 부작용은 없다.

## 위험도

NONE
