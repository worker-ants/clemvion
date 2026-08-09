# 요구사항(Requirement) 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (Gate C — plan-completion spec-consistency)
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (plan 트리 스캔·frontmatter·라이프사이클 불변식 순수 함수)
- `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` (negative-path fixture 테스트)

관련 SoT: `.claude/docs/plan-lifecycle.md` (§3~§5, Gate C), `spec/conventions/spec-impl-evidence.md` (§4.2, R-8, R-9). 이 코드는 `spec/**` 자체가 정의하는 제품 기능이 아니라 저장소 내부 harness(build gate)이므로, spec 본문에 준하는 규약 SoT 로 위 두 문서를 사용해 line-level 대조했다.

## 검증 방법
- 대상 3파일 및 연계 파일(`plan-frontmatter.test.ts`, `spec-impl-evidence.md`, `plan-lifecycle.md`)을 전문 대조.
- `gray-matter@4.0.3`/`js-yaml` 실제 소스(`node_modules`)를 직접 열어 캐시 우회·YAML 날짜 롤오버 관련 JSDoc 주장을 코드 레벨로 검증(모두 일치).
- `node -e`로 `new Date(...)`/`js-yaml` 롤오버 값(`2026-13-32`→`2027-02-01`, `2026-00-10`→`2025-12-10` 등) 실측 재현 — 주석의 실측 수치와 일치.
- `pnpm vitest run` 으로 대상 3파일 + `plan-frontmatter.test.ts`(986 tests) 및 `spec-code-paths.test.ts`+`spec-frontmatter.test.ts`(779 tests) 실행 — 전량 GREEN.

## 발견사항

