# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `parseFrontmatterSafe` 의 존재 이유(gray-matter 동일-내용 재파싱 캐시 오염 우회)를 직접·의도적으로 겨누는 회귀 테스트가 없다 — 현재 커버리지는 서로 다른 `describe` 블록 간 **바이트 동일 fixture 문자열 재사용 + 실행 순서**에 우연히 의존하는 간접 커버리지다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:121`~`128` (`parseFrontmatterSafe` 함수, JSDoc 은 104~120) / `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` — `checkPlanFrontmatter` describe 블록의 `"stops at the block level when there is no parseable frontmatter"` 테스트(해당 파일 약 290~299번째 줄, 이번 리뷰 payload 에는 포함되지 않아 게이트 번호 없음)
  - 상세: `parseFrontmatterSafe` 의 JSDoc 은 "같은 내용을 두 번 파싱하면 첫 호출은 throw, 두 번째 호출은 `{}` 옵션이 없으면 조용히 `data={}}` 를 반환한다"는 gray-matter 캐시 hazard 를 상세히 설명하고, 파일 머리말은 "다섯 번째 파서 호출이 추가될 때 `{}` 를 빠뜨리면 조용히 되살아나는 종류라 진입점을 하나로 둔다"고 명시한다. 그런데 `plan-scan.test.ts` 는 `parseFrontmatterSafe` 를 직접 import 해 이 캐시-우회 계약(같은 깨진 문자열을 두 번 넣어도 둘 다 `null`)을 단언하는 테스트가 없다.
    실측으로 검증했다 — `matter(raw, {})` 에서 `{}` 를 제거하는 뮤테이션을 넣고 스위트를 돌리면 `plan-scan.test.ts` 의 `checkPlanFrontmatter > "stops at the block level..."` 와 `findFrontmatterViolations > "finds the planted violation..."` 두 테스트가 실패한다(전자는 `["unparseable"]` 기대가 `["worktree-missing","started-invalid","owner-missing"]` 로 깨짐). 즉 뮤테이션은 잡히긴 하는데, 그 이유는 `plan/complete/broken.md` fixture(`"---\n: : bad yaml : :\n---\n"`)가 `describe("plan-scan", ...)` 블록에서 `findNonTerminalCompletedPlans` 를 통해 이미 여러 번 파싱된 **뒤에**, `describe("checkPlanFrontmatter", ...)` 블록의 리터럴 문자열이 **글자 그대로 동일한 내용**을 다시 파싱하기 때문이다. 이 커버리지는:
    1) 두 describe 블록의 상대적 실행 순서(파일 내 선언 순서)에 의존하고,
    2) 두 fixture 문자열이 우연히 바이트 단위로 동일한 데 의존한다.
    둘 중 하나만 바뀌어도(예: broken.md 내용에 주석 한 글자 추가, 또는 `checkPlanFrontmatter` 테스트를 앞으로 옮김) 커버리지가 **아무 신호 없이** 사라진다 — 정확히 이 파일의 머리말 주석이 반복해서 경계하는 "위반 0건은 검사가 작동한다는 증거가 아니다"·"무관측 분기" 패턴과 같은 종류다.
  - 제안: `parseFrontmatterSafe` 를 직접 import 해 "같은 깨진 문자열을 연속으로 두 번 넣어도 둘 다 `null`" 을 단언하는 독립 테스트를 추가한다. 예:
    ```ts
    it("returns null on repeated calls with identical unparseable content", () => {
      const broken = "---\n: : bad yaml : :\n---\n";
      expect(parseFrontmatterSafe(broken)).toBeNull();
      expect(parseFrontmatterSafe(broken)).toBeNull();
    });
    ```
    이렇게 하면 이 파일이 새로 공개(export)한 단일 진입점의 핵심 계약이 다른 describe 블록의 fixture 재사용이라는 우연에 기대지 않고 그 자체로 고정된다.

- **[INFO]** `parseFrontmatterSafe` 가 `plan-scan.ts` 에서 새로 `export` 되어 `spec-plan-completion.test.ts` 의 외부 소비처가 됐지만(`enforced` 필터 단계 + per-plan `describe` 본문에서 각각 호출), `plan-scan.test.ts` 는 이 함수를 여전히 간접(다른 함수를 통한)으로만 검증한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:121` (export 선언) / `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:5`(import), `spec-plan-completion.test.ts:75`·`95`(호출부, 게이트 기준)
  - 상세: 함수가 모듈 내부 헬퍼에서 공개 계약으로 승격됐는데도 `{data, block}` 반환 형태·`null` on-failure 계약을 직접 단언하는 테스트는 없다(모두 `checkPlanFrontmatter`/`findNonTerminalCompletedPlans` 를 통한 간접 검증). 위 WARNING 의 테스트를 추가하면 이 갭도 같이 해소된다.
  - 제안: 위 WARNING 제안과 동일 테스트로 충분 — 별도 조치 불필요.

- **[INFO]** `spec-plan-completion.test.ts` 의 per-plan `describe` 본문 주석("`enforced` 를 통과한 plan 만 오므로 파싱은 이미 성공했다")이 실제로 실물 데이터로 실행되는지 실측했다 — `plan/complete/*.md` 중 `started >= 2026-06-04`(Gate C cutoff) 인 완료 plan 이 다수(`ci-required-check-skip-jobs.md`(2026-08-09) 등) 존재하므로 `enforced` 는 현재 비어있지 않고, 동일 파일을 두 번 파싱하는 경로(필터 단계 + describe 본문)가 synthetic fixture 뿐 아니라 실물 데이터로도 실행된다. Vacuous 우려 없음 — 참고로만 기재.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:70`~`79`(enforced 필터), `:91`~`96`(per-plan describe)

## 요약
`plan-scan.ts` 신설과 `spec-plan-completion.test.ts` 의 중복 DFS/파싱 제거는 리팩터링 성격이 강하고, 기존 `plan-scan.test.ts`(negative-path fixture 다수)·`spec-plan-completion.test.ts` 자체 스위트가 실제로 회귀를 잡는지 뮤테이션으로 직접 검증했다(`matter(raw, {})` → `matter(raw)` 뮤테이션 시 2개 테스트 RED). 다만 그 커버리지가 겨누고 있는 지점(`parseFrontmatterSafe`)은 이번에 새로 공개(export)된 단일 진입점이면서도, 그 자체를 겨눈 의도적 테스트가 아니라 다른 describe 블록의 fixture 문자열 재사용이라는 우연에 기대고 있어 이 PR 시리즈가 스스로 여러 번 경계해온 "우연한 커버리지" 패턴이 하나 남아 있다. 나머지 — `checkPlanFrontmatter`/`findNonTerminalCompletedPlans`/`findFrontmatterViolations`/Gate C 술어(`isGateCEnforced`/`hasValidSpecImpact`)의 positive/negative 분기 커버리지, 격리(임시 디렉터리 `beforeAll`/`afterAll`), 가독성(각 테스트에 근거 주석 동반) — 는 모두 탄탄하다.

## 위험도
LOW
