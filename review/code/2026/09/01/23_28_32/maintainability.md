# 유지보수성(Maintainability) 코드 리뷰

## 범위에 대한 메모

이번 changeset 112개 파일 중 실질적으로 사람이 계속 유지보수하는 "코드"에 해당하는 것은
5개뿐이다 — `.claude/hooks/_lib/plan_guard.py`, `.claude/tests/test_plan_guard.py`,
`codebase/backend/src/nodes/core/error-codes.ts`(JSDoc 주석만 확장),
`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규). 나머지는
`plan/**` 트래킹 문서 갱신(7개), `spec/conventions/error-codes.md` 본문 1개, 그리고
`review/code/**`·`review/consistency/**` 아래 **이전 라운드들이 이미 만든 세션 산출물을
그대로 커밋한 것**(약 99개 — SUMMARY/RESOLUTION/각 리뷰어 리포트/`meta.json`/`_retry_state.json`
등)이다. 후자는 harness 가 기록한 로그이자 이미 지나간 세션의 스냅샷이라 함수 길이·중첩·매직
넘버 같은 코드 품질 기준을 적용할 대상이 아니다(그 산출물 자체 중 하나인
`review/code/2026/09/01/22_25_37/maintainability.md` 도 마찬가지로 이전 라운드의 판단 기록일 뿐
지금 다시 채점할 대상이 아니다). 아래 발견사항은 실질 코드 5개 파일에 집중했다.

## 발견사항

- **[WARNING]** `stray-tool-tags.test.ts` 의 신규 헬퍼가 `readonly string[]` 를 `walkTree`
  의 `string[]` 매개변수로 그대로 넘겨 **타입 오류가 나는 코드**인데, 저장소 tsconfig 의
  `__tests__/**` 제외 설정 때문에 아무 데서도 잡히지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:97-98`
    (`function collectScanTargets(root: string, subdirs: readonly string[] = SCAN_ROOTS) { return walkTree(root, subdirs, ...) }`)
  - 상세: `SCAN_ROOTS`(52행)는 `as const` 로 선언돼 `readonly ["plan","spec"]` 타입을 갖고,
    `collectScanTargets` 의 두 번째 매개변수 타입도 `readonly string[]` 로 그 성질을
    그대로 물려받는다. 그런데 `tree-walk.ts` 의 `walkTree(root: string, bases: string[], ...)`
    는 `bases` 를 **mutable** `string[]` 로 선언하고 있어(`readonly` 아님), `readonly string[]`
    인수를 그대로 넘기면 TypeScript strict 모드에서 `TS2345: Argument of type 'readonly
    string[]' is not assignable to parameter of type 'string[]'` 오류가 난다. 이 저장소의
    다른 모든 `walkTree` 호출부(`spec-links.ts` 의 `CODEBASE_SOURCE_ROOTS` 등)는 `as const`
    를 쓰지 않고 평범한 `string[]` 리터럴을 넘겨 이 문제를 애초에 피하고 있어, 이 파일만
    새로 이 불일치를 만들었다. 저장소 `tsconfig.json` 의 `exclude` 에 `src/**/__tests__/**`
    와 `src/**/*.test.ts` 가 이미 있어(이 파일은 둘 다에 해당) `next build`/`tsc --noEmit`
    양쪽에서 이 파일이 애초에 타입체크 대상에서 빠진다 — 그래서 build/CI 는 통과하지만
    실제로는 컴파일 안 되는 코드다. 격리된 재현으로 실측했다: 동일 시그니처를 별도
    scratch 파일에 그대로 옮겨 `npx tsc --noEmit --strict` 를 돌리면
    `TS2345: readonly string[] is not assignable to string[]` 가 그대로 재현된다(저장소
    `codebase/frontend/src/lib/docs/__tests__` 전체에 대한 `npx tsc --noEmit -p tsconfig.json`
    자체는 `__tests__/**` 제외 덕에 0 에러로 통과 — 이 파일이 실제로는 검사받지 않는다는
    뜻이다). 기능상 런타임 동작에는 영향 없다(JS 배열은 `readonly` 애노테이션을 강제하지
    않는다) — 이 저장소가 이미 겪은 "타입 가드·새 테스트가 실제로 타입체크되는지 확인"
    문제(`__tests__` 제외 컨벤션)의 재발 사례일 뿐이다. 다만 다음 사람이 `subdirs` 매개변수
    타입만 보고 "여기는 안전하게 readonly 로 잠갔다" 고 오독할 여지가 있고, 언젠가 이
    `exclude` 패턴이 좁혀지거나 별도 strict lint 가 이 디렉터리에 걸리면 즉시 빌드가 깨진다.
  - 제안: `subdirs` 매개변수 타입을 `walkTree` 의 실제 계약에 맞춰 `string[]` 로 두거나
    (`SCAN_ROOTS` 를 넘길 때 `[...SCAN_ROOTS]` 로 얕은 복사해 전달), 혹은 `walkTree` 쪽
    `bases` 매개변수를 `readonly string[]` 로 넓혀 호출부의 `as const` 배열을 그대로 받게
    한다. 후자가 더 일관적이다 — `walkTree` 는 `bases` 를 순회만 하고 변형하지 않으므로
    `readonly` 로 좁혀도 기존 호출부(모두 mutable 배열) 전부와 호환된다.

## 확인했으나 문제 없음 (근거 기록)

- `plan_guard.py` 의 `_CHECKBOX`/`_QUOTED` 비대칭 카운팅 확장(파일 2)은 `_CHECKBOX` 가
  이 파일 안에서 `_all_checkboxes_done` 한 곳에서만 쓰이는 것을 확인했다(다른 호출부로
  분기가 새지 않는다). 함수 자체(`_all_checkboxes_done`)는 여전히 30줄 내외, 중첩 2단
  이하, 분기마다 "왜"를 설명하는 인라인 주석이 붙어 있어 가독성 저하가 없다.
- `test_plan_guard.py` 에 추가된 테스트 5건은 각각 다른 축(인용문 안 열림/닫힘, 중첩
  인용, 서술 오탐, 공존 케이스)을 겨냥해 이름과 docstring 이 정확히 그 축을 서술한다 —
  기계적 복붙처럼 보이는 구조 반복은 테스트 파일에서 관용적이라 중복으로 보지 않았다.
- `error-codes.ts`(파일 4) 변경은 기존 JSDoc 블록에 문단 하나를 추가한 것뿐이고 런타임
  코드·enum 멤버는 전혀 건드리지 않는다.
- `spec-links.test.ts`(파일 5) 에 추가된 멀티라인 앵커 fixture 와 통합 경로 line 단언은
  기존 파일의 `mkLink`/`fingerprint` 헬퍼와 스타일을 그대로 따르고, 새 헬퍼를 만들지
  않았다.
- `MIN_EXPECTED_MD_FILES` (`stray-tool-tags.test.ts:66-72`) 의 `250`/`190` 은 매직 넘버지만
  바로 위 주석에 실측치(`plan/` 505 · `spec/` 386)와 "실측의 절반 언저리로 잡았다" 는
  선정 기준이 명시돼 있어 별도로 지적하지 않았다 — 직전 라운드(`22_25_37`)의 INFO 가
  요구한 "왜 이 숫자인지" 근거가 이미 충족된 상태다.

## 요약

이번 changeset 에서 사람이 유지보수할 실질 코드는 5개 파일로 좁고, 그 대부분은 짧은
함수·얕은 중첩·근거를 남긴 주석으로 이 저장소의 기존 관례를 잘 따른다. 유일하게 실질적인
지점은 `stray-tool-tags.test.ts` 가 도입한 `readonly string[]` → `walkTree(bases: string[])`
불일치다 — 런타임에는 무해하지만 실제로 컴파일 오류가 나는 코드가 `__tests__/**` tsconfig
제외 덕에 아무 검사도 통과 못 하면서 조용히 "통과" 로 보이는 상태이며, 이 저장소가 과거에
이미 겪은 "테스트 파일이 실제로 타입체크되지 않는다" 문제의 재발이라 WARNING 으로 남긴다.
나머지 90여 개 파일(리뷰/consistency 세션 산출물, plan 트래킹 문서)은 사람이 계속 편집하는
소스가 아니라 이 관점의 채점 대상에서 제외했다.

## 위험도

LOW
