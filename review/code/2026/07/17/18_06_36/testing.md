# Testing Review — eslint.config.mjs `src/lib` layering guard (W#1·W#2 후속)

## 사전 검증 (재확인)

`git diff` 대상 2파일(`codebase/frontend/eslint.config.mjs`,
`codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`)을 실제로 mutation 시켜
재현 검증했다 (검증 후 원본으로 정확히 복원, `git diff --stat` 로 확인).

- W#1 재검증: 뒤쪽에 `files:["src/lib/**"]` override 로 두 규칙만 `"off"` → 14/20 실패. 추가로
  **한쪽 규칙만** `"off"` 로 두는 부분 override(`no-restricted-imports` 만)도 시도 → 정적 import
  관련 6개만 정확히 실패. 병합 로직이 세밀한 부분 완화도 올바르게 잡아낸다.
- W#2 재검증: bare 케이스 4종 모두 정상 동작 확인 (`@/components`, `../components` 양쪽,
  정적/동적 import·require 전 조합).
- 20/20 그린 상태를 3회 반복 재현해 안정성 확인.

## 발견사항

- **[WARNING]** 규칙 severity 를 `"error"` → `"warn"` 으로 낮추는 mutation 을 테스트가 탐지하지 못함
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:49-53` (`layeringErrors`),
    `codebase/frontend/eslint.config.mjs:97,115` (두 규칙의 `"error"` 리터럴)
  - 상세: `layeringErrors()` 는 `linter.verify(...)` 결과를 `ruleId` 로만 필터링하고 `severity` 를
    보지 않는다. `no-restricted-imports`/`no-restricted-syntax` 의 severity 를 `"error"` →
    `"warn"` 으로 바꾸는 mutation 을 실제로 적용해 재현했다 — **20/20 그대로 통과**
    (ESLint `Linter#verify` 는 severity 1(warn)이어도 메시지를 반환하므로
    `.length > 0` 단언이 그대로 참이 됨). 게다가 frontend `package.json` 의 `"lint": "eslint"`
    스크립트는 `--max-warnings` 옵션이 없어(`eslint --help` 확인: default `-1` = 무제한)
    warning 만 있으면 **CLI 종료 코드도 0** 이다 — 즉 이 mutation 은 unit 테스트도, `pnpm --filter
    frontend lint` 도 모두 그린으로 통과시킨다. 이는 이 테스트 파일 자신의 상단 doc 주석이
    명시한 방어 대상("규칙 옵션 약화... 있어도 CI 는 계속 초록일 수 있다")과 정확히 일치하는
    시나리오이면서도 실제로는 막히지 않는 잔여 사각지대다.
  - 제안: `layeringErrors` 가 반환하는 메시지의 `severity` 를 함께 검증(예:
    `expect(msg.severity).toBe(2)`)하거나, `mergedRules["no-restricted-imports"][0]` /
    `mergedRules["no-restricted-syntax"][0]` 이 각각 `"error"` (또는 `2`) 인지 별도 단언을
    "함께 정의한다" 테스트에 추가.

- **[INFO]** 동적 import()/require() 정규식의 앵커(`(\/.*)?$`) 정밀도를 검증하는 negative fixture 부재
  - 위치: `codebase/frontend/eslint.config.mjs:7` (`COMPONENTS_PATH_RE`),
    `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:87-99`
    ("위반으로 잡히면 안 되는 형태" 목록)
  - 상세: `COMPONENTS_PATH_RE` 를 `^(@\/components.*|(\.\.\/)+components.*)$` 로 앵커를 느슨하게
    바꾸는 mutation(예: `@/components-legacy`, `@/componentsFoo` 같은 근접 오탐까지 매칭)을
    실제로 적용해 재현 — **20/20 그대로 통과**. 현재 negative fixture 5종은 전부 "완전히 무관한"
    import(`zod`, `sonner`, `../api/auth`, `../types/foo`)만 다뤄서, "components 로 시작하지만
    실제로는 다른 모듈"인 근접 경계값이 없다. 참고로 `no-restricted-imports` (glob 기반) 쪽은
    `"@/components"`/`"@/components/**"` 패턴이 구조적으로 이 문제에서 자유롭다 — 이 갭은
    두 `no-restricted-syntax` selector(정규식 기반)에 한정된다.
  - 제안: `it.each` negative 목록에 `'import("@/components-legacy/x")'`,
    `'require("../componentsShared/x")'` 류의 근접 오탐 케이스 1~2개 추가.

