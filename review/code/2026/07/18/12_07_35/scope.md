# 변경 범위(Scope) 코드 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
- `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`

## 컨텍스트 확인 방법
`review/code/2026/07/18/12_07_35/meta.json` 은 두 파일을 `change_type: "Review"`(전체 파일)로만 제공하므로, 실제 변경분을 파악하기 위해 `git diff origin/main...HEAD`(브랜치 전체 diff)와 최신 커밋 단독 diff(`git diff ef1227b76 2765ed767`)를 함께 확인했다. 이 브랜치는 두 커밋으로 구성된다.

1. `ef1227b76` — self-test fixture 보강(union/object-property/return/ternary 폼, regex 비오염, `.tsx` ScriptKind 분기) + `interaction-type-registry.ts` JSDoc "grep 가드"→"AST 가드" 정정 3곳. 이 커밋은 이미 `review/code/2026/07/18/11_39_42/`(scope=NONE, WARNING 2건)에서 리뷰됨.
2. `2765ed767` — 방금 리뷰 대상인 최신 커밋. `11_39_42` 리뷰의 WARNING #1(역방향 `.ts` 캐스트 미고정)·WARNING #2(self-test 가 실제 fix 라인을 관통하지 않음)를 고치는 후속 반영.

`plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 체크리스트(L109-135 부근)를 대조군으로 썼다 — developer 항목들이 정확히 이 두 파일의 변경 내용과 1:1 대응한다.

## 발견사항

- **[INFO]** 모든 변경이 plan 체크리스트 항목과 정확히 1:1 대응
  - 위치: `interaction-type-exhaustiveness.test.ts` 전체, `interaction-type-registry.ts` L14·L63-64
  - 상세:
    - `interaction-type-registry.ts` 의 JSDoc "grep 가드" → "AST 가드" 정정 3곳은 plan 체크리스트 "`lib/conversation/interaction-type-registry.ts` 상단 JSDoc · `IS_MULTI_TURN_INTERACTION` 위 주석의 'grep 가드' 표현 → 'AST 가드' 정정(`/ai-review` INFO #1)" 항목과 정확히 일치(3곳 전부).
    - `interaction-type-exhaustiveness.test.ts` 의 신규 self-test(union-type/object-property/return/ternary 케이스, regex 비오염 케이스, `.tsx` `scriptKindForFile` 분기)는 "self-test fixture 보강(`/ai-review` INFO #2·#3·#4)" 항목과 정확히 일치.
    - 최신 커밋(`2765ed767`)의 `parseGuardSource` chokepoint 추출·`collectStringLiteralsFrom` 분리·`treeContainsJsx` 시그니처 변경(`(source, kind)` → `(sourceFile)`)·역방향 `.ts` 캐스트 self-test 추가는 plan 의 "`/ai-review` (LOW, C0/W2) 후속 반영: W1(...) + W2(...)" 문단과 정확히 일치하며, 커밋 메시지도 동일 근거(WARNING #1·#2)를 명시한다.
  - 판단: 요청 이상의 추가 수정, 무관한 리팩토링, 기능 확장은 없음.

- **[INFO]** 리팩토링(`treeContainsJsx` 시그니처 변경, `collectStringLiteralsFrom` 분리)이 목적에 종속적
  - 위치: `interaction-type-exhaustiveness.test.ts` L125-135(`collectStringLiteralsFrom`), L150-190(`treeContainsJsx`)
  - 상세: `treeContainsJsx` 를 `(source, kind)` 대신 이미 파싱된 `SourceFile` 을 받도록 바꾼 것은 "self-test 가 프로덕션 파싱 경로(`parseGuardSource`)를 실제로 관통하게 만든다"는 WARNING #2 수정과 필연적으로 묶인 변경이다. 임의의 스타일 리팩토링이 아니라, 이 변경이 없으면 W2 가 고쳐지지 않는다(수정 커밋 diff 로 실측: 舊 시그니처는 `scriptKindForFile` 을 직접 호출해 실제 fix 라인을 우회했음). 목적과 분리 불가능한 최소 변경.
  - 판단: 불필요한 리팩토링 아님.

- **[INFO]** import 변경 없음, 설정 파일 변경 없음, 무관 파일 수정 없음
  - 위치: 전체 diff (`git diff origin/main...HEAD` 두 파일 한정)
  - 상세: 두 파일 diff 에 신규/삭제 import 가 없다. `package.json`, `tsconfig.json`, lint 설정 등 무변경. 두 파일 외 코드 영역(예: `use-execution-events.ts`, `apply-execution-snapshot.ts` 등 REGISTRY_SITES 대상 파일)도 무변경 — 가드가 검증하는 프로덕션 분기 코드 자체는 건드리지 않았다.
  - 판단: 문제 없음.

- **[INFO]** 함께 커밋된 `review/code/2026/07/18/11_39_42/**` 및 `plan/**` 변경은 프로젝트 규약상 정상 동반물
  - 위치: `2765ed767` 커밋의 `plan/in-progress/interaction-type-guard-comment-false-negative.md`, `review/code/2026/07/18/11_39_42/*`
  - 상세: CLAUDE.md/개발자 워크플로 규약상 `/ai-review` 산출물(SUMMARY/RESOLUTION 등)과 plan 체크리스트 갱신은 같은 커밋에 동반되는 것이 표준(review/ 는 gitignore 대상 아님, "커밋 후에만 체크박스 체크"). 이번 리뷰 대상인 소스 파일 2개 외 영역이지만, scope 이탈이 아니라 워크플로 준수.
  - 판단: 문제 없음.

- **[INFO]** 주석/포맷팅 변경은 전부 코드 변경과 동반, 순수 포맷팅-only diff 없음
  - 위치: `interaction-type-exhaustiveness.test.ts` 전반의 JSDoc 갱신(`collectCodeStringLiterals`, `treeContainsJsx` 등)
  - 상세: 주석 수정은 시그니처·동작 변경을 설명하도록 갱신된 것으로, 코드와 별개로 떠도는 주석 정리가 아니다. 공백/줄바꿈만 바뀐 hunk 는 diff 에 없음.
  - 판단: 문제 없음.

## 요약
두 파일의 diff 는 plan 체크리스트("grep 가드"→"AST 가드" 주석 정정, self-test fixture 보강)와 직전 `/ai-review`(11_39_42) 의 WARNING #1·#2 를 그대로 좇는 후속 반영으로, 코드·커밋 메시지·plan 문서 세 축이 서로 정확히 대응한다. 요청 이상의 추가 수정, 무관한 리팩토링, 기능 확장, import/설정 변경, 순수 포맷팅 변경은 발견되지 않았다. `treeContainsJsx` 시그니처 변경 등 구조적 리팩토링도 목적(self-test 가 실제 fix 라인을 관통하도록)과 분리 불가능한 최소 변경이라 "불필요한 리팩토링"에 해당하지 않는다.

## 위험도
NONE
