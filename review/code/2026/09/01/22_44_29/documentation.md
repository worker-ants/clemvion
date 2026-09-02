# 문서화(Documentation) 리뷰

## 검토 범위에 대한 메모

이번 changeset(81개 파일)은 두 축으로 나뉜다 — (1) harness 위생 4건(`plan-lifecycle.md`,
`plan_guard.py`, `test_plan_guard.py`, `spec-links.test.ts`, `stray-tool-tags.test.ts`)과
plan 문서 정리, (2) `spec/conventions/error-codes.md` 두 surface(`ErrorCode`/`EngineErrorCode`)
병기 + 그 과정에서 생성된 `review/consistency/2026/09/01/{21_30_10,21_36_28,21_39_47,21_46_05,
21_49_21,21_56_30}/**` 6라운드 산출물(약 55파일) + 직전 코드리뷰 라운드(`22_25_37/**`) 산출물.
후자는 대부분 harness 가 남긴 세션 기록이라 문서화 관점의 "독스트링/주석/README" 평가 대상이
아니고, 실제 소스·독스트링·spec 본문에 해당하는 파일(1~5, 81, plan 트래킹 문서 6~14)에
집중해 검토했다. 이전 라운드(`22_25_37/documentation.md`)가 이미 이 diff 의 상당 부분을
검토했으므로, 그 이후 새로 추가된 내용(spec 최종본, plan 체크리스트 갱신, RESOLUTION 처분)의
**정합성**을 다시 검증하는 데 집중했다.

## 발견사항

- **[WARNING]** 신규 build-blocking 가드(`stray-tool-tags.test.ts`)가 여전히 그 가드 family 의
  SoT 문서에 미등재 — 단, **의식적으로 유예되고 추적됨** (신규 사실 아님, 확인 결과 재확인)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 파일 전체) /
    `spec/conventions/spec-impl-evidence.md:128`("build 차단 **4건**"), `:132-134`(§4.2 표 —
    `spec-link-integrity.test.ts`/`spec-area-index.test.ts`/`plan-frontmatter.test.ts` 등 나열,
    `stray-tool-tags.test.ts` 행 없음)
  - 상세: 직접 확인한 결과 `spec/conventions/spec-impl-evidence.md` §4.2 는 여전히
    "build 차단 4건" 이라고 개수를 명시하고 그 4건의 표에 `stray-tool-tags.test.ts` 가
    없다 — 이 changeset 이 머지되면 이 문서(스스로 "규약 SoT" 라 선언한 문서)의 개수 서술이
    실제와 어긋난 상태로 남는다. 다만 이 changeset 의 `RESOLUTION.md`(W5)와
    `plan/in-progress/harness-review-gate-followups.md`(174~182행, 신규 항목)를 대조하면, 이
    갭은 **1라운드 리뷰에서 이미 지적됐고 의도적으로 이번 PR 범위에서 제외**됐다 — 사유는
    "같은 changeset 안에서 `spec/` 편집 축이 이미 과하게 크다"(W1)는 상반된 지적과의 우선순위
    조정이며, 재개 조건("다음 harness 가드 추가 시 함께, 그때 카운트를 한 번만 고친다")까지
    명시돼 있다. 즉 **문서 결함 자체는 실재**하지만 **묵살이 아니라 근거를 남긴 유예**다.
  - 제안: 이번 PR 에서 추가 조치는 불필요(사유가 합당하고 재개 신호가 명확함). 다만 그
    후속 planner 턴이 실제로 오기 전까지 `spec-impl-evidence.md §4.2` 는 부정확한 상태로
    남는다는 사실을 인지해 둘 것 — 다음 harness 가드 추가 PR 에서 이 항목을 건너뛰면 누락이
    누적된다.

## 확인했으나 문제 없음 (근거 기록)

