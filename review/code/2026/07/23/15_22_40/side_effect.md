# 부작용(Side Effect) 리뷰 — output-shape 이월 처분 4라운드 (15_22_40)

## 검토 범위 확인

fork-point(`git merge-base HEAD origin/main` = `860aad982`) 기준 `git diff 860aad982..HEAD --stat` 로
실제 diff 가 prompt 에 제시된 36개 파일과 정확히 일치함을 확인했다 (36 files changed, 2644
insertions(+), 58 deletions(-), 삭제된 파일 없음).

주의: `origin/main` 을 그대로 fetch 해 diff 베이스로 쓰면 origin/main 이 fork-point 이후 1커밋
(`2fa01a0fe`, `.claude/agents/*.md` / `line_anchors.py` 등)을 추가로 앞서가 있어 무관한 변경이
reverse-diff 로 섞여 들어온다(과거 세션에서 이미 알려진 함정). `merge-base` 로 재계산해 배제했고,
prompt 파일의 36개 파일 목록과 정확히 일치함을 재확인했다.

- `codebase/frontend/src/components/editor/run-results/output-shape.ts` (79줄, 순수 JSDoc)
- `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` (153줄, 주석 재정리 + 신규 테스트 3건)
- `plan/complete/output-shape-comment-followups.md` (신규 275줄)
- `review/code/2026/07/23/{14_19_49,14_34_01,14_48_38}/**` (선행 3라운드 리뷰 산출물, 33개 파일)

## 발견사항

- **[INFO]** `output-shape.ts` 실행 로직 완전 무변경 — 순수 JSDoc 재작성
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts`
  - 상세: `git diff 860aad982..HEAD -- output-shape.ts` 를 `^[+-]` 라인 기준으로 필터링해
    `/**`, `*`, `*/` 로 시작하지 않는 변경 라인이 0건임을 직접 실측했다. `isConversationOutput`
    함수 시그니처·본문·반환 타입, `unwrapNodeOutput`/`extractIeSnapshot`/`extractAiMetadata` 등
    나머지 export 전부 바이트 단위로 무변경. 전역 상태·환경 변수·네트워크·이벤트/콜백에 영향을
    줄 실행 경로 자체가 diff 에 없다.
  - 제안: 없음 (확인용).

- **[INFO]** 신규 테스트 3건 — 순수 in-memory fixture, 부작용 없음
  - 위치: `output-shape.test.ts` — `"rejects result.messages when the endReason key is absent
    entirely"`, `"detects a terminal whose endReason sits at output.endReason, not
    result.endReason"`, `"prefers result.endReason over output.endReason when both are present"`
  - 상세: 세 테스트 모두 리터럴 `raw` 객체를 `isConversationOutput(raw)` 에 넣고
    `expect(...).toBe(boolean)` 만 수행하는 동기 순수함수 호출이다. `vi.mock`/`vi.spyOn`,
    `global.*`, `process.env`, `fetch`, `localStorage`/`window.*` 등 grep 결과 파일 전체에서
    0건 — mock/stub, 전역 오염, 네트워크·스토리지 접근 전혀 없음. 기존 6개 테스트도 assertion·
    fixture 값은 그대로이고 주석만 재작성됐다(diff 로 직접 대조).
  - 제안: 없음.

- **[INFO]** 신규 plan 문서 및 review 산출물 신설 — 정책상 정규 위치, 예상치 못한 파일시스템 부작용 아님
  - 위치: `plan/complete/output-shape-comment-followups.md` (275줄, 신규),
    `review/code/2026/07/23/{14_19_49,14_34_01,14_48_38}/**` (33개 파일, 선행 3라운드 리뷰
    산출물: `RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/7개 reviewer `.md`)
  - 상세: CLAUDE.md 정보 저장 위치 표에 `plan/complete/`(완료된 작업)와
    `review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`(코드 리뷰 산출물)가 정확히 규정돼 있고, 사용자
    메모(`feedback_plan_checkbox_actual_state`)도 "review/ 는 gitignored 아님(SUMMARY·RESOLUTION
    도 커밋)"을 명시한다. 이번 diff 는 그 규약을 그대로 따른 결과물이며, 코드 실행 중 생성되는
    파일이 아니라 개발/리뷰 워크플로 산출물이다. `plan/in-progress/output-shape-comment-
    followups.md` 로 시작해 최종적으로 `plan/complete/`로 이동(커밋 `628134a5a`)한 이력도
    라이프사이클 규약(in-progress → complete)에 부합한다.
  - 제안: 없음.

- **[INFO]** 공개 API·함수 시그니처·호출자 영향 없음
  - 위치: `output-shape.ts` export 목록 전체
  - 상세: `isConversationOutput(outputData: unknown): boolean` 을 포함해 모든 export 함수의
    파라미터·반환 타입·이름이 변경 전과 동일. `result-detail.tsx`/`result-timeline.tsx` 등
    호출부(이번 diff 범위 밖) 영향 없음.
  - 제안: 없음.

- **[INFO]** 환경 변수·네트워크 호출 없음
  - 상세: 3개 소스/문서 파일과 33개 review 산출물 모두 정적 마크다운/JSON/테스트 코드이며,
    `process.env` 읽기·쓰기, `fetch`/`axios`/외부 서비스 호출 패턴이 diff 전체에서 발견되지
    않았다.
  - 제안: 없음.

## 요약

이번 diff 는 `isConversationOutput` 판정 로직(OR-체인/AND-guard) 을 전혀 건드리지 않는 JSDoc
전면 한국어화(순수 comment-only, non-comment diff 0줄 실측 확인)와, `endReason` 2단 조회
(fallback + 우선순위)를 고립시키는 신규 단위 테스트 3건(모두 순수 in-memory fixture, mock·전역·
네트워크 접근 0건) 으로 구성된다. 나머지 변경은 plan 라이프사이클 규약에 따른 `plan/complete/`
문서 신설과, 프로젝트 규약이 정한 정규 위치(`review/code/<date>/<time>/`)에 쌓인 선행 3라운드
리뷰 산출물(모두 이미 커밋 규약상 정상)이다. 전역 상태·전역 변수·파일시스템·함수 시그니처·공개
인터페이스·환경 변수·네트워크 호출·이벤트/콜백 어느 축에서도 의도치 않은 부작용은 관측되지
않았다.

## 위험도
NONE
