### 발견사항

- **[WARNING]** frontmatter 인라인 판정(worktree placeholder / started ISO 날짜 / owner / 파싱가능 여부) 네 개가 여전히 positive-only — 이 파일 자신이 고쳤다고 서술하는 vacuous-test 클래스와 동일한 결함이 남아 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:37-40`(`ISO_DATE`/`WORKTREE_PLACEHOLDER`/`WORKTREE_SENTINEL` 상수), `:89-95`("has a parseable frontmatter block"), `:97-107`("`worktree` is set and not a legacy placeholder"), `:109-116`("`started` is an ISO date"), `:118-123`("`owner` is set")
  - 상세: 이 파일의 주석(42-45줄, 128-134줄)은 "158 tests 전량 GREEN 인데 위반 수집 분기가 한 번도 실행되지 않았다"는 실측 결함을 status 검사(→ `plan-scan.ts`)와 링크 검사(→ `spec-links.ts`)에 대해 고쳤다고 명시적으로 서술한다. 두 검사는 각각 `plan-scan.test.ts`/`spec-links.test.ts` 에 합성 fixture 로 위반 분기(`stale.md`, `odd.md`, `moved.md` 등)를 심어 negative-path 를 증명한다. 그런데 **같은 파일 안의 나머지 네 개 인라인 검사(worktree placeholder, started 형식, owner, parseable block)는 이 리팩터에서 추출·fixture 화되지 않고 그대로 남았다**. `WORKTREE_PLACEHOLDER`/`ISO_DATE` 상수를 저장소 전체에서 `grep`한 결과 이 파일 밖에서는 참조되지 않으며(fixture 단위테스트 부재 확인), 실제로 현재 `plan/in-progress/*.md` 에는 placeholder worktree·비-ISO started·빈 owner·파싱 실패 frontmatter 를 가진 파일이 하나도 없어(`npx vitest run` 179 tests 전부 GREEN 확인) 이 네 검사의 "위반 검출" 분기(`WORKTREE_PLACEHOLDER.test(...) === true` → assertion fail, `ok === false`, `parseOk === false`)는 현재도 한 번도 실행되지 않는다. 누군가 정규식을 실수로 완화하거나(`TBD` 매칭 제거 등) `!==`/`===` 를 뒤집어도 이 테스트 스위트는 계속 GREEN 이다.
  - 제안: `plan-scan.ts` 에 `findFrontmatterViolations(root)` 같은 순수 함수로 네 판정을 추출하고, `plan-scan.test.ts` 에 합성 fixture(`worktree: TBD`, `worktree: 미정`, `started: not-a-date`, `owner:` 빈 값, 깨진 YAML frontmatter)를 심어 각 위반 분기가 정확히 잡히는지 양성 단언. 최소한 파일을 옮기지 않더라도 `WORKTREE_PLACEHOLDER`/`ISO_DATE` 정규식만이라도 별도 `it.each` 유닛 테스트로 참/거짓 표를 검증할 것.

- **[INFO]** `ISO_DATE` 정규식은 자리수 형태만 검사하고 달력 유효성은 검사하지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:37`
  - 상세: `/^\d{4}-\d{2}-\d{2}$/` 는 `2026-13-99` 같은 존재하지 않는 날짜도 통과시킨다. `started` 필드가 자유 입력이라는 점을 감안하면 실질 위험은 낮지만, 위 WARNING 항목의 fixture 추출 작업을 하게 되면 같은 자리에서 경계값(월 13, 일 32 등)도 함께 다루는 편이 저렴하다.
  - 제안: 우선순위 낮음 — 위 WARNING 리팩터 시 함께 고려.

- **[INFO]** 결합 단언이 실패 원인을 구분하지 못함
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:99`
  - 상세: `expect(typeof wt === "string" && wt.length > 0, ...).toBe(true)` 는 "타입이 string 이 아님"과 "빈 문자열"을 같은 메시지("worktree missing")로 뭉갠다. 디버깅 편의성 측면의 사소한 지적이며 현재 게이트 목적(존재 여부 확인)에는 지장 없음.

### 요약

리뷰 대상 파일은 plan 라이프사이클 3종 불변식(frontmatter 필수값·완료 status·링크 무결성)을 실제 저장소 위에서 검증하는 가드 테스트다. 스캔 로직을 `plan-scan.ts`/`spec-links.ts` 공유 모듈로 위임하고, 그 두 모듈은 각각 `plan-scan.test.ts`/`spec-links.test.ts` 에서 합성 fixture 로 위반 검출 분기(negative-path)를 명시적으로 증명하도록 잘 구성되어 있다 — 이 파일 자신의 주석이 이전에 겪은 "158 tests GREEN 인데 위반 분기가 한 번도 안 돈다" 결함에 대한 정직한 회고와 그 교훈의 적용이다. 다만 그 교훈이 이 파일 안에 여전히 남아 있는 네 개의 인라인 frontmatter 검사(worktree placeholder, started ISO 형식, owner, parseable block)에는 적용되지 않았다 — 저장소 전체 grep 과 실제 테스트 실행(179 tests 전부 GREEN)으로 확인한 결과, 이 네 검사의 위반 검출 분기는 현재도 한 번도 실행되지 않는 positive-only 상태다. 이는 CRITICAL 급 결함은 아니지만(스캔 대상 함수 자체는 fixture 로 잘 검증됨), 이 PR/파일이 스스로 표방하는 "vacuous test 금지" 원칙과 정확히 같은 사각지대를 재현하고 있어 WARNING 으로 반영해야 한다. 그 외 mock 미사용(실제 fs 위에서 검증하는 이 유형의 가드에 적절), 테스트 가독성(한국어 주석으로 배경·근거 충실), 테스트 격리(실 저장소 상태에 결합되는 것은 가드의 의도된 설계) 측면은 양호하다.

### 위험도
MEDIUM
