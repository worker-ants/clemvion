# 부작용(Side Effect) 리뷰 — output-shape 이월 처분 (#983 후속)

## 검토 범위 확인
`git diff 860aad982 HEAD --stat` 로 실제 diff가 prompt에 제시된 3개 파일과 정확히 일치함을 확인:
- `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts`
- `codebase/frontend/src/components/editor/run-results/output-shape.ts`
- `plan/in-progress/output-shape-comment-followups.md` (신규)

`output-shape.ts`의 실제 diff를 재확인한 결과, 변경분은 `isConversationOutput` 함수 위 JSDoc 블록(영어→한국어 통일 + SoT 위임 문구 추가)에만 걸려 있고, `export function isConversationOutput(...)` 본문(라인 1217~1276, `unwrapNodeOutput`, `toRecord` 등 나머지 export 함수 포함)은 diff 컨텍스트로만 표시되고 실제로는 한 글자도 바뀌지 않았다.

### 발견사항

- **[INFO]** 로직 변경 없음 — 순수 주석/문서 개정
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts` (JSDoc 블록만, 라인 972~1052 diff hunk)
  - 상세: `isConversationOutput`, `unwrapNodeOutput`, `extractIeSnapshot`, `extractAiMetadata` 등 export 함수 시그니처·본문·반환 타입 전부 무변경. 전역 상태·환경 변수·네트워크·이벤트/콜백에 영향 없음. 이 파일이 "대화 UI 전체의 게이트"라는 plan 문서 자체의 서술대로 리스크가 큰 함수이지만, 이번 커밋은 그 판정 로직을 전혀 건드리지 않아 회귀 위험이 사실상 없다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** 신규 테스트 케이스 1건 추가 — 테스트 전용, 부작용 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:796-833` (`"rejects result.messages when the endReason key is absent entirely"`)
  - 상세: 순수 in-memory 객체 리터럴을 `isConversationOutput`에 넣고 `expect(...).toBe(false)`만 하는 결정론적 단위 테스트. 파일시스템·네트워크·전역 상태·mock/stub 부작용 없음. 기존 39개 테스트도 주석만 갱신(assertion·fixture 값 불변) — `git diff`로 실제 `expect(...)` 라인이 바뀌지 않았음을 위 파일 전체 재독으로 확인.
  - 제안: 없음.

- **[INFO]** 신규 plan 문서 파일 생성 — 의도된 산출물, 정책 부합
  - 위치: `plan/in-progress/output-shape-comment-followups.md` (신규, 163줄)
  - 상세: CLAUDE.md 규약상 `plan/in-progress/<name>.md`는 developer 역할이 진행 중 작업을 기록하는 정규 위치이며, frontmatter에 `worktree`/`owner`/`spec_impact: none`도 규약대로 채워져 있다. "예상치 못한 파일 생성"에 해당하지 않는다 — PR 리뷰 대상 diff에 명시적으로 포함돼 있고 작업 추적 목적에 정확히 부합한다.
  - 제안: 없음. 다만 체크리스트 마지막 항목(`/ai-review` + Critical/Warning 반영)이 아직 미체크(`- [ ]`) 상태이므로, 이 리뷰 결과 반영 후 plan 파일의 체크박스를 갱신해야 완결된다(코드 부작용은 아니고 프로세스 항목).

- **[INFO]** 공개 API/인터페이스 무변경
  - 위치: `output-shape.ts` export 목록 전체 (`unwrapNodeOutput`, `isConversationOutput`, `extractIeSnapshot`, `extractAiMetadata`, `extractTurnDebug`, 타입 re-export 등)
  - 상세: 함수 시그니처, 반환 타입, export 목록 모두 이전과 동일. `result-detail.tsx`, `result-timeline.tsx` 등 3개 호출부(boolean 소비)에 영향 없음.
  - 제안: 없음.

## 요약
이번 변경은 `isConversationOutput`의 실제 판정 로직(OR-체인/AND-guard)은 전혀 건드리지 않고 JSDoc 주석을 영어→한국어로 통일하며 근거의 SoT를 JSDoc으로 위임하는 문서화 작업, 테스트 파일의 주석 정리, 그리고 `endReason` 키 완전 부재 케이스를 고정하는 신규 단위 테스트 1건 추가, 마지막으로 관례에 맞는 plan 추적 문서 신설로 구성된다. 전역 상태·환경 변수·파일시스템(의도된 plan 문서 제외)·네트워크·시그니처·공개 인터페이스·이벤트/콜백 중 어느 축에서도 의도치 않은 부작용이 관측되지 않았다.

## 위험도
NONE
