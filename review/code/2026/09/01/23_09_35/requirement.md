# 요구사항(Requirement) 리뷰

## 검토 방법 메모

92개 변경 파일 중 실질 "요구사항" 표면은 5개(`.claude/docs/plan-lifecycle.md`,
`.claude/hooks/_lib/plan_guard.py`, `.claude/tests/test_plan_guard.py`,
`codebase/frontend/src/lib/docs/__tests__/{spec-links,stray-tool-tags}.test.ts`)와
`spec/conventions/error-codes.md` 1개 문단, 나머지는 `plan/**` 트래킹 문서 갱신(체크박스
정리·도구 아티팩트 태그 제거) 및 `review/code/**`·`review/consistency/**` 의 **이전 2라운드
코드 리뷰 + 6라운드 consistency-check 세션 산출물**이다. 후자는 이미 그 자체가 이 changeset을
검토한 기록이므로, 본 리뷰는 (a) 실제 코드/테스트 5개 파일의 기능 완전성·엣지케이스·반환값을
직접 재현·실행으로 검증하고, (b) `spec/conventions/error-codes.md` 의 신규 문단을 실제 소스
(`error-codes.ts`, `error-codes.spec.ts`)와 line-level 대조하고, (c) 이전 라운드들이 이미
잡아 조치한 항목이 실제로 해소됐는지 최종 상태(diff 가 아니라 현재 파일)로 재확인하는 데
집중했다.

검증 커맨드(모두 read-only, 저장소 뮤테이션 없음):
- `python3 -m pytest .claude/tests/test_plan_guard.py -k "checkbox or quoted or blockquote"` → 9 passed
- `npx vitest run src/lib/docs/__tests__/{stray-tool-tags,spec-links}.test.ts` (codebase/frontend) → 36 passed
- `find plan -name "*.md" -not -path "*/archive/*" | wc -l` → 505, `find spec -name "*.md" ... | wc -l` → 386
  (스캐너 하한 상수 `MIN_EXPECTED_MD_FILES = {plan: 250, spec: 190}` 의 실측 근거 주석과 일치)
