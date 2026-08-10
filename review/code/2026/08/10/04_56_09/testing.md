# 테스트(Testing) 리뷰 — Gate C `started` fail-open 수정

## 발견사항

- **[INFO]** `plan/complete/**` 에서 frontmatter 자체가 통째로 파싱 실패하는 경우, Gate C 의 `started`/`spec_impact` 검사 어느 쪽에서도 커버되지 않는다(합성 fixture 로도 증명되지 않음).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:125-127`(`enforced` 필터), `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:144-146`(malformed-started 검사) — 둘 다 `p.parsed !== null` 을 통과한 plan 만 본다.
  - 상세: 이번 PR 은 "망가진 `started` 가 컷오프 판정에서 조용히 빠진다" 는 fail-open 을 정확히 겨냥해 고쳤고(`hasMalformedStarted` + 실제 repo 스캔 캐너리), 그 대상 fixture 로 실측·뮤테이션 검증까지 갖췄다. 다만 한 단계 앞선 경우 — `plan/complete/*.md` 의 frontmatter 블록 자체가 YAML 로 파싱조차 안 되는 경우 — 는 `parsedPlans` 생성 시점에 `parsed: null` 로 걸러지고 이후 어떤 `it` 도 그 파일을 다시 보지 않는다. `plan-scan.test.ts`(`findNonTerminalCompletedPlans`)는 이 스킵을 "다른 가드의 소관" 이라는 주석과 함께 명시적으로 fixture 로 증명하지만, `plan/complete/**` 를 그 "다른 가드" 가 실제로 커버하는 곳은 없다 — `checkPlanFrontmatter`(unparseable 검사 포함)는 `collectLivePlanMarkdown`(top-level in-progress 전용)만 스캔한다(`plan-frontmatter.test.ts:45-51,86-88`). 즉 completed plan 이 깨진 YAML 로 `spec_impact` 선언을 회피할 수 있는 경로가 어느 가드의 fixture 커버리지에도 없다.
  - 제안: 이번 diff 의 회귀는 아니고(이 skip 은 이전 코드에도 있었음), 새로 도입한 "몰래 통과 금지" 철학과 대칭을 맞추려면 `spec-plan-completion.test.ts` 의 "Gate C enforcement logic" 블록에 `parseFrontmatterSafe` 가 `null` 을 반환하는 완전 깨진 블록을 합성 fixture 로 추가해, 이 스코프 결정이 실수가 아니라 의도임을 캐너리로 고정하는 것을 고려. (선택사항 — Critical/Warning 아님)

- **[INFO]** `hasValidSpecImpact` 는 배열 원소 중 일부만 dangling 인 "혼합" 케이스에 대한 직접 단위 테스트가 없다.
  - 위치: 함수 정의 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:67-81`, 테스트 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:234-242`("accepts `none`/`없음` and existing spec-path lists...")
  - 상세: 현재 테스트는 전부-유효 배열(`["spec/5-system/4-execution-engine.md"]` → true)과 전부-무효 배열(`["spec/does-not-exist.md"]` → false) 만 겨냥한다. `impact.every(...)` 의 short-circuit 이 첫 원소가 유효하고 둘째 원소가 dangling 인 경우에도 `false` 를 정확히 반환하는지(즉 `.some()` 으로 뒤집혀도 이 스위트가 못 잡는지)는 관측되지 않는다. `danglingSpecImpact` 쪽은 혼합 배열([123, null, "spec/nested.md"] 류)을 겨냥하지만 `hasValidSpecImpact` 자체는 그렇지 않다.
  - 제안: `hasValidSpecImpact(["spec/5-system/4-execution-engine.md", "spec/does-not-exist.md"], exists)` 를 `false` 로 기대하는 케이스 한 줄 추가 — 이 PR 이 다른 곳에서 이미 실천 중인 "뮤테이션으로 무관측 분기를 찾는다" 는 원칙과 일치.
  - 이 함수 자체는 이번 diff 에서 새로 추가된 것이 아니라 기존 코드(전체 파일 컨텍스트로 포함)이므로 이번 PR 의 책임 범위 밖일 수 있음.

## 관찰 (긍정적)

- `startedDate`/`isGateCEnforced`/`hasMalformedStarted` 시그니처를 `Record<string, unknown>`(파싱 결과) → `string`(frontmatter 원문 블록)으로 바꾼 근거가 명확히 실측(표)으로 문서화돼 있고, 그 실측 결과와 정확히 대응하는 회귀 테스트(`"2026-13-32"`, `"2026-00-10"`, `"2026-06-31"`)가 추가됨. 특히 `2026-06-31`(6월 31일 → 7월 1일로 롤오버되어 컷오프를 넘는 유일한 값)을 "뮤테이션으로 발각했다" 고 밝히고 그 값 하나만으로 `isIsoDate` 유무를 가르는 diagnostic case 로 못박은 것은 무관측 분기 방지의 좋은 예.
- 합성 `block()` fixture(`` `\nstarted: ${started}\nowner: dev` ``)가 실제 `gray-matter` 의 `.matter` 출력 형태(선행 개행, 트레일링 `---` 없음)와 정확히 일치함을 직접 실행해 확인함 — fixture 가 실제 파싱 결과의 형태를 충실히 반영하고 있어 mock/fixture 괴리 문제 없음.
- `parseFrontmatterSafe` 를 두 단계(cutoff 필터 + per-plan 검사)가 공유하도록 리팩터링해 "같은 plan 을 두 번 파싱" 하던 종전 낭비도 함께 제거함(회귀 위험 없이 동작 동일 — 실행 확인).
- `isGateCEnforced` 시그니처 변경에 맞춰 기존 "grandfathers"/"enforces"/"missing" 테스트 3건이 모두 새 `block()` 헬퍼로 갱신되었고, 실제로 `vitest run` 실행 결과 `spec-plan-completion.test.ts`/`plan-scan.test.ts`/`plan-frontmatter.test.ts` 3개 파일 977 tests 전부 GREEN — 회귀 없음 확인.
- `rawScalar`/`isIsoDate` 를 `export` 로 승격했지만 새 전용 단위 테스트 파일은 없음. 다만 `plan-scan.test.ts` 의 `checkPlanFrontmatter` 스위트(다양한 날짜 edge case: `2026-13-32`, `2026-02-30`, `2026-04-31`, quoted, leap year 등)와 이번 PR 이 추가한 Gate C 쪽 테스트가 같은 두 함수를 서로 다른 호출 경로로 이중 검증하므로 실질 커버리지 갭은 낮음.
- 테스트 격리: 두 파일 모두 실제 저장소(`repoRoot()`)를 읽는 positive-only 통합 테스트와, 문자열 fixture 기반 순수 단위 테스트(부작용 없음, `beforeAll`/`afterAll` 불필요)로 명확히 분리돼 있어 테스트 간 의존성 없음.

## 요약

이번 diff 는 이전 리뷰가 지적한 "망가진 `started` 가 Gate C 를 통째로 면제한다" fail-open 을 `rawScalar`+`isIsoDate` 원문 기반 판정으로 정확히 닫았고, 그 수정이 겨냥하는 실측 사례(`2026-13-32`, `2026-00-10`, 특히 롤오버로 두 구현을 가르는 `2026-06-31`)를 전부 회귀 테스트로 고정했다. 실제 gray-matter 출력 형태와 fixture 형태가 일치함을 직접 확인했고, 시그니처 변경에 따른 기존 테스트 갱신도 정확하며 스위트 전체가 GREEN 이다. 남은 갭은 두 건 모두 이번 PR 의 핵심 수정과는 결이 다른 INFO 수준(`plan/complete/**` 전면 파싱 실패의 무관측 스킵, `hasValidSpecImpact` 혼합 배열 미검증)으로, Critical/Warning 에 해당하는 결함은 발견되지 않았다.

## 위험도

LOW
