# 요구사항(Requirement) 리뷰

## 범위 메모

`origin/main...HEAD` 92개 변경 파일 중 실제 "코드" 변경은 7개뿐이다(`git diff --stat origin/main...HEAD -- .claude codebase spec` 로 확인):

- `.claude/docs/plan-lifecycle.md` (+2)
- `.claude/hooks/_lib/plan_guard.py` (+35/-4, `_CHECKBOX` 정규식 비대칭 확장)
- `.claude/tests/test_plan_guard.py` (+89, 회귀 테스트 5건)
- `codebase/backend/src/nodes/core/error-codes.ts` (+8/-1, JSDoc)
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` (+46, 멀티라인 ANCHOR + `plan/complete/` 봉인 fixture)
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규, +199)
- `spec/conventions/error-codes.md` (+12/-2)

나머지 85개는 `plan/**` 트래킹 문서 갱신과 `review/code/**`·`review/consistency/**` 아래 이전 라운드의 봉인된 세션 산출물(자동 생성 markdown/JSON)이라 요구사항 충족 관점의 채점 대상이 아니다 — 이미 3라운드(`22_25_37`→`22_44_29`→`23_09_35`)의 fix→review 사이클을 거쳐 각 라운드 RESOLUTION.md 가 조치 내역을 기록하고 있다. 아래는 실제 코드 7개 파일에 대해 **직접 코드를 읽고 테스트를 실행**해 독립 검증한 결과다.

## 실행 검증

- `python3 -m pytest .claude/tests/test_plan_guard.py -q` → **39 passed, 15 subtests passed**.
- `npx vitest run src/lib/docs/__tests__/stray-tool-tags.test.ts src/lib/docs/__tests__/spec-links.test.ts` (frontend 패키지 디렉터리에서) → **2 files, 37 tests passed**.
- `git diff origin/main...HEAD -- .claude codebase spec | grep -E '^\+.*(TODO|FIXME|HACK|XXX)'` → 0건.

## 발견사항

- **[WARNING]** 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 자신이 속한 family 의 SoT 문서(`spec/conventions/spec-impl-evidence.md §4.2`)에 등재되지 않음 — spec fidelity(관점 9)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일 전체) / `spec/conventions/spec-impl-evidence.md:4-18`(frontmatter `code:` 리스트), `:126-134`(§4.2 "build 차단 4건" 표)
  - 상세: `spec/conventions/spec-impl-evidence.md:128` 은 "§4.2 지식저장소·plan 무결성 가드... 본 절이 규약 SoT" 라 스스로 선언하고 "build 차단 4건 + advisory 1건" 이라 개수까지 못박는다(`:126`). `stray-tool-tags.test.ts` 는 같은 디렉터리에서 `walkTree` 로 `plan/`·`spec/` 마크다운을 스캔해 위반 0건을 단언하는 동일 구조의 5번째 build-blocking 가드인데, 표에도 frontmatter `code:` 리스트(`spec-impl-evidence.md:4-18`, 재사용 헬퍼 `tree-walk.ts`/`tree-walk.test.ts` 는 이미 등재돼 있어 대조가 뚜렷함)에도 없다. 이 changeset 어디에도 그 표/frontmatter 를 갱신하는 diff 가 없다.
  - 확인: 이 결함은 새로 발견한 것이 아니라 이미 이번 changeset 의 1R/2R documentation·testing 리뷰가 동일하게 지적했고(`review/code/2026/09/01/22_25_37/documentation.md` W1, `22_44_29/RESOLUTION.md` W7), developer 가 "이 PR 에 spec 축이 이미 과하게 묶였다"(같은 리뷰의 별도 WARNING)는 상충 근거로 **의식적으로 유예**해 `plan/in-progress/harness-review-gate-followups.md:174-181` 에 재개 신호("다음 harness 가드 추가 시 함께")와 함께 등재했다. 유예 근거·등재 모두 실측대로다.
  - 제안: 이미 등재된 유예이므로 이번 라운드에서 새 조치는 불요. 다음에 harness 가드가 하나 더 추가될 때 `spec-impl-evidence.md §4.2` 표에 두 건을 한 번에 반영할 것 — 등재 시점을 또 미루면 카운트 갱신 비용이 계속 커진다.

## 확인했으나 문제 없음 (직접 검증 근거)

- `.claude/hooks/_lib/plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` 비대칭 카운팅 — 로직을 직접 추적했다: 열린 체크박스(`mark==" "`)는 인용문 여부와 무관하게 `open_count` 에 들어가고(거부권), 닫힌 체크박스는 `quote` 캡처 그룹에 `>` 가 없을 때만(`not _QUOTED.search(...)`) `done_count` 에 들어간다(자기 것 증거). `quote` 캡처는 `[\s>]*` 로만 구성되므로 오탐 여지가 없다. `python3 -m pytest .claude/tests/test_plan_guard.py -q` 로 신규 회귀 테스트 5건(인용문 안 열린 항목·중첩 인용·서술 대조군·인용 닫힘 단독·자기 닫힘+인용 닫힘 공존·인용 열림 거부권 캐너리) 전부 GREEN 확인 — 각 테스트가 비대칭의 두 방향(거부권/증거)을 개별적으로 겨눈다.
- `_all_checkboxes_done()` 의 반환 조건 `done_count > 0 and open_count == 0` — 자기 체크박스가 0건(전부 인용)인 문서는 `done_count=0` 이라 항상 False 를 반환한다. "체크리스트가 아닌 문서" 를 완료로 오판하지 않는 보수적 기본값이 유지된다.
- `spec/conventions/error-codes.md` 의 신규 §Overview 문단 주장을 소스로 직접 재검증: `EngineErrorCode.` 사용처는 `execution-engine.service.ts`/`shutdown-state.service.ts` 2곳뿐(엔진 전용 확인), `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 는 `error-codes.ts` 외에 `execution-engine.service.ts`·`workflow-errors.ts` 등에서도 쓰여 "ErrorCode 는 엔진도 쓴다" 주장과 일치. `WORKER_HEARTBEAT_TIMEOUT` 은 실제로 `EngineErrorCode` 멤버(`error-codes.ts:166`)이고 `3-error-handling.md:114` §1.4 "엔진 수준 에러" 표에 이미 있어 "기존 실무의 명문화" 주장과 일치. 같은 표에 `EXECUTION_TIME_LIMIT_EXCEEDED`(`ErrorCode` 멤버)와 `WORKER_HEARTBEAT_TIMEOUT`(`EngineErrorCode` 멤버)가 섞여 있어 "카탈로그 분류가 두 const 에 1:1 대응하지 않는다" 는 문장도 실측과 부합한다. 목적지 필드(`Execution.error`/`NodeExecution.error`)를 코드별로 재선언하지 않아, 이전 라운드에서 지적됐던 SoT 중복 위험도 회피돼 있다.
- `codebase/backend/src/nodes/core/error-codes.ts` JSDoc 변경 — `EngineErrorCode` const 자체는 이번 diff 범위 밖(이미 존재)이고, 이번 변경은 최상단 JSDoc 한 문단으로 "membership 이 node-level 을 뜻하지 않는다" 는 정정만 추가한다. 스캔한 실제 상수 정의(153-178행)와 JSDoc 서술이 어긋나지 않는다.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 의 멀티라인 ANCHOR 픽스처 — fixture 텍스트를 줄 단위로 직접 세어 `#nope`=4행, `./missing.md`=5행, 멀티라인 링크 시작=7행임을 확인했고 테스트 단언과 일치한다. `plan/complete/sealed.md` 를 이용한 봉인 스코프 회귀 테스트도 `collectLivePlanMarkdown`(`plan-scan.ts:78-80`)이 `plan/in-progress` top-level 만 훑고 `plan/complete/**` 를 전혀 건드리지 않음을 소스로 직접 확인해 fixture 의도와 구현이 일치한다.
- `stray-tool-tags.test.ts` — `MIN_EXPECTED_MD_FILES`(plan:250/spec:190)와 `EXPECTED_ROOTS` 리터럴 이중 고정, `collectScanTargets` 단일화, `archive/` 스코핑 fixture(대조군 포함) 모두 vitest 실행으로 GREEN 확인. `ScanRoot` 타입 선언(53행)이 첫 사용(69행)보다 앞에 위치해 3R 에서 지적된 순서 문제도 실제로 해소돼 있다.
- 신규 코드에 TODO/FIXME/HACK/XXX 없음(`git diff` 전수 grep 확인).
- `plan/complete/**`·`plan/in-progress/webchat-usewidget-extraction.md` 의 도구 아티팩트 태그(`</content>`/`</invoke>`) 제거 5파일은 `stray-tool-tags.test.ts` 스캔이 실제로 0건을 반환함으로써 정리 완결성이 확인된다.
- `.claude/tools/plan-stale-audit.sh:123-125` 의 체크박스 정규식(`^[[:space:]]*-[[:space:]]*\[[ x]\]`)이 `plan_guard.py` 의 확장을 받지 않은 채 그대로 남아 있음을 직접 확인 — `plan/in-progress/harness-review-gate-followups.md:183-201` 이 이 drift 를 "셋째 재발" 로 이미 정확히 등재하고, informational 출력이라 하드 게이트에 영향이 없다는 이유로 의도적으로 이번 PR 범위에서 제외했다는 서술도 스크립트 실측과 일치한다(새 결함이 아니라 이미 트래킹된 기지 항목).

## 요약

실제 코드 표면은 7개 파일로 좁고, 핵심 로직 변경(`plan_guard.py` 의 blockquote 비대칭 카운팅)은 열린/닫힌 두 방향을 모두 겨눈 회귀 테스트 5건 + 대조군으로 검증되며 직접 실행해 GREEN 을 확인했다. `spec/conventions/error-codes.md` 의 신규 서술(대표 surface 병기·비대칭 경계·`WORKER_HEARTBEAT_TIMEOUT` 선례)은 코드·spec 카탈로그와 line-level 로 재검증해도 어긋나지 않는다. 유일한 실질 갭은 신규 build-blocking 가드 `stray-tool-tags.test.ts` 가 자신이 속한 family 의 규약 SoT(`spec/conventions/spec-impl-evidence.md §4.2`)에 미등재된 것인데, 이는 이번 changeset 이 이미 자체 발견해 사유와 함께 후속 트래커에 등재한 상태다(신규 발견 아님, 재확인). Critical 은 없다.

## 위험도

LOW
