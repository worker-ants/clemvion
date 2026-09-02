# 요구사항(Requirement) 리뷰

## 범위 메모

`origin/main...HEAD` diff 중 실제 "코드" 변경은 8개 파일뿐이다(`git diff --stat origin/main...HEAD -- .claude codebase spec` 로 직접 확인):

- `.claude/docs/plan-lifecycle.md` (+2)
- `.claude/hooks/_lib/plan_guard.py` (+35/-4, `_CHECKBOX`/`_QUOTED` 비대칭 카운팅)
- `.claude/tests/test_plan_guard.py` (+89, 회귀 테스트)
- `codebase/backend/src/nodes/core/error-codes.ts` (+8/-1, JSDoc 정정)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (+46, 멀티라인 ANCHOR + `plan/complete/` 봉인 fixture)
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규, +206)
- `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts` (+5/-2, `bases: readonly string[]`)
- `spec/conventions/error-codes.md` (+12/-2)

나머지(`plan/**` 트래킹 문서, `review/code/2026/09/01/{22_25_37,22_44_29,23_09_35,23_28_32}/**`,
`review/consistency/2026/09/01/**`)는 이미 4라운드(1R→2R→3R→4R, 각 라운드 `RESOLUTION.md` 로
조치 기록)의 fix→review 사이클을 거친 봉인된 세션 산출물·plan 위생 갱신이라 요구사항 충족
관점의 채점 대상이 아니다. `git log --oneline -5` 로 최신 커밋이 `7829dbd61`(4R fix)임을,
`git status --short` 로 이번 세션(`review/code/2026/09/01/23_44_28/`) 외 미커밋 변경이 없음을
확인했다 — 이번 라운드는 4R 이 이미 커밋한 최종 상태를 독립 재검증하는 5R 이다.

아래는 위 8개 파일에 대해 **직접 코드를 읽고, 실제 파일시스템 수치를 재측정하고, 소스를
grep 으로 재확인**해 독립 검증한 결과다. 이전 라운드가 이미 지적·조치한 항목은 반복 나열하지
않고, 내가 직접 재확인해 여전히 유효한지만 표시한다.

## 실행 검증

- `find plan -name '*.md' -not -path '*/archive/*' | wc -l` → **505** (`stray-tool-tags.test.ts`
  의 실측 주석 "plan/ 505" 및 `MIN_EXPECTED_MD_FILES.plan = 250` 하한과 일치, 여유 있음).
- `find spec -name '*.md' -not -path '*/archive/*' | wc -l` → **386** (같은 주석의 "spec/ 386"
  및 `MIN_EXPECTED_MD_FILES.spec = 190` 하한과 일치).
- `grep -rnE '^\s*</?(antml|content|function_calls|invoke|parameter)\b[^>]*>\s*$' plan spec` →
  **0건** — 5파일 6건 정리가 실제로 완결됐음을 저장소 실측으로 재확인(테스트 재실행이 아니라
  가드가 쓰는 것과 동일한 패턴으로 독립 재현).
- `git diff origin/main...HEAD -- .claude codebase spec | grep -E '^\+.*(TODO|FIXME|HACK|XXX)'`
  → 0건.
- `grep -rn "EngineErrorCode\." codebase/backend/src --include='*.ts'` (spec/test 제외) →
  `execution-engine.service.ts`(3곳)·`shutdown-state.service.ts`(2곳) **뿐** — spec 의 "엔진만
  발행" 주장과 정확히 일치.
- `grep -rn "EXECUTION_TIME_LIMIT_EXCEEDED" codebase/backend/src` → `error-codes.ts`(선언) 외에
  `execution-engine.service.ts`·`workflow-errors.ts`(엔진 모듈)에서도 `ErrorCode.` 로 사용 —
  "`ErrorCode` 는 엔진도 쓴다" 주장과 일치.
- `WORKER_HEARTBEAT_TIMEOUT` 이 `error-codes.ts:166`(`EngineErrorCode` 블록 내부, `:147~`)의
  멤버이고 동시에 `error-codes.md:80` §3 예외 레지스트리에 이미 등재돼 있음을 직접 확인 —
  "이 병기는 새 규칙이 아니라 기존 실무의 명문화" 주장과 정확히 일치.

## 발견사항

이번 라운드에서 새로 발견한 Critical/Warning 은 없다. 아래는 재확인만 남기는 INFO 하나다.

- **[INFO]** 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 `spec-impl-evidence.md §4.2`
  SoT 표에 미등재 — **4라운드 연속 재확인, 새 이탈 없음**
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일) /
    `spec/conventions/spec-impl-evidence.md §4.2`(미변경)
  - 상세: 1R documentation W1 → 2R RESOLUTION W7(유예 확인) → 3R RESOLUTION 무조치 재확인 →
    4R RESOLUTION W3(4번째 재확인, "즉시 조치 불요, 이미 유예 등재됨") 순으로 같은 항목이
    반복 확인됐다. `plan/in-progress/harness-review-gate-followups.md:174-181` 에 재개 신호
    ("다음 harness 가드 추가 시 함께 반영")와 함께 열린 항목(`[ ]`)으로 등재돼 있음을 직접
    확인했다 — 묵살이 아니라 명시적 유예이고, 유예 사유(이 changeset 이 이미 spec 축을
    과다 번들했다는 W1 지적과의 상충)도 근거가 살아 있다.
  - 제안: 조치 불요(4라운드 누적 확인). 다음 harness 가드 추가 시 이 항목까지 함께
    `spec-impl-evidence.md §4.2` 표·frontmatter `code:` 에 반영할 것 — 더 미루면 갱신할
    항목 수만 늘어난다.

