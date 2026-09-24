# 테스트(Testing) 리뷰 — `isPendingPlanPath` 가드 보강

## 검증 방법

- `codebase/frontend` 에서 대상 두 테스트 파일을 직접 실행해 재확인:
  `npx vitest run spec-frontmatter-parse.test.ts spec-pending-plan-existence.test.ts`
  → **68/68 PASS** (단위 13 + 가드 55, plan 문서 §체크리스트의 claim 과 정확히 일치).
- `isPendingPlanPath`/`PENDING_PLAN_DIRS` 사용처를 grep 으로 전수 확인 — 통합 지점은
  `spec-pending-plan-existence.test.ts` 한 곳뿐, 배선 누락 없음.
- 저장소 뮤테이션 없음 (`git status --short` 로 확인 — 기존 untracked 리뷰 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `isPendingPlanPath` 에 비-string/undefined 입력에 대한 방어·테스트가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-101` (`isPendingPlanPath`)
  - 상세: `SpecFrontmatter.pending_plans?: string[]` 는 컴파일 타임 타입일 뿐, 실제 값은 `matterNoCache` 가 YAML 을 파싱한 결과라 런타임에 문자열이 아닌 값(숫자·null·중첩 객체)이 들어올 수 있다. 그 경우 `path.posix.normalize(relPath)` 가 `TypeError`를 던져 테스트 스위트 전체가 예외로 죽는다(개별 `expect` 실패가 아니라 unhandled throw). 이 가드가 막으려는 사고(`#1386`, "문서한 보장이 구현보다 넓다")와 같은 클래스는 아니지만, frontmatter 오타(예: `pending_plans: 42` 처럼 배열이 아닌 스칼라)가 들어오면 가드 자체가 불친절한 방식으로 죽는다.
  - 제안: 필수는 아니나, `typeof relPath !== "string"` 가드나 최소 하나의 방어적 테스트(예: 빈 문자열 `""` 입력 시 `false`)를 추가하면 향후 frontmatter 스키마 이탈 시 실패 모드가 명확해진다. 우선순위 낮음 — 이 PR 을 막을 사안 아님.

- **[INFO]** `plan/in-progress/` 접두어의 "look-alike 디렉터리" 오탐 방지를 입증하는 테스트가 없다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` (`describe("isPendingPlanPath", ...)` 블록 전체 — 해당 케이스 부재)
  - 상세: `PENDING_PLAN_DIRS = ["plan/in-progress/", "plan/complete/"]` 는 트레일링 슬래시 덕분에 `plan/in-progress-archive/foo.md` 같은 "접두 문자열은 같지만 실제로는 다른 디렉터리"를 정확히 걸러낸다(직접 실행해 `false` 확인함). 이 정확성은 구현의 트레일링 슬래시 표기에 전적으로 의존하는데, 이를 직접 단언하는 테스트가 없다. 나중에 누군가 가독성을 이유로 트레일링 슬래시를 빼거나 `dir + "/"` 형태로 리팩터링하면 이 경계가 조용히 깨질 수 있다(정확히 이 PR 의 plan 문서(`§A`)가 지적하는 "존재 검사 ≠ 정합 검사" 와 같은 종류의 갭).
  - 제안: `expect(isPendingPlanPath("plan/in-progress-archive/foo.md")).toBe(false)` 한 줄을 "rejects plan/ locations that are not work plans" 케이스에 추가하면 이 경계가 회귀 캐너리로 고정된다.

- **[INFO]** 코퍼스 기반 가드(`spec-pending-plan-existence.test.ts`)는 현재 위반 0건이라 새 단언의 판별력을 그 자체로는 검증하지 못한다 — 단, 이미 문서화·완화됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:47-54` (`it(\`pending_plan is a work plan — ...\`)`)
  - 상세: 실제 spec 코퍼스에 `pending_plans` 위반이 없으므로 이 가드 테스트만으로는 "predicate 가 항상 true 를 반환해도 그린" 상태가 된다(plan 문서 §D 의 M5 뮤테이션이 정확히 이 사실을 실측: "단위 5 RED · 가드 55 초록"). 이것은 이 PR 의 결함이 아니라 — 개발자가 뮤테이션 테스트로 이 갭을 스스로 찾아내고 판별 책임을 `spec-frontmatter-parse.test.ts` 의 순수 단위 테스트로 명시적으로 옮겨 놓았다(plan §D 결론: "판별의 부담은 단위 테스트가 진다"). 리뷰어로서 동일한 사실을 재확인했을 뿐이며 별도 조치가 필요하지는 않다.

## 긍정적 관찰

- `isPendingPlanPath` 는 부작용 없는 순수 함수로, 선례(`isApplicable`)와 동일한 패턴으로 파일시스템/네트워크 mock 없이 직접 테스트 가능 — 테스트 용이성이 높다.
- 테스트 이름이 의도를 정확히 서술한다("rejects the incident shape — an existing non-plan file" 등 사고 재현 케이스를 이름에 명시).
- 경계값(빈 확장자, bare 디렉터리, `..` 경로 이탈, 비-마크다운)과 사고 재현 케이스(실재 파일이지만 plan 이 아닌 경로)를 모두 커버 — 엣지 케이스 커버리지가 탄탄하다.
- 개발자가 자체적으로 판별 뮤테이션(M2~M5, plan §D)을 수행해 각 단언이 실제로 해당 분기를 판별하는지 검증했고, 최초 뮤턴트(M1)가 무효였음을 스스로 발견해 M1b 로 재수행한 기록이 plan 문서에 남아 있다 — 테스트 스위트의 신뢰도를 뒷받침하는 드문 수준의 증거.
- 기존 `spec-pending-plan-existence.test.ts` 의 `it(\`pending_plan path resolves\`)` 루프 구조를 건드리지 않고 `it(\`pending_plan is a work plan\`)` 을 앞에 추가하는 방식이라 회귀 위험이 낮다 — 기존 27개 spec × pending_plans 항목에 대해 그대로 재실행되고 실측(0건 실패)으로 확인됨.
- 커밋 시점 실행 결과(68/68 PASS)가 plan 문서의 claim 과 정확히 일치 — 문서-실측 정합.

## 요약

신규 `isPendingPlanPath` 술어와 그 테스트는 순수 함수·mock 불필요·경계값(정규화 전 접두검사, `..` 탈출, 비-마크다운, bare 디렉터리, 사고 재현 케이스)을 촘촘히 커버하며, 개발자가 스스로 판별 뮤테이션까지 수행해 각 단언의 유효성을 실측으로 검증한 드문 사례다. 코퍼스 기반 통합 가드(`spec-pending-plan-existence.test.ts`)는 현재 위반 0건이라 그 자체로는 predicate 파손을 잡지 못하지만, 이는 plan 문서가 스스로 짚고 단위 테스트로 판별 책임을 이전해 이미 완화됐다. 남은 갭은 비-string 입력 방어 부재와 "look-alike 디렉터리" 오탐 방지를 직접 단언하는 테스트 부재 정도로 전부 INFO 수준이며, 이 PR 의 머지를 막을 사안은 없다.

## 위험도
NONE
