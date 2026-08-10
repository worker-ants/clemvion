# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `hasValidSpecImpact` 가 실제 Gate C 강제 경로에서 호출되지 않는다 — synthetic 유닛테스트만 지나가는 "죽은" 판정 함수
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:43` (함수 정의, `export function hasValidSpecImpact`) vs 실제 강제 경로 `spec-plan-completion.test.ts:118`(`it("declares \`spec_impact\`"`), `:128`(`it("each \`spec_impact\` spec path exists (if a list)"`), `:139`(`it("string \`spec_impact\` is an explicit no-op assertion"`)
  - 상세: `hasValidSpecImpact(impact, specExists)` 는 문자열/배열 케이스를 한 predicate 로 판정하도록 만들어졌고, 오직 `describe("Gate C enforcement logic")` 안의 synthetic 테스트(`spec-plan-completion.test.ts:169` 부근)에서만 호출된다. 그런데 real-plan 을 순회하는 실제 강제 블록(`describe(rel, ...)`, 111번 줄 for 루프)은 이 함수를 쓰지 않고 **동일 로직을 손으로 세 곳에 다시 구현**한다: "declares" 테스트의 `ok = (typeof impact==="string" && impact.trim().length>0) || (Array.isArray(impact) && impact.length>0)`, "no-op assertion" 테스트의 `NONE_VALUES.has(...)`, 그리고 array 원소 유효성은 `danglingSpecImpact` 로. 이 파일 자신의 주석(예: `isGateCEnforced`·`danglingSpecImpact` 관련 주석, 90~98번 줄·107~109번 줄)이 정확히 "판정이 두 곳에 손으로 복제되면 한쪽만 고쳐도 조용히 갈린다" 는 사고를 반복 경계하는데, `hasValidSpecImpact` 자체가 그 경계 대상에서 빠져 있다.
    실측: `git show HEAD:plan/complete/auth-workspace-membership-guard.md` 의 `started: 2026-08-08` 는 `GATE_C_CUTOFF`(2026-06-04) 이후라 이미 `enforced` 집합에 들어간다 — 즉 이 real per-plan 블록은 오늘 CI 에서 **vacuous 가 아니라 실제로 실행**된다. 그럼에도 그 실행 경로는 `hasValidSpecImpact` 를 통과하지 않으므로, 향후 누군가 `hasValidSpecImpact`(혹은 반대로 인라인 로직)만 고치면 나머지 한쪽은 어떤 테스트도 못 잡는다.
  - 제안: real per-plan "declares"/"no-op assertion" 두 `it` 를 `hasValidSpecImpact` 호출로 교체하거나(에러 메시지 세분화가 필요하면 `hasValidSpecImpact` 를 분해된 헬퍼 두 개로 쪼개 양쪽에서 공유), 최소한 "왜 real path 가 이 함수를 안 쓰는지"를 주석으로 명시해 의도적 분리임을 밝힐 것.

- **[INFO]** `danglingSpecImpact` 의 positive-case synthetic 단언이 실제 spec 파일 경로에 결합돼 있어 격리가 약하다
  - 위치: `spec-plan-completion.test.ts:182`~`:183` (`const root = repoRoot(); ... danglingSpecImpact(root, ["spec/conventions/spec-impl-evidence.md"])`)
  - 상세: 같은 파일의 "Gate C enforcement logic" 테스트는 실제 저장소(`repoRoot()`)를 사용해 `spec/conventions/spec-impl-evidence.md` 가 존재한다는 사실에 의존한다. 자매 파일 `plan-scan.test.ts` 는 같은 종류의 negative-path 커버리지를 `fs.mkdtempSync` 로 만든 완전히 격리된 fixture 로 증명하는데(비교: `plan-scan.test.ts:36`), 이쪽만 실 저장소 경로를 하드코딩해 그 파일이 리네임/이동되면 `danglingSpecImpact` 의 로직과 무관한 이유로 이 테스트가 실패한다.
  - 제안: 실재 spec 경로 대신 임시 디렉터리에 더미 spec 파일을 만들어 `danglingSpecImpact(tmpRoot, ["dummy/exists.md"])` 형태로 격리하거나, 최소한 "이 테스트는 `spec/conventions/spec-impl-evidence.md` 존재에 의존한다"는 주석을 남길 것.

- **[INFO]** `NONE_VALUES` 의 `"n/a"`/`"na"` 변형과 대소문자 무관성이 어떤 테스트에서도 직접 단언되지 않음
  - 위치: `spec-plan-completion.test.ts:25` (`NONE_VALUES = new Set(["none", "없음", "n/a", "na"])`) vs 검증 테스트 `spec-plan-completion.test.ts:169`~`:170` (`hasValidSpecImpact("none", ...)`, `hasValidSpecImpact("없음", ...)`)
  - 상세: `hasValidSpecImpact` 는 `impact.trim().toLowerCase()` 로 대소문자를 무시하고 4개 값을 허용하는데, 테스트는 `"none"`/`"없음"` 두 값만 소문자로 확인한다. `"n/a"`/`"na"`, 그리고 대문자 변형(`"NONE"`, `"N/A"`)은 어떤 테스트에서도 관측되지 않는 죽은 분기다.
  - 제안: `hasValidSpecImpact("n/a", exists)`, `hasValidSpecImpact("NA", exists)` 등을 기존 "accepts \`none\`/\`없음\`..." 테스트(169번 줄)에 추가.

- **[INFO]** `isGateCEnforced` 의 `Date` 인스턴스 입력이 "true(강제됨)" 케이스로는 테스트되지 않음
  - 위치: `spec-plan-completion.test.ts:196`~`:199` (`it("grandfathers plans started before the cutoff"`) / `it("enforces plans started on/after the cutoff"`)
  - 상세: `startedDate()`(plan-scan.test.ts 소재 아님, `spec-plan-completion.test.ts:27`)는 `s instanceof Date` 와 ISO 문자열 두 경로를 갖는다. "grandfathers"(false) 테스트는 문자열과 `Date` 양쪽으로 확인하지만, "enforces"(true) 테스트는 문자열만 확인한다 — `Date` 인스턴스가 컷오프 이후인 경우는 어떤 테스트에서도 참을 내지 않는다. 비교 로직이 단순해 위험은 낮지만, 이 파일이 다른 곳에서 보이는 mutation-driven 꼼꼼함에 비하면 비대칭적인 gap.
  - 제안: `isGateCEnforced({ started: new Date("2026-06-04T00:00:00Z") })` 를 `true` 로 단언하는 케이스 추가.

## 요약

`plan-scan.ts`/`plan-scan.test.ts`/`spec-plan-completion.test.ts` 세 파일은 테스트 관점에서 전반적으로 매우 탄탄하다. 손수 짠 4벌의 walker 를 하나의 순수 함수 모듈로 통합하고, 이전 리뷰가 실측한 "158개 테스트 전량 GREEN 인데 위반 수집 분기가 한 번도 실행되지 않았다"는 vacuous-test 문제를 `fs.mkdtempSync` 기반 negative-path fixture(9종 이상의 위반 상태를 심어 정확히 그 집합만 검출되는지까지 단언)로 정면 해소했다. `checkPlanFrontmatter`/`isIsoDate`/`rawScalar` 등은 문자열 입력을 받는 순수 함수로 설계돼 파일시스템 없이 각 분기를 겨냥할 수 있고(테스트 용이성 우수), 날짜 롤오버·YAML 1.1 불리언 드롭·gray-matter 캐시 오염 같은 파서 세대에 의존하는 미묘한 버그까지 실측 기반으로 캐너리화했다. mock 은 전혀 쓰지 않고 실 파일시스템+임시 디렉터리로 통합 테스트하는 방식이 이 코드의 성격(fs 스캔 가드)에 적합하며, `beforeAll`/`afterAll` 격리도 정상이다. 다만 `hasValidSpecImpact` 가 synthetic 테스트에서만 검증되고 실제 Gate C 강제 경로(오늘 이미 real plan 을 대상으로 실행 중임을 확인함)는 동일 로직을 손으로 재구현해 사용한다는 점은, 이 파일 자신이 반복 경계하는 "판정 이중화" 패턴이 그대로 남아 있는 사례라 WARNING 으로 짚었다. 나머지는 커버리지의 미세한 비대칭(대소문자/n-a 변형, Date true-케이스, 실 spec 경로 결합)으로 낮은 우선순위다.

## 위험도

LOW
