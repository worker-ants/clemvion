### 발견사항

- **[WARNING]** 동일한 형태의 `expect(condition, message).toBe(true)` 단언이 파일 내에서 줄바꿈 스타일이 일관되지 않음 (프로젝트 기본 포맷터 기준 line-width 80 을 넘는 줄들이 인접한 동형 단언과 다르게 한 줄에 압축되어 있음)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:99` (95자, `expect(typeof wt === "string" && wt.length > 0, ...).toBe(true);` 한 줄), `:115` (96자, `expect(ok, ...).toBe(true);` 한 줄), `:137` (84자, `const rendered = violations.map((v) => ...)`), `:156` (102자, `expect(links, ...).toBeGreaterThan(50);`)
  - 상세: 같은 파일의 구조적으로 동일한 단언들(`:67-74`, `:91-94`, `:120-123`)은 `expect(\n  조건,\n  메시지,\n).toBe(true)` 형태로 여러 줄로 나뉘어 있는데, 위 네 곳만 한 줄로 압축되어 있다. `npx prettier --check` 로 실측한 결과 이 파일은 포맷 이슈로 flag 됨(`npx prettier <file>` diff 로 정확히 이 4곳이 재포맷 대상). frontend 는 현재 prettier 를 CI/lint 에서 강제하지 않아 빌드를 막지는 않지만, 같은 파일 안에서 동일 패턴이 서로 다르게 보이는 것은 가독성·리뷰 시 diff noise 관점에서 바람직하지 않다.
  - 제안: `npx prettier --write` 로 파일 전체를 재포맷하거나, 최소한 위 4개 라인을 인접 단언들과 동일한 멀티라인 스타일로 맞춘다.

- **[INFO]** 하한값 매직 넘버(`5`, `5`, `50`)가 이름 없는 리터럴로 산재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:63` (`toBeGreaterThan(5)`), `:156` (`toBeGreaterThan(50)`), `:171` (`toBeGreaterThan(5)`)
  - 상세: 각 값 위에 "왜 이 하한인가"를 설명하는 상세한 주석이 붙어 있어 의도 파악 자체는 어렵지 않다. 다만 세 곳 모두 리터럴로 흩어져 있어, 셋이 서로 다른 의미(discovery count vs 추출 링크 수)를 갖는다는 것이 상수명 없이는 즉시 드러나지 않는다.
  - 제안: 필수는 아니나 `MIN_LIVE_PLANS = 5`, `MIN_EXTRACTED_LINKS = 50` 같은 named constant 로 뽑으면 각 값이 무엇의 하한인지 grep 만으로도 드러난다.

- **[INFO]** 지역 변수명이 축약형(`wt`, `s`, `o`)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:98`(`wt`), `:110`(`s`), `:119`(`o`)
  - 상세: 각각 `data.worktree`/`data.started`/`data.owner` 를 담는데, 사용 스코프가 5~8줄 이내로 짧아 실질적 혼동 위험은 낮다. 다만 같은 파일의 다른 `it` 블록(`worktree`/`owner` 검사)이 조건을 바로 `expect` 인자로 인라인하는 반면, `started` 검사만 `const ok = ...`로 중간 변수를 두는 등 세 검사 간 스타일이 완전히 통일되어 있지는 않다.
  - 제안: 우선순위 낮음. 리팩터링 시 `worktree`/`started`/`owner` 처럼 축약하지 않은 이름으로 통일하면 더 명확해진다.

- **[INFO]** "발견 → 렌더링 → 빈 배열 단언" 패턴이 두 쌍(링크 무결성 / status 무결성)에서 구조적으로 중복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:135-144`(`top-level in-progress plans have no broken relative links`), `:174-187`(`no completed plan declares a non-terminal status`)
  - 상세: 두 테스트 모두 "위반 목록 조회 → 사람이 읽을 문자열로 map → `expect(list, message).toEqual([])`" 동일 골격을 반복한다. 다만 파일 자체 주석(`:177` 부근)이 이 대칭을 의도로 명시하고 있고("자매 검사와 같은 구조로 맞췄다"), 각 메시지 문구가 검사별로 다르므로 공통 헬퍼로 뽑을 실익은 제한적이다.
  - 제안: 현재 수준의 중복은 허용 가능. 세 번째 유사 검사가 추가된다면 `assertNoViolations(list, header, hint)` 류 헬퍼 추출을 고려.

### 요약

`plan-frontmatter.test.ts` 는 plan 라이프사이클 불변식 3종을 검증하는 가드 테스트로, 헤더 주석이 SoT 위치·스코프·과거 리뷰에서 잡힌 실수(가짜 링크 정규식 재구현, vacuous positive-only 검사 등)를 명확히 기록하고 있어 의도 파악이 쉽다. 판정 로직을 `plan-scan.ts`/`spec-links.ts` 로 위임하고 이 파일은 호출부 역할만 하도록 책임을 분리한 구조도 적절하며, 함수 길이·중첩 깊이·순환 복잡도 모두 문제 되는 수준이 아니다. 실측한 문제는 동일 파일 내 구조적으로 같은 `expect` 단언들이 줄바꿈 스타일에서 서로 달라(`prettier --check` 로 재현 확인) 시각적 일관성이 깨진다는 점이며, 그 외에는 이름 없는 하한 매직 넘버·축약 변수명 등 경미한 개선 여지만 있다. 전반적으로 유지보수하기 어려운 구조적 결함은 없다.

### 위험도
LOW