- `codebase/backend/src/nodes/core/error-codes.ts`, `error-codes.spec.ts:59-60` 직접 열람 —
  `spec/conventions/error-codes.md` 신규 문단의 모든 사실 주장(같은 파일 자매 const, 키
  disjoint 테스트, `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `ErrorCode` 소속이면서 엔진이 싣는다)이
  코드와 정확히 일치함을 확인
- `git log --oneline -- spec/conventions/error-codes.md plan/complete/spec-draft-error-code-two-surfaces.md`
  + `git show <commit> -- <path>` 로 각 리뷰 라운드 fix 커밋이 실제로 어느 파일을 건드렸는지 추적

## 발견사항

- **[INFO]** 최종 커밋된 spec 문구가 마지막(6차) `--spec` consistency-check 라운드가 검증한
  정확한 문구와 축어적으로 다르다 — 내용은 독립 재검증으로 사실과 일치함을 확인
  - 위치: `spec/conventions/error-codes.md` "경계는 **비대칭**이다…" 문단(§Overview,
    적용 범위 문단 바로 아래) / 비교 대상: `review/consistency/2026/09/01/21_56_30/_target/spec-draft-error-code-two-surfaces.md`
    "경계는 **누가 발행하는가**이며…" 문단
  - 상세: `--spec` 게이트는 6라운드(`21_30_10`~`21_56_30`) 돌았고 마지막 라운드는 `_target`
    스냅샷에 "경계는 **누가 발행하는가**" 프레이밍(4차 `21_46_05` 라운드가 "층(layer)" 프레이밍
    대신 제시한 대안 문구를 그대로 채택한 버전)을 담고 `BLOCK: NO · WARNING 0` 을 받았다.
    그런데 실제로 `spec/conventions/error-codes.md` 에 반영·커밋된 문구(`git show b5d2e6972`)는
    "경계는 **비대칭**이다: `EngineErrorCode` 는 엔진만 발행하고, `ErrorCode` 는 노드 핸들러가
    주로 쓰되 엔진도 쓴다(예: `EXECUTION_TIME_LIMIT_EXCEEDED`)…" 로, 6차 라운드가 검증한
    문구와 표현이 다르다. `review/consistency/2026/09/01/` 아래에 이 "비대칭" 표현을 검증한
    7차 라운드는 없다(디렉터리 리스팅으로 확인, `21_56_30` 이 최종). CLAUDE.md 는
    "project-planner 는 spec/ 쓰기 직전 consistency-check --spec 의무" 라고 규정하는데,
    엄밀히는 **정확히 이 커밋된 문구**가 그 의무의 대상이 된 적이 없다.
    다만 실질 위험은 낮다 — (1) "비대칭" 문구는 4차 라운드가 명시 제안한 대안
    ("const 경계가 '누가 발행하는가' 기준이며 카탈로그의 '엔진 수준 에러' 분류와 1:1 대응하지
    않는다")을 더 구체화한 상위집합이지 새 주장을 추가한 게 아니고, (2) 그 유일한 구체적
    사실 주장(`EngineErrorCode` 는 엔진만 발행 / `ErrorCode` 는 `EXECUTION_TIME_LIMIT_EXCEEDED`
    사례로 엔진도 씀)을 본 리뷰가 `error-codes.ts` 소스로 직접 재검증해 정확함을 확인했다.
  - 제안: 코드 fix 대상 아님(spec 문서 자체는 사실과 일치). 다음에 이 문서를 다시 건드릴
    plan/consistency 라운드에서, "6차 최종 검증 문구 = 실제 커밋 문구" 라는 전제가 이번엔
    깨졌다는 점을 참고하면 좋다 — 문구를 커밋 직전에 다시 다듬을 경우 그 다듬은 버전으로
    최종 라운드를 한 번 더 돌리거나, 적어도 "표현만 다듬었고 주장은 동일함"을 커밋 메시지에
    명시하는 관례를 권장(이번 커밋은 실제로 그렇게 했다 — `b5d2e6972` 메시지의 "최종판" 절이
    변경 근거를 정확히 남겨, 사후 추적 가능성 자체는 확보돼 있다).

## 확인했으나 문제 없음 (근거 기록)

- `.claude/hooks/_lib/plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` 비대칭 카운팅 로직을 직접
  읽고 엣지케이스를 수동 추적했다: 자기 열림(카운트), 인용 열림(카운트=거부권), 중첩 인용
  열림(카운트), 자기 닫힘(카운트=증거), 인용 닫힘(제외), 인용 닫힘만 있고 열림 0(허위완료
  아님을 확인 — `done_count=0` 이라 `done_count>0` 조건에서 False), frontmatter 안 체크박스
  유사 라인(스킵) 전부 코드 흐름과 신규 테스트 5건(`test_plan_guard.py`)이 정확히 일치한다.
  `pytest -k "checkbox or quoted or blockquote"` 9 passed 로 실행 확인.
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` 전문을 읽고 `vitest run`
  으로 직접 실행(10 tests, 다른 파일과 합산 36 passed) — `MIN_EXPECTED_MD_FILES` 하한이
  실제 저장소 `plan/`(505)·`spec/`(386) 실측치와 정합, `SCAN_ROOTS` 를 상수 파생이 아니라
  테스트 리터럴로 못박은 설계(이전 두 차례 vacuous 뮤턴트를 막기 위한 것, RESOLUTION `22_44_29`
  W4)도 실제 코드에 그대로 반영돼 있다.
  `it.each` 리터럴(`EXPECTED_ROOTS`)과 상수(`SCAN_ROOTS`/`MIN_EXPECTED_MD_FILES` 키) 간
  `[전제]` 동기화 테스트도 정확히 그 목적대로 동작함을 확인.
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 의 멀티라인 ANCHOR 신규 fixture
  줄 번호(`#nope`→4, `./missing.md`→5, `./real.md#no-such-anchor`→7, 멀티라인 **시작** 줄)를
  fixture 원문에서 직접 세어 대조 — 정확히 일치.
- `.claude/docs/plan-lifecycle.md` 신규 문단의 "가드가 안 잡는다" 근거(`findBrokenPlanLinks`
  가 `collectLivePlanMarkdown`(top-level `plan/in-progress/*.md` 만, `plan/complete/**` 전혀
  안 봄)을 쓰고, 그 JSDoc 이 "Scope is deliberately narrow: `plan/complete/**` is excluded…"
  라고 정확히 그 근거를 담고 있음을 `spec-links.ts:434-438` 직접 열람으로 확인.
- `spec/conventions/error-codes.md` 신규 문단의 모든 사실 주장(같은 파일 자매 const 위치
  `:8`/`:147`, 키 disjoint 를 고정하는 `overlap` 테스트, `EXECUTION_TIME_LIMIT_EXCEEDED` 가
  `ErrorCode` 소속이면서 `execution-engine.service.ts` 등 엔진 코드가 사용)을 소스 직접 열람
  으로 재확인 — 정확함.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md` 의 "판단 기준을 함께
  적을지" 체크리스트 항목이 `[x]` 로 닫혀 있고, 그 결정("이번엔 안 쓴다, 재개 신호는 세
  번째 자매 const")과 `WsErrorCode` 모호성 유보가 정확히 기록돼 있음을 확인 — plan_coherence
  라운드가 지적했던 "실제 무게" 질문이 실제로 답해졌다.
- 5개 실제 코드 파일(`plan_guard.py`, `test_plan_guard.py`, `spec-links.test.ts`,
  `stray-tool-tags.test.ts`, `plan-lifecycle.md`)에 TODO/FIXME/HACK/XXX 마커 없음(grep 확인,
  `plan-lifecycle.md` 안의 "TODO" 언급은 가드 자신의 판정 기준을 설명하는 서술일 뿐).
- 이전 2라운드 코드 리뷰(`22_25_37`, `22_44_29`)의 RESOLUTION.md 가 주장한 조치(비대칭
  카운팅 도입, `MIN_EXPECTED_MD_FILES` 루트별 분리+리터럴 고정, `skipDir("archive")` fixture
  대조군 추가, `plan-lifecycle.md:45` 마크다운 강조 중첩 수정)가 실제 최종 파일 상태와
  일치함을 소스 직접 대조로 확인 — RESOLUTION 이 주장만 하고 실제로 반영 안 된 항목은
  없었다.

## 요약

실질 코드/테스트 변경은 5개 파일(plan 체크박스 인용문 비대칭 카운팅, 도구 아티팩트 태그
잔재 가드 신설, 링크 가드 통합층 멀티라인 보강, plan lifecycle 절차 문서 보강)로 매우
좁고, 전부 직접 실행(pytest/vitest)과 소스 대조로 기능이 의도대로 동작함을 확인했다.
엣지케이스(인용문 안 열림/닫힘 비대칭, 중첩 인용, 서술적 대괄호 오탐 방지, 루트 소실
뮤턴트 방지)가 회귀 테스트로 촘촘히 고정돼 있고 전부 GREEN 이다. `spec/conventions/error-codes.md`
신규 문단은 실제 코드 사실과 line-level 로 일치한다. 유일한 발견은 그 문단의 최종 커밋
문구가 마지막 `--spec` 검증 라운드의 정확한 스냅샷과 축어적으로 다르다는 절차적 관찰
(INFO)이며, 내용 자체는 독립 재검증으로 사실과 일치해 실질 위험은 낮다. 이미 2라운드
코드 리뷰 + 6라운드 consistency-check 를 거친 changeset 답게 요구사항 충족 관점에서
추가로 조치가 필요한 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

LOW