- **`spec/conventions/error-codes.md` 새 "비대칭" 문단의 사실관계** — `EngineErrorCode` 는
  엔진만 발행하고 `ErrorCode` 는 노드 핸들러가 주로 쓰되 엔진도 쓴다(`EXECUTION_TIME_LIMIT_EXCEEDED`)는
  주장을 코드로 직접 대조했다. `codebase/backend/src/nodes/core/error-codes.ts`에서
  `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `ErrorCode` 객체(약 8~111행) 안에 선언돼 있고,
  `WORKER_HEARTBEAT_TIMEOUT` 은 `EngineErrorCode` 객체(147행~) 안에 선언돼 있다 — 문서가
  이 두 사실을 정확히 반영한다. §3 예외 레지스트리의 `WORKER_HEARTBEAT_TIMEOUT` 행이 이미
  `EngineErrorCode` 멤버를 다룬다는 주장도 실측(같은 파일 80행)과 일치한다.
- **`plan-lifecycle.md` 신규 §3 항목("이동하는 문서 자신의 outgoing 링크")의 코드 근거** —
  `findBrokenPlanLinks`(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:444-448`)의
  JSDoc 을 직접 열어 대조했다. "Scope is deliberately narrow: `plan/complete/**` is excluded,
  because `plan-lifecycle.md §3` keeps point-in-time records on their old paths..." 문구가
  정확히 그 근거이고, `collectLivePlanMarkdown`(`plan-scan.ts:78-80`)이 `plan/in-progress`
  top-level 만 스캔함도 확인했다 — `plan/complete/**` 는 애초에 그 함수의 스캔 대상에도
  들지 않는다. 문서-코드 상호 참조가 양방향으로 착지한다.
- **plan 이동 후 링크 방향 규칙의 실제 적용 사례** — `plan/complete/spec-draft-error-code-two-surfaces.md`
  (지금 `complete/` 로 이동됨)가 아직 `in-progress/` 에 남아 있는
  `spec-conventions-engine-error-code-surface.md` 를 가리킬 때 `../in-progress/...` 로,
  반대로 그 in-progress 문서가 `complete/` 로 이동된 문서를 가리킬 때 `../complete/...` 로
  쓴 것을 직접 확인했다 — 이번 diff 가 새로 문서화한 규칙을 스스로도 정확히 지킨다.
- **`stray-tool-tags.test.ts`(신규 파일) 자체의 문서화 품질** — 파일 상단 40여 줄의 헤더
  주석이 "무엇을 막나 / 범위를 왜 직접 정하나 / 왜 코드펜스를 예외로 두지 않나" 세 절로
  근거를 남기고, `MIN_EXPECTED_MD_FILES` 상수 독스트링은 초판의 "436" 이 실측이 아니었음을
  스스로 정정한 이력까지 남긴다 — 이 저장소가 반복 겪은 "실측이라 적었는데 안 쟀다" 실패를
  주석 안에서 투명하게 기록한 드문 사례다. `TOOL_TAGS` 배열 정렬 기준(알파벳순)도 독스트링에
  명시돼 있다.
- **CHANGELOG.md 갱신 불요 판단 재확인** — `CHANGELOG.md` 를 직접 열어 확인한 결과 backend
  제품 기능 변경(예: retry 종결 처리, 취소 오분류 수정 등) 만 기록하는 관례이며, harness/plan/
  spec-convention 성격의 이번 changeset 은 그 관례 밖이다. 1라운드 문서화 리뷰의 판단과 일치.
- **`EngineErrorCode` JSDoc 의 "엔진 레이어" 프레이밍 잔존 drift** — 코드 주석
  (`error-codes.ts:114-115` 부근)이 여전히 "엔진 레이어 vs 노드 핸들러" 이분법으로 서술해
  이번 spec 병기가 반증한 프레이밍과 어긋나는 것을 확인했다. 다만 이는 `plan/in-progress/
  spec-conventions-engine-error-code-surface.md`(§후속, 새로 추가된 항목)가 "spec 이 아니라
  코드 주석이라 developer 트랙" 이라고 명시적으로 범위 밖 후속으로 등재해 두었으므로 이번
  PR 의 누락이 아니라 추적된 별도 작업이다.

## 요약

이번 changeset 의 실질적 문서 표면(4개 harness 코드/테스트 파일, `spec/conventions/error-codes.md`
1개 문단, plan 트래킹 문서 9개)은 주석·독스트링·plan 기록이 실측 수치·코드 참조와 정확히
일치했고, 신규로 도입한 plan-lifecycle 규칙(이동 문서의 outgoing 링크 재계산)도 diff 안에서
스스로 올바르게 적용돼 있었다. 유일한 잔존 결함은 1라운드부터 이어진 `stray-tool-tags.test.ts`
의 SoT(`spec-impl-evidence.md §4.2`) 미등재이며, 이는 근거·재개 조건과 함께 명시적으로 유예된
상태임을 재확인했다 — 방치가 아니라 우선순위 조정의 결과다. CHANGELOG 갱신 불요, README 신규
불요 판단도 재검증 결과 유효하다.

## 위험도

LOW
