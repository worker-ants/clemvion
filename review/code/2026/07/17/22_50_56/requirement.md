# 요구사항(Requirement) 리뷰 — interaction-type 가드 정규식 → TS AST 리터럴 전환

## 검증 방법
정적 분석 외에 실제로 실행 검증했다:
- `npx vitest run src/lib/__tests__/interaction-type-exhaustiveness.test.ts` → 3/3 pass.
- `use-result-detail-waiting.ts` L56 의 실제 분기 `"ai_form_render"` → `"ai_form_renderXXX"` 로 mutate 후 재실행 → `Missing WaitingInteractionType branches: ... 'ai_form_render'` 로 정확히 red 전환 확인, 이후 `git checkout --` 로 원복(작업 트리 clean 재확인, 잔여 `.orig` 파일 삭제 완료).
- `conversation-utils.ts` 실제 코드에 `system_error`/`rag` 의 real switch case(L289, L298, L305, L968)와 comment-only 인용(L25 홑따옴표, L295/L301/L716 백틱)이 공존함을 grep 으로 확인 — AST 가드가 comment 인용은 무시하고 real case 로만 판정한다는 plan 의 주장과 일치.
- `npx eslint src/lib/__tests__/interaction-type-exhaustiveness.test.ts` → clean.
- `spec/conventions/interaction-type-registry.md` 전문 확인 — §1.2 rule 3, §2.1, §5 rule 2 의 "grep" 잔존 표현 실재 확인.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` spec 본문의 "grep 대상 파일"/"grep 검증"/"코드 grep 결과" 잔존 표현이 이번 구현 전환 후 문자 그대로는 부정확
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3 ("AST 가드 ... 등록된 **grep 대상 파일**에 string literal 로 등장하는지 검증"), §2.1 `system_error` 행("grep 검증 대상은 ... switch 1개뿐"), §5 rule 2("AST 가드가 매트릭스 vs 코드 **grep 결과**를 build 단계에서 비교 fail")
  - 상세: spec 은 이 가드를 최초 도입(PR #272)부터 1차 명칭으로 **"AST 가드"** 를 5회 일관 사용해왔으나 실제 구현은 지금까지 순수 정규식(`new RegExp`)이었다. 이번 diff 가 `ts.createSourceFile` 기반 실제 AST 파싱으로 전환하면서 코드가 처음으로 spec 의 1차 명칭에 도달했다 — 이는 방향 판별상 "코드가 맞고 spec 본문의 부차 서술(grep)이 낡음" 에 해당한다(계약·매트릭스·등록 사이트·enum 값 목록은 불변이라 의미 충돌 아님). 이미 5개 consistency checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision, `review/consistency/2026/07/17/19_54_00/`) 가 독립적으로 동일 결론(b)에 수렴했고, `plan/in-progress/interaction-type-guard-comment-false-negative.md` "후속" 절도 이를 project-planner 트리비얼 doc-sync 로 명시적으로 이월해뒀다.
  - 제안: 코드 되돌리기 대상 아님. spec 반영 시 `spec/conventions/interaction-type-registry.md` §1.2 rule 3 / §2.1 두 행 / §5 rule 2 의 "grep" 계열 표현을 "AST 스캔"/"등록 사이트 파일"/"AST 파싱 결과" 등으로 정리 — project-planner 소관, 이번 developer 작업의 선행/차단 조건 아님.

- **[INFO]** diff 범위 밖이지만 동일 계열의 잔존 표현이 `interaction-type-registry.ts` (소스 모듈)에도 있음
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 상단 JSDoc ("테스트는 여기서 import 해 **grep 가드**...를 수행한다") 및 `IS_MULTI_TURN_INTERACTION` 위 주석("왜 **grep 가드**가 아니라 이 방식인가")
  - 상세: 이번 리뷰 대상 diff 에는 포함되지 않은 인접 소스 파일이나, 정확히 같은 명명 이슈(구현이 AST 로 바뀌었는데 주석은 "grep 가드"로 남음)를 갖고 있다. 본 PR 이 대상 테스트 파일 자체의 JSDoc/주석은 전수 갱신했음을 확인했으나(파일 내 `grep` grep 결과 0건), 이 인접 소스 파일은 손대지 않아 표현이 어긋난 채 남았다.
  - 제안: 차단 아님. developer 소유 파일(코드)이므로 후속 커밋에서 "grep 가드" → "AST 가드"/"literal-scan" 류로 정정하면 서술 정합이 완전해진다. 이번 PR 의 범위(주석 false-negative 차단)에는 필수 아님.

- **[INFO]** 자체 self-test(`collectCodeStringLiterals` describe 블록)가 검증하는 형태가 JSDoc 이 주장하는 커버리지보다 좁음
  - 위치: `interaction-type-exhaustiveness.test.ts` L123-150 `describe("collectCodeStringLiterals", ...)`
  - 상세: 함수 docstring 은 "switch case·`===`·union 타입 선언·객체 프로퍼티 값·`return`·삼항 등 모든 정당한 코드 리터럴 형태를 놓치지 않는다"고 주장하지만, self-test fixture 는 `===` 비교와 template literal 두 형태 + 6종 comment 형태만 명시적으로 검증한다. union 타입 선언·객체 프로퍼티 값·`return`·삼항 형태에 대한 전용 fixture 는 없다. 다만 이 갭은 실질적으로는 하위의 두 실제 exhaustiveness 테스트(REGISTRY_SITES/SOURCE_REGISTRY_SITES, 실제 저장소 파일 대상)가 그 형태들을 실제로 포함한 파일에 대해 green 으로 실행되며 간접 검증하고, 본 리뷰에서 mutation 실측으로도 실동작을 재확인했다 — 기능적 결함은 아니며, self-test 문서화 정밀도 수준의 잔여 사항이다.
  - 제안: 선택적. self-test fixture 에 union 타입 선언/객체 프로퍼티 값/return/삼항 형태를 추가하면 "이 가드 자신의 메커니즘"에 대한 회귀 방지가 더 좁아지지 않는다(현재도 충분히 안전하나 문서-테스트 정합이 개선됨). 블로킹 사유 아님.

## 요약

diff 는 정규식 grep 기반 exhaustiveness 가드를 TypeScript 컴파일러 API 기반 실제 AST string-literal 파싱으로 교체해, "주석 안 인용만으로 가드를 통과시키는" false-negative(PR #968 이 mutation 으로 실측한 결함)를 구조적으로 차단한다. 실행 검증 결과 (1) 3개 테스트 모두 pass, (2) 실제 프로덕션 분기(`use-result-detail-waiting.ts` L56)를 mutate 하면 가드가 정확히 red 로 전환되고 comment-only 상태를 더는 통과시키지 않음을 직접 재현, (3) 코멘트 배제·real switch case 존중이 `conversation-utils.ts` 실제 코드에서도 성립함을 확인했다. self-test 는 comment-exclusion 이라는 핵심 위협 모델을 정확히 인코딩하고, 함수 docstring 의 근거(주석은 AST trivia 라 구조적으로 제외됨)도 타당하다. TODO/FIXME/HACK 잔존 없음, 반환값·에러 경로(파일 부재 시 throw, 누락 시 상세 에러 메시지)도 명확하다. spec 관점에서는 `spec/conventions/interaction-type-registry.md` 가 최초부터 이 가드를 "AST 가드"로 불러왔고 이번 코드 변경이 그 이름에 뒤늦게 수렴하는 방향이라 CRITICAL 스펙 위반이 아니며, 5개 독립 consistency checker 의 (b) 판정과도 일치한다. 유일한 잔여 항목은 spec 본문·인접 소스 파일의 "grep" 서술이 구현 전환 후 다소 낡아진 SPEC-DRIFT 성격의 wording 이슈로, project-planner 트리비얼 후속으로 충분하며 이번 코드 변경을 막을 사유가 아니다.

## 위험도

NONE
