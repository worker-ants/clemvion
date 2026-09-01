# 부작용(Side Effect) 코드 리뷰

## 범위에 대한 메모

`git diff origin/main --stat -- 'codebase/**' '.claude/**'`(review/ 제외)로 실측한 실제 코드 diff는
7개 파일뿐이다. 나머지(100여 개)는 `review/code/**`·`review/consistency/**` 세션 산출물(자동 생성
markdown/JSON)과 `plan/**` 트래킹 문서·`spec/conventions/error-codes.md` 문서 편집이라 부작용
채점 대상이 아니다(순수 서술, 실행되지 않음). 이 리뷰는 실행 코드 7개 파일에 집중했고, 각 파일을
`Read`로 직접 열어 diff 가 아니라 최종 소스를 근거로 판단했다.

## 발견사항

- **[INFO]** `_CHECKBOX`/`_QUOTED` 정규식 확장(blockquote 접두 허용)은 모듈 전역 상수이고 유일한
  사용처가 `_all_checkboxes_done()` 한 곳임을 재확인 — blast radius 는 Stop 소프트 넛지로 국한
  - 위치: `.claude/hooks/_lib/plan_guard.py:95`(`_CHECKBOX` 정의), `:98`(`_QUOTED` 정의), `:275-283`(`_all_checkboxes_done` 내 유일 사용처)
  - 상세: `grep -n "_CHECKBOX\b" .claude` 결과 정의 1건 + 사용 1건으로 독립 재확인했다. `_all_checkboxes_done()`의 반환값은 `evaluate_plan()` 안에서 `complete_pending`에만 흘러가고, `complete_pending`은 `PlanDecision.complete_but_in_progress`를 통해 `guard_review_before_stop.py:420`의 소프트 넛지에만 쓰인다. push 하드 블록(`guard_review_before_push.py:896`의 `result.push_blocks`)은 `PlanDecision.untouched`(= `_plan_handled()` 기반)로만 결정되고 `_all_checkboxes_done()`을 참조하지 않는다 — 두 소비자 파일을 직접 grep해 재확인했다. 즉 이 정규식 확장이 push 를 새로 막거나 통과시키는 방향의 부작용은 없다.
  - 이 파일의 12줄 근거 주석과 `test_plan_guard.py`의 신규 케이스(`test_quoted_done_checkbox_alone_is_not_completion`, `test_own_done_plus_quoted_done_is_completion`, `test_quoted_open_still_vetoes_alongside_own_done` 등)가 비대칭 카운팅(열린=거부권/인용문 안이어도 산입, 닫힌=자기 것만 산입)의 두 방향을 모두 회귀 고정하고 있음을 실제 테스트 파일에서 확인했다.
  - 제안: 조치 불요 — 이미 여러 라운드에 걸쳐 반증·재보강된 지점이고 현재 상태가 안정적이다.

- **[INFO]** 같은 목적의 독립 사본(`plan-stale-audit.sh`)이 이번 확장을 받지 않아, 두 SoT가 서로 다른 진행률 신호를 낼 수 있는 상태가 이번 커밋에도 그대로 남는다
  - 위치: `.claude/tools/plan-stale-audit.sh`(이번 diff에 포함되지 않음 — `git diff origin/main --stat -- .claude/tools/plan-stale-audit.sh` 결과 변경 없음)
  - 상세: `plan_guard.py`의 `_CHECKBOX` 주석 자신이 "이 페어가 두 번 drift 했다"고 적어 두고 있는데, 이번 확장이 그 셸 스크립트 쪽에는 반영되지 않았다. 하드 게이트는 `plan_guard.py`뿐이라 push 차단력에는 영향이 없지만, 사람이 `plan-stale-audit.sh` 출력을 보고 판단하면 인용문 안 열린 항목을 누락한 채 "더 완료에 가깝다"고 잘못 읽을 수 있다 — 이는 새 부작용이 아니라 기존 drift가 이번 확장으로 한 단계 더 벌어진 것이다.
  - 제안: 이미 이전 라운드 RESOLUTION에서 의도적으로 이번 PR 범위 밖으로 등재된 상태(검증 표면이 없는 셸 정규식을 테스트 없이 고치지 않겠다는 판단)이므로 재차 차단 사유로 올리지 않는다. 참고 기록으로만 남긴다.

