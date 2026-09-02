# 부작용(Side Effect) 코드 리뷰

## 검토 범위

이번 changeset 은 다수(68개+) 파일을 포함하지만, 실행 코드/테스트에 해당하는 것은 4개뿐이다:

- `.claude/hooks/_lib/plan_guard.py` — `_CHECKBOX` 정규식을 blockquote(`>`) 접두까지 비대칭 확장, `_QUOTED` 보조 정규식 신설
- `.claude/tests/test_plan_guard.py` — 회귀 테스트 5건 추가
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 멀티라인 ANCHOR fixture + line 전달 단언 추가
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — 신규 파일(도구 아티팩트 태그 잔재 가드)

나머지는 `.claude/docs/plan-lifecycle.md`(문서), `plan/**` 트래킹 문서 갱신, `spec/conventions/error-codes.md` 본문 1건, 그리고 이전 리뷰/consistency 라운드의 세션 산출물(`review/**`, harness 관례상 커밋되는 기록물)이다. 코드 4개 파일을 직접 열어 현재 저장소 상태를 대조하고, 호출부(`grep`)를 추적해 아래 결론을 독립적으로 검증했다.

## 발견사항

- **[INFO]** `_CHECKBOX`/`_QUOTED` 정규식 확장은 모듈 전역 상수이고 유일한 사용처(`_all_checkboxes_done`)를 통해 **모든** `plan/in-progress/*.md` 판정에 소급 적용된다
  - 위치: `.claude/hooks/_lib/plan_guard.py` — `_CHECKBOX`/`_QUOTED` 정의(75~98행), 유일한 사용처 `_all_checkboxes_done()` 함수(248~281행)
  - 상세: `grep -rn "_CHECKBOX\b|_QUOTED\b" --include="*.py" .` 로 정의 1곳·사용 각 1곳뿐임을 재확인했다. `_all_checkboxes_done()` 의 반환값을 소비하는 `evaluate_plan()`(284행~)을 직접 추적한 결과, 이 함수의 반환값은 `complete_pending`(315행)에만 쓰이고, 이는 `PlanDecision.complete_but_in_progress` 필드(Stop-gate 소프트 넛지 전용)에만 실린다. Push 하드블록을 결정하는 `PlanDecision.untouched`(→ `push_blocks` property)는 `handled`(plan 파일이 실제로 갱신·이동됐는지, 313·319·326·339행)로만 결정되고 `complete_pending` 과 무관하다 — 319행/326행에서 `handled` 가 비면 `complete_pending` 값과 무관하게 `untouched=True`, 339행에서 `handled` 가 있으면 `untouched=False` 로 고정된다. 즉 이 정규식이 넓어져 어떤 plan 이 "이제서야 완료" 로 새로 판정되더라도 **push 를 새로 막는 경로는 없다** — 영향은 Stop 훅의 안내 문구(`complete_but_in_progress`)로 국한된다. 이 함수를 소비하는 곳도 `guard_review_before_stop.py`/`guard_review_before_push.py` 두 hook 뿐임을 `grep -rln "_all_checkboxes_done"`으로 확인했다.
  - 비대칭 설계(열린 쪽만 `>` 확장, 닫힌 쪽은 자기 것만 카운트)는 두 방향 오탐(서술 인용 `[ ]`, 인용문 안 닫힌 체크박스만 있는 문서의 허위 "완료")을 각각 막는 회귀 테스트(`test_plan_guard.py` 5건)로 고정돼 있어 blast radius 가 실측으로 뒷받침된다.
  - 제안: 조치 불요 — 확산 범위가 이미 소프트 넛지로 한정되고 회귀 테스트로 고정돼 있다. 다만 이 정규식이 module-level 전역이므로, 앞으로 세 번째 소비자가 추가되면(예: 다른 hook 이 `_all_checkboxes_done` 을 재사용) 이번에 검증한 "push 는 영향 없음" 전제를 다시 확인해야 한다는 점만 기록해 둔다.

