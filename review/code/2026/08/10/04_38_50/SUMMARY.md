# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 5건(카테고리 중복 제거 후 3건 통합)은 모두 "이 PR 이 스스로 경계하는 판정 이중화/날짜 검증 하드닝 패턴이, 정작 자신의 새 코드 일부에는 재적용되지 않았다"는 동일 계열의 자기모순적 잔여 결함이며, 정상 데이터 경로에는 영향이 없는 좁은 fail-open/유지보수 리스크다. router 는 이번 라운드에서 미사용(전체 reviewer 강제 실행)이었고 forced 5명 전원 결과가 확보되어 강제 화이트리스트 미이행은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Maintainability | Gate C 의 `startedDate()` 가 같은 PR 이 `plan-scan.ts` 에서 직접 고친 `isIsoDate` 날짜 하드닝(원문 라운드트립 검증)을 재사용하지 않는다. 실측: `started: "2026-13-32"`(quoted) → `Invalid Date` → `NaN >= cutoff` → 조용히 미강제 통과. `started: 2026-00-10`(unquoted) → js-yaml 이 `2025-12-10`으로 연도까지 굴려 cutoff 이전으로 오판 → 강제 대상에서 fail-open 으로 빠짐. `plan/complete/**` 는 `checkPlanFrontmatter`(in-progress 전용, isIsoDate 사용)의 보호를 받지 못해 이 파일이 유일한 방어선. | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:27-34`(`startedDate`), `:39-41`(`isGateCEnforced`) vs `plan-scan.ts:196-225`(`rawScalar`/`isIsoDate`) | `startedDate()`를 raw frontmatter block + `rawScalar`+`isIsoDate` 조합으로 교체하거나, 최소 `isGateCEnforced` 진입 전 `isIsoDate` 검증을 거쳐 "판정 불가"와 "형태는 맞지만 달력상 무효"를 구분해 후자를 위반으로 표면화. |
| 2 | Testing / Maintainability | `hasValidSpecImpact` 순수 predicate 가 실제 Gate C 강제 경로(per-plan `it()` 3개, 오늘 이미 263건의 real plan 을 대상으로 실행 중)에서 호출되지 않고, 동일 로직(문자열 NONE_VALUES 매칭 / 배열 존재 검사)이 손으로 재구현돼 있다. `hasValidSpecImpact` 는 synthetic 테스트에서만 소비되는 사실상 죽은 함수. 이 파일 자신의 주석이 "판정이 두 곳에 손으로 복제되면 한쪽만 고쳐도 조용히 갈린다"를 반복 경계하는데 정작 이 함수 쌍이 그 패턴. | `spec-plan-completion.test.ts:43-57`(`hasValidSpecImpact`) vs `:118-146`(per-plan `it()` 3개) | real per-plan 테스트를 `hasValidSpecImpact` 호출로 교체(필요시 세분화된 헬퍼로 분해해 공유)하거나, 왜 real path 가 이 함수를 안 쓰는지 주석으로 명시. |
| 3 | Documentation | `plan-scan.ts` 헤더 주석이 "walker 가 네 벌 있었고 이 구현 하나로 모였다"(16행)와 "남은 walker 둘은 spec-links.ts 에 있다(plan 트리가 아니므로 범위 밖)"(21-22행)를 이어 붙여 산술적으로 모순. "네 벌"의 정의(13행, "plan/ 트리 walker")에 spec/codebase 를 순회하는 `collectSpecMarkdown`/`collectCodebaseSources` 가 애초에 속할 수 없는데 "남은 둘"로 이어 붙여 스코프 혼동을 재현. `docs-guard-walker-dedup.md` 가 이미 한 차례 정정한 바로 그 혼동의 재발. | `plan-scan.ts:13-23` | "네 벌"의 정의를 명확히 하거나(plan 트리 세 벌 + spec-links.ts 자매 문제로 문장 분리), `docs-guard-walker-dedup.md` walker 표와 숫자를 일치시킬 것. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing / Side Effect | "합성 fixture"로 문서화된 `danglingSpecImpact` 양성 테스트가 `repoRoot()`를 통해 실제 저장소 파일(`spec/conventions/spec-impl-evidence.md`)의 존재에 암묵 결합 — 해당 파일 리네임/이동 시 로직과 무관하게 실패. | `spec-plan-completion.test.ts:182-183` | 임시 디렉터리 + 더미 spec 파일로 격리하거나, 실 경로 의존을 주석으로 명시. |
| 2 | Testing | `NONE_VALUES` 의 `"n/a"`/`"na"` 변형과 대소문자 무관 처리가 어떤 테스트에서도 직접 단언되지 않는 죽은 분기. | `spec-plan-completion.test.ts:25`(정의) vs `:169-170`(테스트) | `hasValidSpecImpact("n/a", ...)`, `hasValidSpecImpact("NA", ...)` 케이스 추가. |
| 3 | Testing | `isGateCEnforced` 의 `Date` 인스턴스 입력이 true(강제됨) 케이스로는 테스트되지 않음(false 케이스만 Date/문자열 양쪽 커버). | `spec-plan-completion.test.ts:196-199` | `isGateCEnforced({started: new Date("2026-06-04T00:00:00Z")})` → true 단언 케이스 추가. |
| 4 | Requirement / Maintainability | `isGateCEnforced` 위 docstring이 "enforced set 이 비어 있다"고 서술하나 실측상 375건 중 263건이 이미 enforced — 주석이 게이트 신설 직후 상태를 그대로 남김. | `spec-plan-completion.test.ts:36-38` | 주석을 일반화하거나 현재 수치 반영. |
| 5 | Maintainability | 유사 YAML frontmatter 빌더 헬퍼(`fm`, `frontmatter`)가 같은 파일에 두 벌 존재. | `plan-scan.test.ts:29-30` vs `:207-208` | 하나로 통합 또는 위임. |
| 6 | Maintainability | `mkdtempSync`+`afterAll(rmSync)` 임시 디렉터리 보일러플레이트가 한 파일에서 3회 반복. | `plan-scan.test.ts:35-36, 71-72 / 190-197 / 336-337, 346-348` | 공용 헬퍼(`withTempRepoRoot`) 추출 고려(선택). |
| 7 | Maintainability | `isGateCEnforced`/`hasValidSpecImpact` 는 JSDoc 없이 공용 상단 주석만 공유, `danglingSpecImpact` 만 상세 JSDoc — 문서화 밀도 불균형. | `spec-plan-completion.test.ts:38-41, 43-57` vs `:59-70` | 세 함수 모두에 짧은 JSDoc 추가. |
| 8 | Maintainability | `rawScalar` 가 `key` 를 이스케이프 없이 `RegExp` 에 삽입 — 현재 `"started"` 리터럴만 호출돼 안전하나 시그니처는 범용을 암시. | `plan-scan.ts:196-200` | 리터럴 전용임을 문서화하거나 이스케이프 방어 추가. |
| 9 | Documentation | 헤더 주석은 `spec_impact: none` 만 예시로 들지만 `NONE_VALUES` 는 `없음`/`n/a`/`na` 도 인정. | `spec-plan-completion.test.ts:9-16` vs `:25` | 헤더 주석에 전체 어휘 명시 또는 합성 테스트 커버리지 추가. |
| 10 | Documentation | `ParsedFrontmatter.data` 필드가 `block` 필드와 달리 미문서화(파싱됨 vs 원문 차이). | `plan-scan.ts:98-102` | 한 줄 JSDoc 보강. |
| 11 | Side Effect | plan 목록 정렬 기준이 절대경로 코드포인트 정렬 → 상대경로 로케일(`localeCompare`) 정렬로 변경 — 각 plan 독립 `describe` 라 pass/fail 영향 없으나 출력 순서 변경. | `plan-scan.ts:84` | 의도된 변경이면 조치 불요; 순서 의존 소비처 생기면 우선 의심. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | LOW | `hasValidSpecImpact` 죽은 판정 함수(WARNING) + 커버리지 비대칭 3건(INFO). 테스트 전반은 탄탄(negative-path fixture 등). |
| requirement | LOW | `startedDate` 가 `isIsoDate` 하드닝 미재사용(WARNING). Spec fidelity 는 line-level 전부 일치(975 tests GREEN, 263/375 enforced 실측 확인). |
| scope | NONE | 발견 없음 — diff 전부가 커밋 메시지 서술 항목(W1/W2/W3/W5)과 1:1 대응, W4 는 의도적 defer 확인. |
| side_effect | LOW | 파일시스템/전역변수/시그니처/인터페이스 전부 안전 확인. INFO 2건(실 저장소 결합 테스트, 정렬 기준 변경)만. |
| maintainability | LOW | `startedDate` 중복(WARNING), `hasValidSpecImpact` 미사용(WARNING) + 문서화/헬퍼 중복 INFO 5건. |
| documentation | LOW | `plan-scan.ts` 헤더 주석 "네 벌/남은 둘" 자기모순(WARNING) — 정확히 이 헤더가 막으려던 스코프 혼동의 재발. 그 외 SoT 문서 동기화는 우수. |