## 확인했으나 문제 없음 (직접 재검증 근거)

- `plan_guard.py` `_CHECKBOX`/`_QUOTED` 비대칭 카운팅 — 소스를 직접 추적(`:275-283`): 열린
  체크박스(`mark==" "`)는 `quote` 캡처와 무관하게 항상 `open_count`(거부권)에 들어가고, 닫힌
  체크박스는 `quote` 에 `>` 가 없을 때만(`not _QUOTED.search(...)`) `done_count`(자기 증거)에
  들어간다. `test_plan_guard.py` 의 `FilesystemHelpersTest` 9개 케이스가 양방향(열린 인용문
  거부권·중첩 인용·서술 대조군·닫힌 인용 단독 비완료·자기+인용 닫힘 공존 완료·인용 열림이
  공존 상황에서도 거부권 유지)을 개별로 겨눈다 — 4라운드에 걸쳐 뮤테이션(비대칭 무력화 RED,
  앵커 원복 RED)으로 검증된 로직이고 이번 라운드 재확인에서도 코드·테스트가 일치한다.
- `stray-tool-tags.test.ts` 의 `MIN_EXPECTED_MD_FILES`(plan:250/spec:190)·`EXPECTED_ROOTS`
  리터럴 — 실측치(505/386)와 대조해 하한이 여유 있게 낮게 잡혀 있고(자연 감소는 안 걸리고
  루트 소실만 잡는 설계 의도와 일치), `it.each(EXPECTED_ROOTS)` 가 아니라 테스트 본문의
  독립 리터럴로 기대 루트를 고정해 "집합에서 케이스를 파생하면 축소가 조용히 통과한다"는
  2R 지적이 실제로 막혀 있음을 코드로 확인했다.
- `codebase/backend/src/nodes/core/error-codes.ts` JSDoc — "membership 은 node-level 을 뜻하지
  않는다"·"`EngineErrorCode` 와의 경계가 비대칭"이라는 두 주장 모두 위 실행 검증 절에서 grep
  으로 독립 재현했다. `spec/conventions/error-codes.md` 의 대응 문단과 line-level 로 어긋나지
  않는다(양쪽 모두 "같은 파일, 자매 const, 키 비중첩, 엔진만 발행 vs 엔진도 씀" 을 동일하게
  서술).
- `spec-links.test.ts` 의 멀티라인 ANCHOR fixture — 텍스트를 줄 단위로 직접 세어 `./real.md#no-such-anchor`
  가 7번째 줄에서 시작함을 확인했고 테스트의 `byTarget.get(...).toBe(7)` 단언과 일치한다.
  `plan/complete/sealed.md` 봉인 스코프 테스트는 `plan-lifecycle.md §3` 이 이번에 명문화한
  "`findBrokenPlanLinks` 는 `plan/complete/**` 를 의도적으로 제외" 계약을 코드로 봉인하며,
  대조군(`../complete/moved.md`)이 함께 있어 "0건이 제외 때문인지 스캔 실패 때문인지" 갈리게
  설계돼 있다.
- `tree-walk.ts` 의 `bases: readonly string[]` — 함수 본체(`:80-104`)가 `bases` 를 `for...of` 로
  순회만 하고 재할당·mutate 하지 않음을 직접 확인했다. `string[]` 은 `readonly string[]` 에
  대입 가능하므로 기존 6개 호출부가 타입 오류 없이 그대로 통과한다. 4R RESOLUTION 이 근거로 든
  격리 `tsc --noEmit --strict` 재현(수정 전 exit 2 → 수정 후 exit 0)의 논리와 실제 구현이
  일치한다.
- 신규/변경 코드에 TODO/FIXME/HACK/XXX 없음(diff 전수 grep 확인, 위 실행 검증 절).
- `plan/complete/**` 5파일의 `</content>`/`</invoke>` 잔재 제거 — 저장소 전체 재검색으로 0건
  확인, 정리가 실제로 완결됐다(테스트 GREEN 을 신뢰하지 않고 가드와 동일한 패턴을 직접 재현).

## 요약

실제 코드 표면은 8개 파일로 좁고(이번 라운드에 새로 추가된 것은 4R 자체 수정인
`tree-walk.ts` 의 `readonly` 타입 변경뿐), 핵심 로직(`plan_guard.py` 의 blockquote 비대칭
카운팅)과 spec 서술(`error-codes.md` 의 두 surface 병기)은 소스 코드·실제 파일시스템 수치를
직접 재측정·재현해 독립 검증해도 어긋나지 않았다. 4라운드에 걸친 fix→review 사이클(동작 →
구조 → 계약 봉인 → 게이트 사각지대)이 발견의 성격을 점점 좁혀 왔고, 이번 5R 독립 재검증에서도
새로운 Critical/Warning 은 나오지 않았다 — 유일한 잔여 항목(`stray-tool-tags.test.ts` 의 SoT
미등재)은 4라운드 연속으로 확인된 의식적 유예이며 재개 신호가 명확히 등재돼 있어 INFO 로
유지한다. Critical 은 없다.

## 위험도

LOW