- **[INFO]** `spec-impl-evidence.md` frontmatter `code:` 목록에 `plan-scan.ts` 는 등재됐으나 신설된 `plan-scan.test.ts` 는 빠져 있다.
  - 위치: `spec/conventions/spec-impl-evidence.md:15` (code: 리스트, `plan-scan.ts` 항목 다음 줄이 비어 있음) / 비교 대상: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts` (리뷰 대상 파일 3)
  - 상세: 같은 `code:` 목록에서 지원 모듈과 그 전담 테스트가 쌍으로 등재되는 기존 패턴이 있다(`spec-frontmatter-parse.ts`+`spec-frontmatter-parse.test.ts`, `plan-frontmatter.test.ts` 자체 등). `plan-scan.ts` 는 이번에 추가됐지만 그 negative-path fixture 전담 파일인 `plan-scan.test.ts`(371줄, 신설)는 목록에서 빠졌다. 실제 build gate(`spec-code-paths.test.ts`)는 glob 이 ≥1 파일 매치만 요구하므로 build 실패로는 이어지지 않음을 직접 실행해 확인했다(779 tests 전량 GREEN) — 순수 문서 완결성 차이다.
  - 제안: 코드 수정 불요. 다음에 `spec-impl-evidence.md` 를 만질 때 `plan-scan.test.ts` 를 `code:` 리스트에 추가해 기존 페어링 관례와 맞추는 것을 권장(선택 사항, non-blocking).

## 상세 대조 결과 (문제 없음 확인)

아래는 CRITICAL/WARNING 후보로 의심해 개별 검증했으나 spec·구현이 정확히 일치함을 확인한 항목들이다(발견사항 아님, 검증 기록):

- `GATE_C_CUTOFF = 2026-06-04T00:00:00Z` — `plan-lifecycle.md §5`/`spec-impl-evidence.md R-8` 의 grandfather cutoff 와 일치, `isGateCEnforced` 는 `>=` 비교로 컷오프 당일 포함 일치.
- `NONE_VALUES = {"none","없음","n/a","na"}` (trim+lowercase 비교) — `spec-impl-evidence.md R-8`: "no-op sentinel(`none`/`없음`/`n/a`/`na`) 채택, 빈 문자열 기각" 과 정확히 일치. 빈 문자열/빈 배열/bare-string 단일경로가 전부 fail 되는 것도 `plan-lifecycle.md §Gate C` "흔한 실패형" 표와 일치(직접 vitest 로 재확인).
- `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}` — `plan-lifecycle.md §4` 종료 어휘 4개와 정확히 일치. `in-progress` 미포함(§4 "정면으로 모순"과 일치).
- `isIsoDate` 의 shape-check + `new Date` 라운드트립 — `2026-13-32`/`2026-00-10` 은 `Number.isNaN` 단계에서 즉시 reject, `2026-02-30`/`2026-04-31`/`2026-06-31`/`2027-02-29` 는 day 롤오버로 reject, `2028-02-29`(윤년) 만 accept. `new Date`/`js-yaml` 실측치가 JSDoc 서술과 100% 일치.
- `parseFrontmatterSafe(raw, {})` 의 캐시 우회 — `gray-matter/index.js` 소스 확인: `!options` 분기에서만 `matter.cache` 에 등록하므로, 빈 객체(truthy)를 넘기면 캐시 등록·조회를 모두 건너뛴다는 JSDoc 설명이 소스 레벨로 정확.
- `checkPlanFrontmatter` 의 `worktree`/`started`/`owner` 3필드 + `(unstarted)` sentinel — `plan-lifecycle.md §4` 와 일치. placeholder 정규식(`TBD`/`assigned at impl`/`미정`/`착수\s*시`/`^pending$`)이 문서가 예시로 든 값들을 모두 커버.
- `walkPlanMarkdown` 의 `archive/` 제외, `0-`/`_` 파일명 전용 면제(디렉터리엔 미적용) — JSDoc·fixture(`0-batch/child.md`, `_wip/child.md` 가 "위반(수집됨)")와 실제 구현이 일치.
- `findNonTerminalCompletedPlans`/`findUnparseablePlans` 가 파싱 실패를 조용히 skip 하는 설계와, 그 갭을 `spec-plan-completion.test.ts` 의 "every completed plan has parseable frontmatter" 캐너리가 메운다는 상호 참조 주석 — 실제로 `plan-frontmatter.test.ts`/`spec-plan-completion.test.ts` 양쪽에서 서로의 소관을 정확히 나눠 커버(중복도 누락도 없음).
- TODO/FIXME/HACK/XXX 주석: 3파일 전량 검색 결과 없음.
- 반환값: 모든 export 함수(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`/`parseFrontmatterSafe`/`checkPlanFrontmatter`/`isIsoDate`/`rawScalar` 등)가 모든 분기에서 명시적 값을 반환(암묵적 `undefined` 반환 경로 없음).

## 요약

`plan-scan.ts`/`plan-scan.test.ts`/`spec-plan-completion.test.ts` 세 파일은 `.claude/docs/plan-lifecycle.md`·`spec/conventions/spec-impl-evidence.md` 가 정의한 Gate C(`spec_impact` 강제)·plan frontmatter 3필드·완료 plan `status` 종료값 규약을 라인 단위로 정확히 구현한다. js-yaml 날짜 롤오버·gray-matter 캐시 오염 같은 실측된 함정을 원문 스칼라 비교·빈 옵션 객체로 정확히 우회했고(소스 레벨 재검증 완료), 앞선 실패 사례(파싱 실패 plan 이 모든 게이트를 우회, "위반 0건"이 검사 작동의 증거가 아님)에 대한 대응이 전용 캐너리·negative-path fixture 로 코드에 반영돼 있다. 3-vitest 파일 + 연계 build guard(`plan-frontmatter.test.ts`, `spec-code-paths.test.ts` 등)를 직접 실행해 전량 GREEN 을 확인했다. 유일한 발견사항은 `spec-impl-evidence.md` 의 `code:` 목록에 신설 `plan-scan.test.ts` 가 빠진 문서 완결성 갭으로, build 실패나 기능 결함으로 이어지지 않는 INFO 수준이다.

## 위험도

NONE
