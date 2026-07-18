# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 신규 헬퍼 `treeContainsJsx` 는 plan 체크리스트 문구에 명시적으로 나열되지 않음
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (신규 함수, `collectCodeStringLiterals` 아래)
  - 상세: plan 의 후속 항목 문구는 "등록 사이트 `.tsx` 확장 시 `scriptKindForFile` 이 확장자로 `ts.ScriptKind` 를 분기" 라고만 적혀 있고 `treeContainsJsx` 라는 별도 검증 헬퍼는 텍스트에 이름이 없다. 다만 diff 내 주석이 그 필요성을 명확히 설명한다 — `.tsx` 오파싱(`ScriptKind.TS` 로 강제)과 정상 파싱 모두 동일한 string literal 집합을 에러 복구로 수집하므로, literal 존재 여부만으로는 `.tsx` 분기가 실제로 JSX 를 인식했는지 구분할 수 없다. 그래서 트리 모양(JSX 노드 존재)을 별도로 단언하는 헬퍼가 필요하며, 이는 "새 케이스 3건 전부 양방향 mutation 실측" 이라는 plan 서술과 부합하는 구현 세부사항이다. 범위 이탈이라기보다 동일 후속 항목(INFO #4)의 구현 디테일로 판단됨.
  - 제안: 조치 불요. 필요 시 plan 텍스트에 헬퍼명 언급을 보강하면 추적성이 더 좋아지는 정도.

## 검토 상세

3개 변경 파일 모두 동일한 후속 작업 단위로 수렴한다:

1. `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` — plan 의 "self-test fixture 보강 (`/ai-review` INFO #2·#3·#4)" 항목 그대로. 추가된 3개 테스트 케이스(union 타입/객체 프로퍼티/return/삼항 형태, regex 리터럴 비오염, `.tsx` JSX 파싱)와 이를 뒷받침하는 `scriptKindForFile`/`treeContainsJsx` 헬퍼, `describe("scriptKindForFile", …)` 블록이 전부 그 항목 범위 안에 있다. 기존 테스트·구조를 건드리지 않고 순수 추가(append)만 이루어졌다.
2. `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` — plan 의 "JSDoc · Record 주석의 'grep 가드' → 'AST 가드' 정정 (`/ai-review` INFO #1)" 항목 그대로. diff 는 정확히 문자열 표현 3곳(`grep 가드` → `AST 가드`)만 바꾸며, 로직·타입·export 는 무변경.
3. `plan/in-progress/interaction-type-guard-comment-false-negative.md` — 위 두 구현이 완료됐음을 체크리스트 갱신으로 기록. 다른 체크리스트 항목이나 frontmatter 는 건드리지 않았다.

이 세 파일 외 추가로 수정된 파일이 없고, import/설정/포맷팅/무관 리팩토링/주석 변경 중 목적과 무관한 항목은 발견되지 않았다. 특히 `interaction-type-registry.ts` diff 는 문자열 리터럴 치환에 한정되어 있어 기능적 회귀 위험이 없다. 테스트 파일 diff 도 순수 추가형이라 기존 가드 동작(리터럴 수집 로직)에 회귀를 유발하지 않는다.

이번 PR 은 직전 PR(#972 계열)의 `/ai-review` INFO #1~#4 를 그대로 후속 반영한 것으로, plan 문서 자체가 "본 PR diff 밖 파일이라 미포함" → "후속 PR 로 반영" 이라는 이력을 명시하고 있어 스코프 근거가 추적 가능하다.

## 요약

세 파일 모두 동일한 plan 의 명시된 후속 체크리스트 두 항목(JSDoc 용어 정정, self-test fixture 보강)에 정확히 대응하며, 그 범위를 벗어난 리팩토링·기능 추가·무관한 파일 수정·포맷팅 혼입은 발견되지 않았다. 신규 `treeContainsJsx` 헬퍼는 plan 문구에 이름이 직접 언급되지 않았지만 같은 후속 항목(`.tsx` ScriptKind 분기 검증)을 의미 있게 만들기 위한 필수 구현 디테일로 판단되어 범위 이탈로 보지 않는다.

## 위험도

NONE