## 발견 없는 에이전트

scope (NONE — 발견사항 자체가 없음, 위 표는 참고용).

## 권장 조치사항
1. Gate C `startedDate()`를 `plan-scan.ts` 의 `isIsoDate` 하드닝(raw block + 라운드트립 검증)과 통합해, quoted 무효 날짜(`Invalid Date`→미강제)와 unquoted 롤오버 날짜(연도까지 밀림→fail-open) 두 실측 경로를 모두 막을 것. (WARNING 1)
2. real per-plan Gate C 강제 테스트가 `hasValidSpecImpact`(또는 그 파생)를 실제로 호출하도록 리팩터링해 판정 이중화를 제거할 것. (WARNING 2)
3. `plan-scan.ts` 헤더 주석의 "네 벌"/"남은 둘" 서술을 `docs-guard-walker-dedup.md` walker 표와 숫자가 일치하도록 정정할 것. (WARNING 3)
4. 여력이 되면 INFO 항목 중 테스트 격리(실 저장소 경로 결합)와 문서화 밀도 불균형을 함께 정리.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(testing, requirement, scope, side_effect, maintainability, documentation) 강제 실행. forced(router_safety) 목록: `maintainability, requirement, scope, side_effect, testing` — 전원 결과 확보됨(누락 없음). documentation 은 forced 목록 외에 함께 실행되어 정상 반영됨.