- **[INFO]** `walkTree()` 시그니처가 `bases: string[]` → `bases: readonly string[]`로 넓어짐 — 호출부 전수 확인 결과 파괴적 변경 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts:72`(시그니처), `:80`(`for (const base of bases)` — 유일한 읽기, 변형 없음)
  - 상세: `grep -rl "walkTree("` 로 이 함수의 호출부 6개 파일(`spec-frontmatter-parse.ts`, `impl-anchor-parse.ts`, `tree-walk.test.ts`, `stray-tool-tags.test.ts`, `plan-scan.ts`, `spec-links.ts`)을 모두 확인했다 — 전부 이 `__tests__/` 디렉터리 내부 파일이고 외부 export 소비자는 없다. `string[]`는 구조적으로 `readonly string[]`에 대입 가능하므로(TS 공변) 기존 `string[]` 리터럴/변수 호출부는 타입 에러 없이 그대로 통과한다. 함수 본체는 `for...of`로 순회만 하고 `bases.push/sort/splice` 등 변형 호출이 없음을 확인했다 — 런타임 동작 변화는 없고 순수 컴파일타임 타입 확장이다.
  - 제안: 조치 불요.

- **[INFO]** 신규 가드 `stray-tool-tags.test.ts`는 저장소 실경로(`plan/`, `spec/`, 약 890개 `.md`)를 읽기 전용으로 스캔하고, fixture는 격리된 `os.tmpdir()` 임시 디렉터리에서 `try/finally`로 정리한다 — 저장소 트리에 쓰기 부작용 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:106-118`(`findStrayTags` — `fs.readFileSync`만 사용), `:173-196`(fixture 테스트 — `fs.mkdtempSync`/`fs.writeFileSync`/`fs.rmSync(..., {recursive:true, force:true})` 로 저장소 밖 경로만 다루고 `finally`에서 확실히 정리)
  - 상세: 이 파일이 도입한 유일한 쓰기 호출(`fs.writeFileSync`, `fs.mkdirSync`)은 전부 `path.join(os.tmpdir(), "stray-tags-fixture-*")` 하위에서만 일어나고, 저장소 경로(`repoRoot()` 기반)에는 `fs.readFileSync`만 호출한다 — 소스를 직접 열어 확인했다.
  - 제안: 조치 불요(정보성 확인).

- **[INFO]** `plan/complete/*.md`·`plan/in-progress/webchat-usewidget-extraction.md`에서 도구 아티팩트 태그(`</content>`, `</invoke>`) 삭제 — 코드/툴링 의존성 0건 재확인
  - 위치: `plan/complete/agent-memory-model-config.md`, `plan/complete/agent-memory-model-select.md`, `plan/complete/fix-model-select-label.md`, `plan/complete/webchat-session-apibase-binding.md`, `plan/in-progress/webchat-usewidget-extraction.md`(각 파일 말미)
  - 상세: `grep -rln "</content>\|</invoke>" .claude codebase` (review/ 및 *.test.ts 제외)를 독립적으로 재실행 — 0건. 이 문자열을 파싱 마커로 쓰는 비-테스트 코드가 없음을 직접 확인했다.
  - 제안: 없음.

- **[INFO]** `error-codes.ts` JSDoc 6줄 추가는 순수 주석이라 부작용 표면이 원천적으로 없음 — 다만 이 코멘트가 밀려 파일 내 다른 문서의 줄번호 인용이 stale해짐(이미 이번 PR이 자체 정정)
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts:1-9`
  - 상세: RESOLUTION 4R(`review/code/2026/09/01/23_28_32/RESOLUTION.md` W2)이 이 JSDoc 삽입으로 `spec-conventions-engine-error-code-surface.md:58`의 `error-codes.ts:114-115` 줄번호 인용이 `:122`로 밀렸음을 스스로 발견해 앵커 문구로 치환했다고 기록한다. `plan/**`·`.claude/docs/**` 전수(`error-codes.ts:<줄>` 패턴)에서 이 1건뿐이었다는 주장을 grep으로 재확인했다 — 추가로 드러난 stale 인용은 없다.
  - 제안: 없음(이미 같은 PR 안에서 조치 완료).

## 요약

이번 changeset의 실질 부작용 표면은 4개 파일(`plan_guard.py`, `tree-walk.ts`, `stray-tool-tags.test.ts`(신규), `spec-links.test.ts`)로 좁고, 나머지 3개(`plan-lifecycle.md`, `error-codes.ts`, `error-codes.md`)는 순수 문서/주석 편집이다. `plan_guard.py`의 `_CHECKBOX` 확장은 모듈 전역이지만 유일한 소비 경로가 in-progress plan의 Stop 소프트 넛지로 국한되고 push 하드 블록에는 영향이 없음을 두 소비자 훅 파일을 직접 열어 재확인했다. `walkTree` 시그니처 확장(`string[]`→`readonly string[]`)은 공변 widening이고 6개 호출부 전부 `__tests__/` 내부에 있어 파괴적이지 않다. 신규 가드 테스트는 저장소 실경로를 읽기 전용으로만 스캔하고 fixture 쓰기는 전부 격리된 임시 디렉터리+`finally` 정리로 국한된다. 시그니처·공개 인터페이스가 실제로 깨지는 사례, 의도치 않은 전역 상태 변경, 예상치 못한 파일 생성/삭제, 환경 변수 읽기/쓰기, 네트워크 호출, 콜백/이벤트 발생 패턴 변경은 발견되지 않았다. 유일하게 남는 관찰은 `plan-stale-audit.sh`(별도 셸 스크립트)가 이번 정규식 확장을 받지 않아 두 SoT 간 진행률 신호 drift가 한 단계 더 벌어진다는 점인데, 이는 이미 이전 라운드에서 의도적으로 범위 밖으로 등재된 기존 상태의 연장이라 이번 PR을 막을 사유는 아니다.

## 위험도

LOW
