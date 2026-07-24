# 부작용(Side Effect) 리뷰 — output-shape.ts / output-shape.test.ts / plan 문서 / 이전 리뷰 산출물 (3차 라운드)

## 검증 방법

`git diff origin/main --stat` 로 이번 changeset 전체(25개 파일)가 prompt 에 제시된 목록과 정확히
일치함을 확인했다. 이어서 `output-shape.ts` 의 diff 를 non-comment 라인만 걸러 재확인:

```
git diff origin/main -- codebase/frontend/src/components/editor/run-results/output-shape.ts \
  | grep -E '^[+-]' | grep -v '^+++' | grep -v '^---' \
  | grep -vE '^\+\s*\*|^\-\s*\*|^\+\s*/\*|^\-\s*/\*|^\+\s*\*/|^\-\s*\*/'
```

결과 **0줄** — 변경된 모든 라인이 JSDoc 블록(`*` 로 시작) 안이며, 실행 코드(함수 시그니처·본문·
import·export)는 한 글자도 바뀌지 않았다. `output-shape.test.ts` 의 신규 추가분도 전량 확인 —
3개 `it()` 블록 전부 로컬 `raw` 객체 리터럴 + `expect(isConversationOutput(raw)).toBe(...)` 로만
구성된다.

## 발견사항

- **[INFO]** `output-shape.ts` 는 순수 JSDoc 재작성 — 부작용 표면 0
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:111-152` (diff hunk)
  - 상세: 위 grep 필터로 실측 확인한 대로 `isConversationOutput` 을 비롯한 어떤 export 함수의
    시그니처·반환 타입·판정 로직도 바뀌지 않았다. 새 전역 변수, 모듈 레벨 부수효과(import 시점
    실행 코드), 환경 변수 읽기/쓰기, 네트워크 호출 모두 도입되지 않았다. 3곳의 호출부
    (`result-detail.tsx:1006·1052`, `result-timeline.tsx:73`)는 이번 diff 로 영향받지 않는다.
    1·2차 라운드 side_effect 리뷰(`review/code/2026/07/23/14_19_49/side_effect.md`,
    `14_34_01/side_effect.md`)의 동일 결론을 이번 라운드에서도 독립적으로 재확인했다.
  - 제안: 없음 (확인 완료).

- **[INFO]** 신규 테스트 3건은 격리된 로컬 fixture만 사용 — 공유 상태·부작용 없음
  - 위치: `output-shape.test.ts` — `"rejects result.messages when the endReason key is absent
    entirely"`, `"detects a terminal whose endReason sits at output.endReason, not
    result.endReason"`, `"prefers result.endReason over output.endReason when both are present"`
  - 상세: 세 테스트 모두 함수 스코프 로컬 `raw` 객체만 생성해 순수 함수 `isConversationOutput`
    을 호출하고 반환값만 assert 한다. `beforeEach`/`afterEach`/module mock/module-level 변수
    변형이 관여하지 않아 테스트 실행 순서·병렬 실행에 부작용이 없다. `vi.mock`, `spyOn`,
    타이머 조작, `process.env` 접근 등 어떤 형태의 전역/환경 개입도 없다.
  - 제안: 없음.

- **[INFO]** 신규 파일 생성 25건 전부 프로젝트 관례에 따른 기대된 부작용
  - 위치: `plan/in-progress/output-shape-comment-followups.md` (신규),
    `review/code/2026/07/23/{14_19_49,14_34_01}/**` (신규 22개 — 이전 두 라운드의 리뷰 산출물)
  - 상세: `git diff origin/main --stat` 로 이번 changeset 이 만드는 파일시스템 부작용은 신규
    파일 추가뿐임을 확인했다(삭제·기존 파일 덮어쓰기 없음). 전부 CLAUDE.md "정보 저장 위치"
    규약에 부합 — `plan/in-progress/**` 는 developer 작업 추적 정규 위치, `review/code/**` 는
    `/ai-review` 워크플로가 상시 남기는 리뷰 아카이브(gitignore 대상 아님, 커밋 관례). 사용자
    메모리(`feedback_plan_checkbox_actual_state.md`)도 "review/ 는 gitignored 아님(SUMMARY·
    RESOLUTION 도 커밋)" 을 확인해 준다.
  - 제안: 없음 (예상된 부작용, 우발적 아님).

- **[INFO]** `endReason` 2단 조회(`result?.endReason ?? output.endReason`) 로직 자체는 이번 diff
  의 산물이 아님 — 사전 존재 코드
  - 위치: `output-shape.ts` (fallback 로직 — 이번 diff 로 텍스트 변경 없음, JSDoc 서술만 추가)
  - 상세: 위 non-comment grep 결과가 이를 재확인한다. plan 문서·RESOLUTION 이 서술하는 대로
    신규 fixture 2건(`output.endReason` fallback, 우선순위)이 기존 로직의 미고립 경로를 처음
    테스트로 고정했을 뿐, 로직 자체는 이 diff 이전부터 존재했고 변경되지 않았다. "동작이
    바뀌었는가" 관점의 부작용은 없다.
  - 제안: 없음.

- **[INFO]** 리뷰 산출물(`review/code/**/*.md`, `_retry_state.json`, `meta.json`) 은 정적 텍스트/
  JSON 산출물 — 실행되는 코드가 아니므로 부작용 표면 자체가 없음
  - 위치: `review/code/2026/07/23/{14_19_49,14_34_01}/*.{md,json}` (22개 신규 파일)
  - 상세: 이 파일들은 이전 두 라운드의 AI 리뷰 fan-out 산출물이며, 이번 changeset 에 그대로
    포함돼 커밋 대상이 된 것이다. 내용은 마크다운 보고서와 상태 추적 JSON(`_retry_state.json`,
    `meta.json`)으로, 애플리케이션 런타임에 로드되거나 실행되지 않는다. 경로에 절대경로
    (`/Volumes/project/private/clemvion/...`)가 하드코딩돼 있으나 이는 하네스가 세션마다
    생성하는 표준 산출물 포맷이고, 이번 diff 가 새로 도입한 패턴이 아니다(기존 리뷰 산출물과
    동형).
  - 제안: 없음.

## 요약

이번 changeset(25개 파일)은 `output-shape.ts` 의 JSDoc 전면 재작성(영어→한국어, 근거 SoT
명문화), `output-shape.test.ts` 의 주석 정리 + 신규 격리 테스트 3건 추가, 그리고 규약에 맞는
신규 plan 문서 1건 + 이전 두 리뷰 라운드의 산출물 22개 파일 생성으로 구성된다. `git diff` 를
non-comment 라인으로 직접 필터링해 `output-shape.ts` 의 실행 코드가 정확히 0줄 변경됐음을
실측 확인했으므로 함수 시그니처·공개 인터페이스·전역 상태·환경 변수·네트워크 호출·이벤트/콜백
어느 축에서도 부작용이 없다. 신규 테스트는 순수 함수를 로컬 fixture 로 호출하는 격리 테스트라
공유 상태 부작용이 없고, 새로 생성되는 파일들은 모두 프로젝트 관례(plan 라이프사이클, 리뷰
산출물 커밋)가 명시적으로 기대하는 위치·형식에 부합하며 기존 파일을 덮어쓰거나 삭제하지 않는다.
1·2차 라운드 side_effect 리뷰와 결론이 일치하며, 이번 3차 라운드 독립 재검증에서도 동일 결과를
얻었다.

## 위험도
NONE