- **[INFO]** `files: ["src/lib/**"]` 리터럴 문자열 정확 일치에 의존하는 블록 탐색
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:22-24`
  - 상세: 실제 가드 블록의 `files` 값 자체를 (기능적으로 동등한) 다른 glob 표현으로 바꾸는
    mutation(예: `"src/lib/**/*"`)을 적용해 재현 — 이 경우 `mergedRules` 가 빈 객체가 되어
    파일 상단의 fail-open 가드가 `throw` 하며 suite 전체가 에러로 죽는다. **탐지는 되지만**(안전
    방향으로 fail-loud), 에러 메시지가 "가드 자체가 fail-open 상태일 수 있습니다" 라 실제 원인
    (정상적인 glob 리팩터링 vs 진짜 약화)을 구분하기 어렵다. 차단 방식 자체는 W#1/W#2 의
    "조용히 약화" 철학과 일치하므로 문제라기보다 유지보수 마찰에 가깝다.
  - 제안: 필수 조치는 아님. 향후 `files` 표현을 바꿀 일이 생기면 이 테스트의 리터럴
    `"src/lib/**"` 매칭 조건도 함께 갱신해야 함을 테스트 파일 주석에 한 줄 추가하면 향후
    디버깅 시간을 아낄 수 있음.

- **[INFO]** 첫 단독 실행에서 20개 중 14개가 실패했다가 `node_modules/.vite` 캐시 삭제 후
  안정적으로 20/20 통과 (5회 반복 재현, 전부 그린)
  - 위치: 환경/vitest 캐시, 코드 변경 아님
  - 상세: 코드 자체의 결함이 아니라 이 worktree 의 stale vite 의존성 캐시로 판단됨(정확한
    원인은 확정하지 못했으나 캐시 삭제 후 재현 불가). 리뷰 대상 diff 와는 무관하지만, CI 러너에서
    동일한 캐시 오염이 재현될 경우 false failure 로 이어질 수 있어 참고로 남김. 코드 변경 요구
    사항 아님.

## 회귀·격리·가독성·Mock 평가

- **Mock 적절성**: mock 없이 실제 `eslint` `Linter#verify` 를 그대로 사용 — config 를 fixture 로
  복제하지 않고 실제 export 를 import 해 검증하므로 "실제 동작과의 괴리"가 구조적으로 없음.
  매우 적절한 설계.
- **테스트 격리**: 모듈-scope 의 `linter`/`mergedRules` 는 읽기 전용으로 재사용되고, 각 `it.each`
  케이스는 독립된 코드 문자열을 입력으로 사용해 서로 의존하지 않음. 순서 무관 실행 가능.
  Object.assign 병합 재현 로직도 이번 리뷰에서 부분/전체 override 양쪽 mutation 으로 실측
  검증했고 실제 ESLint flat config 의 "나중 블록 우선" 병합과 일치함을 확인함(다만 `ignores`
  필드나 복잡한 파일 매칭까지는 재현하지 않는 단순화된 모델 — 현재 config 구조에서는 문제
  없음).
- **테스트 가독성**: 한국어 라벨(`it.each` 첫 인자)이 각 케이스의 의도를 명확히 표현. positive/
  negative 두 describe 블록 분리도 명확함.
- **회귀 테스트 유효성**: 기존 13개 케이스 + 이번에 추가된 bare 4종 모두 실제 config 로드 시
  통과 확인. 기존 테스트가 변경 후에도 유효함.
- **테스트 용이성**: `COMPONENTS_PATH_RE` 공유 상수 추출로 production 코드 자체가 drift 에
  덜 취약해졌고, 이는 테스트가 검증해야 하는 표면을 줄여줌 — 테스트 용이성 개선 방향의
  리팩터링.

## 요약

W#1(첫 블록만 추출)·W#2(bare 케이스 부재) 는 모두 실제 mutation 재현으로 해소가 확인됐다
(부분 override 포함). 다만 이번 점검에서 새로 두 가지 잔여 사각지대를 재현 확인했다: (1)
규칙 severity 를 `"error"`→`"warn"` 으로 낮추는 mutation 은 유닛 테스트와 `eslint` CLI(기본
`--max-warnings` 무제한) 양쪽 모두 그린으로 통과시킨다 — 이 테스트 파일이 명시적으로 막고자
한 "규칙 옵션 약화" 시나리오와 정확히 일치하는 미탐지 케이스라 우선 보강이 필요하다. (2)
동적 import()/require() 정규식의 경계 정밀도를 검증하는 근접-오탐 negative fixture 가 없어
앵커 약화 mutation 도 통과한다 — 다만 이쪽은 과탐(false positive) 방향이라 상대적으로 영향이
작다. 나머지(테스트 격리·가독성·Mock 적절성·회귀 유효성)는 모두 양호하다.

## 위험도

MEDIUM — severity-downgrade 미탐지 건은 현재 코드에 실재하는 결함은 아니지만, 이 가드
테스트의 존재 목적(향후 조용한 약화 방지)을 직접적으로 우회하는 재현 가능한 경로이며 실제
CI lint 스크립트도 함께 뚫리므로 후속 보강을 권고한다.