- **[INFO]** `.claude/tools/plan-stale-audit.sh` 의 독립 사본 정규식이 이번 확장을 받지 않아 그 스크립트의 진행도 출력이 실제보다 완료에 가깝게 보고될 수 있다 — 단, 이번 changeset 자체가 만든 새 결함이 아니라 이미 `plan/in-progress/harness-review-gate-followups.md` 에 별도 항목으로 등재·유예된 기존 drift(3번째 재발)이다.
  - 위치: `.claude/tools/plan-stale-audit.sh:123-125` (미변경), `plan/in-progress/harness-review-gate-followups.md`(등재 diff)
  - 상세: 하드 게이트는 `plan_guard.py` 이고 이 스크립트는 informational 출력이라 push/Stop 차단력에는 영향이 없다. plan 문서에 어긋나는 방향(스크립트가 완료 쪽으로 과대평가)까지 명시돼 있어 은폐된 부작용은 아니다.
  - 제안: 조치 불요(이미 별도 트래커에 재개 신호와 함께 등재됨). 이 리뷰가 새로 만든 결함이 아님을 확인 차 기록.

## 확인했으나 문제 없음 (근거 기록)

- **테스트 fixture 격리**: `stray-tool-tags.test.ts` 의 `archive/` 스코핑 테스트는 `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 로 저장소 밖 임시 디렉터리만 쓰고 `finally` 블록에서 `fs.rmSync(tmp, { recursive: true, force: true })` 로 정리한다. `spec-links.test.ts` 의 신규 멀티라인 fixture 도 기존 `beforeAll`/`afterAll`(`fs.mkdtempSync`/`fs.rmSync`) 경로를 그대로 타 별도 잔여물을 만들지 않는다. `test_plan_guard.py` 의 신규 5건은 전부 `tempfile.TemporaryDirectory()` 컨텍스트 매니저 안에서만 파일을 쓴다. 저장소 트리 안에는 아무것도 쓰지 않는다.
- **시그니처/공개 인터페이스**: `_all_checkboxes_done(repo_root, plan_rel)`, `findBrokenLinks`, `findBrokenSpecLinksInSources`, `extractLinks` 등 이번 diff 가 손대는 모든 함수의 시그니처는 변경 없음(순수 정규식 리터럴 교체 + 테스트 추가).
- **환경 변수·네트워크**: 4개 코드 파일 전체에서 `os.environ`/`process.env` 신규 참조, `fetch`/`http` 류 네트워크 호출을 grep 했으나 없음(`test_plan_guard.py:368` 의 `os.environ` 참조는 이 diff 범위 밖의 기존 테스트 `PorcelainPathSurvivesOnARealRepoTest`에 속하며 이번 변경과 무관).
- **`</content>`/`</invoke>` 태그 삭제**(`plan/complete/*.md` 4건 + `plan/in-progress/webchat-usewidget-extraction.md`): 저장소 전체(`.claude`, `codebase`)에서 이 문자열을 파싱 마커로 소비하는 non-test 코드가 있는지 확인했으나 0건 — 삭제가 다른 동작에 영향을 주지 않는다.
- **`review/**` 세션 산출물 대량 추가**: harness 가 이전 라운드에 이미 디스크에 쓴 리뷰/consistency 산출물을 커밋에 반영하는 것으로, 프로젝트 관례(`review/**` 는 gitignore 대상 아님, 커밋 대상)와 일치한다. 이번 세션이 새로 파일을 쓰거나 지운 것이 아니다.
- **리뷰 작업 중 저장소 변형 여부**: `git status --short` 로 확인 — 이 리뷰 세션이 만든 `review/code/2026/09/01/23_09_35/` 디렉터리(자신의 산출물) 외에 어떤 파일도 건드리지 않았다.

## 요약

이번 changeset 의 유일한 실질 부작용 표면은 `plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` 모듈 전역 정규식 확장이며, 코드 추적(`evaluate_plan()` → `PlanDecision.untouched`/`push_blocks`)으로 그 영향이 in-progress plan 의 Stop-gate 소프트 넛지에 국한되고 push 하드블록에는 영향이 없음을 직접 확인했다. 비대칭 카운팅(열린 쪽만 인용문 허용, 닫힌 쪽은 자기 것만)이 두 방향의 오탐을 모두 막도록 회귀 테스트로 고정돼 있다. 신규/보강 테스트 3파일은 전부 저장소 트리 밖 tempdir 만 쓰고 확실히 정리하며, 시그니처·공개 인터페이스·환경 변수·네트워크 호출 변경은 없다. `plan-stale-audit.sh` 사본 drift 는 이번 diff 가 만든 결함이 아니라 별도 트래커에 이미 등재된 기존 이슈다. 리뷰 과정에서 저장소 트리에 아무것도 쓰지 않았다.

## 위험도

LOW
