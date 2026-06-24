# RESOLUTION — M-4 ParkEntryDispatch 추출 (review/code/2026/06/24/15_44_39)

대상 커밋: `ecd70dd1` · Risk LOW · Critical 0 · Warning 2 · INFO 10 · 수렴(코드 무변경)

## Critical
없음.

## WARNING — 둘 다 SPEC-DRIFT → **후속 planner spec-sync PR** (코드 무변경)

본 PR 은 behavior-preserving developer 리팩터(codebase-only). spec/ 는 planner 영역(developer read-only)이라 두 SPEC-DRIFT 는 본 PR 에서 수정 불가 — **후속 planner spec-sync PR** 이 일괄 처리:

- **W1**: `interaction-type-registry.md` §1.2 끝에 park-entry 라우팅 노트(§54 resume 노트와 대칭, `buildParkEntryRegistry`/`dispatchParkEntry`, first-match-wins form→buttons→ai) 추가.
- **W2**: 동 파일 frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 등재(`resume-turn-dispatch.ts` 와 대칭).
- (동반) `4-execution-engine.md` Rationale 에 park-entry registry 추출 기록(I1) + plan M-4 노트 impl-first 갱신(impl-prep W3).

spec-code-paths 가드는 forward-only(listed 경로 존재 검사)라 미등재가 guard fail 아님 — 본 PR 정상.

## INFO — 전부 defer (근거)

| # | 항목 | 판정 |
|---|------|------|
| 1 | `dispatchParkEntry` undefined 반환 타입 명시 | `ProcessTurnResult = void\|ParkSignal` 라 `undefined`=void 정합 + JSDoc 명시. cosmetic. |
| 2 | `satisfies Record<WaitingInteractionType>` | registry 는 ordered **array**(first-match-wins)라 keyed Record 패턴 부적합. resume 측 동일. unit 7 이 순서·exhaustive 커버. |
| 3 | graphEdges ISP | 조기 최적화 회피(reviewer 동의). |
| 4,9 | 테스트 인덱스/handle 위임 커버리지 | 순서·위임 동형 보증, 별 it 커버. |
| 5,6,7,8 | JSDoc 보강(필드/태그/deps) | minor doc. **high-risk 파일(execution-engine) re-review 사이클 비용 > 가치** → loop avoidance. 후속 정리 후보. |
| 10 | impl-prep 산출물 구현 커밋 동봉 | 워크플로 규약상 정상. 차단 아님. |

## 검증
- lint·build·unit(park-entry-dispatch.spec **7** 포함)·**e2e 214 PASS**(park/resume·render_* 회귀 커버)
- impl-prep `review/consistency/2026/06/24/15_38_48/` BLOCK:NO
- 코드 무변경 수렴 — review/** 전용 커밋으로 종결(review_guard 재무장 회피)
