# 변경 범위(Scope) 리뷰

## 사전 검증 — 실제 diff 범위 확인

`git diff origin/main --stat` 는 41개 파일(정보 추출기 핸들러 삭제, `node-handler.interface.ts` 등 무관 변경)을
보여주나, 이는 `origin/main`(`d25f552b2`)이 이 브랜치의 fork-point(`22cc48ef3`)보다 앞서 별도 PR(#978,
IE endMultiTurnConversation)을 머지해 생기는 **known reverse-diff 오염**이다(이 저장소의 기존 known failure
pattern, `plan/in-progress/interaction-type-guard-comment-false-negative.md` 후속 항목에도 동일 계열 기록).
`git diff 22cc48ef3..HEAD --stat`(fork-point 기준)로 재확인한 결과, 이 브랜치 자신의 유일한 커밋
(`465abf334`)이 만드는 변경은 정확히 scope.md payload 가 나열한 11개 파일과 **1:1 일치**한다. 따라서 아래
평가는 이 11개 파일을 실제 변경 범위로 확정하고 진행한다.

## 발견사항

- **[INFO]** 리뷰 세션 산출물(파일 4~11, `review/consistency/2026/07/18/12_04_53/**`)이 코드 diff(파일 1~3)와
  같은 커밋에 동봉됨
  - 위치: `review/consistency/2026/07/18/12_04_53/SUMMARY.md` 외 7개 신규 파일
  - 상세: 이 파일들은 developer 의무인 "구현 착수 직전 `/consistency-check --impl-prep`" 게이트를 실행한
    산출물이며, `CLAUDE.md`/`plan-lifecycle.md` 관례상 `review/` 는 gitignored 가 아니라 커밋 대상이다.
    plan 파일(파일 3) 자체가 이 세션(`review/consistency/2026/07/18/12_04_53/`)을 "②③ 구현" 의 impl-prep
    근거로 명시 인용하고 있어, 코드 변경과 프로세스 게이트 산출물이 같은 커밋에 있는 것은 의도된 절차이지
    scope 이탈이 아니다. Blocking 아님 — 참고 기록.

- **[INFO]** self-test 의 `it()` 제목 변경 (`"collects code literals and ignores mentions inside comments"`
  → `"collects code literals across branch shapes and ignores comments/regex"`)
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
  - 상세: plan 후속 항목 "self-test fixture 보강(union 타입 선언·객체 프로퍼티 값 형태, 정규식 리터럴
    비오염 케이스)" 이 실제로 테스트 커버리지를 확장했으므로, 제목이 그 확장된 범위를 반영하도록 바뀐 것은
    타당하다. 순수 wording 변경이 아니라 실제 fixture/assertion 추가와 1:1 대응하므로 무관한 수정이 아님.

- **[INFO]** 개별 `expect()` 2줄 → `for` 루프 리팩터
  - 위치: 동일 파일, `real_literal`/`real_template` 단언부
  - 상세: 신규 real 값 3개(`real_union_a`/`real_union_b`/`real_prop`)가 추가되며 5개 값을 순회 단언해야 하므로
    루프화는 fixture 확장에 직접 종속된 최소 변경이다. 무관한 리팩토링이 아님.

## 관점별 확인 결과

1. **의도 이상의 변경**: 없음. `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` ·
   `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 두 실 코드 파일의 diff는 plan
   `interaction-type-guard-comment-false-negative.md` 의 두 "[developer, 선택]" 후속 항목(JSDoc "grep 가드"→
   "AST 가드" 정정, self-test fixture 보강)을 문언 그대로 구현한다. `.tsx`/`ScriptKind` 분기 항목은 plan 이
   명시적으로 "철회"라 밝히고 실제로 diff 에도 없다 — 의도한 대로.
2. **불필요한 리팩토링**: 없음. `registry.ts` 는 순수 주석(용어) 치환 3곳뿐, 로직·export·타입 시그니처
   무변경. 테스트 파일의 루프화도 위 INFO 참고와 같이 fixture 확장에 종속된 최소 변경.
3. **기능 확장(over-engineering)**: 없음. 새 가드 로직·새 API·새 export 없음. 순수 문서/테스트 보강.
4. **무관한 수정**: 없음(위 "사전 검증" 참고 — `git diff origin/main` 이 보여주는 무관 파일들은 fork-point
   오염이며 이 브랜치 자신의 커밋에 포함되지 않음). 코드 2파일 + plan 1파일 + 필수 리뷰 산출물 8파일 모두
   본 작업과 직결.
5. **포맷팅 변경**: 없음. 공백·줄바꿈만의 변경 없음, 모든 hunk 가 의미 있는 텍스트/코드 변경.
6. **주석 변경**: `registry.ts` 의 "grep 가드"→"AST 가드" 3곳은 plan 이 명시적으로 요청한 항목이며, spec
   `interaction-type-registry.md` §5 Rationale 이 이미 "AST 가드" 로 확정한 용어에 코드 주석을 뒤늦게
   맞추는 동기화(사실 변경 없음, `rationale_continuity.md` 가 독립적으로 동일 결론). 테스트 파일 상단 JSDoc
   추가(정규식 리터럴 미수집 근거 설명)도 self-test 확장과 직결. 불필요한 주석 변경 없음.
7. **임포트 변경**: 없음. 두 코드 파일 모두 import 문 변경 없음.
8. **설정 변경**: 없음. `tsconfig`/`eslint`/`package.json` 등 설정 파일 변경 없음.

## 요약

실제 fork-point 기준 diff(11개 파일)는 plan `interaction-type-guard-comment-false-negative.md` 의 두 선택적
developer 후속 항목(JSDoc 용어 정정, self-test fixture 보강)에 정확히 대응한다. `registry.ts` 는 주석 3곳만
바뀌고 로직·타입·export 는 전혀 건드리지 않았으며, 테스트 파일 변경은 명시된 fixture 형태(union 타입 선언·
객체 프로퍼티 값·정규식 리터럴 비오염)만 추가하고 plan 이 스스로 철회한 `.tsx` 분기는 포함하지 않아 요청
범위를 초과하지 않았다. `plan/*.md` 체크박스 갱신은 프로젝트 관례(체크박스=실제 상태, 같은 커밋 포함)를
따른 필수 bookkeeping이며, `review/consistency/2026/07/18/12_04_53/**` 8개 신규 파일은 developer impl-prep
의무 게이트의 산출물로 커밋 대상 규약에 부합한다. `git diff origin/main --stat` 에서 보이는 무관 파일들은
origin/main 이 fork-point 를 앞선 데서 오는 known reverse-diff 오염이며 이 브랜치 자신의 커밋에는 포함되지
않는다. Critical/Warning 급 범위 이탈 없음.

## 위험도
NONE
