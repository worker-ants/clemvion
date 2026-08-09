# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/보안 이슈 없음. `plan-frontmatter.test.ts` 는 잘 설계된 라이프사이클 가드 테스트이며, 유일한 실질 지적은 "non-vacuity" 캐너리 2건이 이름이 약속하는 범위(추출까지 확인)보다 좁은 범위(파일 discovery 만)를 증명한다는 WARNING 1건. 라우터 강제(forced) 화이트리스트 7개 reviewer 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | "non-vacuity" 이름의 캐너리 2건이 실제로는 "파일이 존재한다"만 증명하고 "링크/필드를 실제로 추출했다"는 증명하지 않음 — `extractLinks` 가 조용히 항상 빈 배열을 반환해도 이 두 단언은 여전히 통과함(이름/주석이 약속하는 보증 범위와의 갭). 다만 실제 추출 로직의 non-vacuity 는 별도 fixture 스위트(`spec-links.test.ts`/`plan-scan.test.ts`)가 이미 합성 임시 디렉터리로 증명하고 있어 시스템 전체 위험은 낮음 | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:161-165` (`the plan link scanner actually sees links (non-vacuity)`), `:172-176` (`finds completed plans to validate`) | 파일 수 대신 "실제로 추출된 링크 수" 등 extraction 단계 결과를 단언하도록 강화하거나, 최소한 주석에 "이 단언은 discovery 단계만 증명하며 extraction 단계는 `spec-links.test.ts`/`plan-scan.test.ts` 가 별도로 증명한다"고 범위를 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 헤더 주석에 "현재 규칙"과 "과거 라운드의 postmortem 회고"가 같은 블록에 섞여 있어 신규 독자가 분리해 읽기 부담 (내용 자체는 4개 참조 문서와 line-level 로 정확히 일치함을 교차검증 완료) | `plan-frontmatter.test.ts:13-51` (특히 24-26, 33-50) | 강제 수정 불요. 다음에 이 파일을 만질 때 해소된 과거형 서술은 `plan-lifecycle.md` Rationale 로 옮기고 소스 주석엔 현재 규칙만 남기는 정리 고려 |
| 2 | 요구사항 | 이 파일 자신의 non-vacuity 하한 검사(`.length` 기반)는 "파일 발견"만 증명하나, 이는 설계상 의도된 역할 분담(실제 탐지 증명은 fixture 스위트가 담당)이며 파일 자신의 주석도 이를 명시 | `plan-frontmatter.test.ts:164` | 조치 불요 (WARNING #1 과 동일 현상, requirement reviewer 는 INFO 로 분류) |
| 3 | 변경범위 | 파일 상단 이력 주석 블록이 ~40줄로 길어 코드 diff 대비 주석 diff 비중이 큼 — 그러나 git log 대조 결과 실제로 이전 리뷰 라운드가 지적한 "정본 오기재"를 정정한 것이며 장식적 리팩터가 아님 | `plan-frontmatter.test.ts:13-50` | 조치 불요. 향후 파일이 더 커지면 이력 주석 일부를 `plan/` 문서로 이전 고려 |
| 4 | 유지보수성 | 매직 넘버 `5` 가 동일 의도로 3곳에 반복(`toBeGreaterThan(5)`) | `plan-frontmatter.test.ts:78, :164, :176` | `const MIN_PLAUSIBLE_PLAN_COUNT = 5;` 로 추출해 의도를 한 곳에 모으기 |
| 5 | 유지보수성 | 파일명(`plan-frontmatter.test.ts`)이 frontmatter 검증을 시사하나, 두 번째 top-level describe(`completed plans declare a terminal status`)는 라이프사이클 status 정합성이라는 별개 관심사 | `plan-frontmatter.test.ts:169-193` | 현 상태 유지 무방(주석이 근거 제공). 검사가 더 늘면 `plan-lifecycle.test.ts` 등으로 파일 분리 고려 |
| 6 | 유지보수성 | 하한값 rationale 주석이 두 describe 블록에 거의 동일 문구로 근접 중복 | `plan-frontmatter.test.ts:75-77`, `:173-175` | 선택 사항 — 공통 rationale 을 파일 상단 한 곳으로 모으고 각 지점은 짧게 참조만 |
| 7 | 부작용 | `collectTopLevelPlans` 가 로컬 `fs.readdirSync` 직접 순회에서 `plan-scan.ts` 의 `collectLivePlanMarkdown` 위임으로 변경 — 비-export 로컬 헬퍼라 외부 호출자 영향 없음, 필터/정렬 로직 동등성 확인됨 | `plan-frontmatter.test.ts:61` | 없음 (정보성 확인) |
| 8 | 부작용 | 신규 테스트 2건이 실제 `plan/**` 트리를 런타임에 읽음 — 쓰기/네트워크/전역상태 변경 없음, 읽기 전용 확인 | `plan-frontmatter.test.ts:150-165`, `:172-192` | 없음 (정보성 확인) |
| 9 | 테스트 | `status` 값의 대소문자/공백 변형(`Complete`, `" complete"`)이 합성 fixture 로 커버되지 않아 향후 `.toLowerCase()` 완화가 조용히 들어와도 회귀가 안 걸림 | `plan-scan.ts` `findNonTerminalCompletedPlans`, fixture `plan-scan.test.ts:26-55` | 필수는 아니나 `status: Complete` 같은 fixture 한 줄 추가로 엄격성을 회귀로 고정 |
| 10 | 테스트 | Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 가 이번 통합에서 빠져 독립 구현으로 잔존 — 이미 `plan/in-progress/docs-guard-walker-dedup.md` 로 추적됨 | `spec-plan-completion.test.ts:59` (diff 밖) | 조치 불요, 추적 문서 존재 확인됨 |
| 11 | 보안 | CI 가 외부 포크 PR 을 자동 실행하며 그 PR 이 `plan/*.md` 를 포함하면 조작된 YAML frontmatter 가 파싱 대상이 될 수 있으나, js-yaml v4 기본 스키마 사용으로 실질 익스플로잇 가젯 없음 — 이번 diff 로 인한 신규 리스크 아님 | `plan-frontmatter.test.ts` (matter() 호출부) | 없음 (참고용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | NONE | 4개 참조 문서와 line-level 로 정확히 일치 확인. INFO 1건(과거형 postmortem 주석 응축 제안) |
| requirement | NONE | spec fidelity 전 항목 일치, 175 tests GREEN 실행 확인. INFO 1건 |
| scope | NONE | 실제 diff = import 4개 + walker 위임 + 신규 게이트 2건 + 이력 주석. 범위 이탈 없음 |
| side_effect | NONE | 읽기 전용, 전역상태/시그니처/env/네트워크 변경 없음 |
| maintainability | LOW | 매직넘버 반복, 파일명-스코프 불일치 가능성, 주석 근접중복 — 전부 INFO |
| testing | LOW | WARNING 1건(non-vacuity 캐너리가 discovery 만 증명), INFO 2건(대소문자 변형 미커버, Gate C 잔존) |
| security | NONE | 공격 표면 없음(테스트 전용 파일), 인젝션/시크릿/ReDoS 없음 |

## 발견 없는 에이전트

- security — CRITICAL/WARNING/INFO 모두 없음("발견사항: 없음"으로 명시)

## 권장 조치사항
1. (선택) `plan-frontmatter.test.ts` 의 non-vacuity 캐너리 2건(`:161-165`, `:172-176`)을 파일 수가 아닌 "실제 추출된 링크/필드 수" 기반으로 강화하거나, 최소한 주석에 이 단언이 discovery 단계만 증명한다는 범위를 명시한다.
2. (선택) 매직 넘버 `5` 를 이름 있는 상수로 추출하고, `status` 대소문자 변형에 대한 fixture 를 `plan-scan.test.ts` 에 1건 추가해 향후 완화 드리프트를 회귀로 고정한다.
3. 그 외 CRITICAL/차단 사유 없음 — 현재 diff 는 병합 가능한 상태로 판단됨.

## 라우터 결정

- `routing_status`: `all` (prompt 상 `routing: all` — 라우터가 전체 reviewer 를 선택)
  - **실행**: documentation, requirement, scope, side_effect, maintainability, testing, security (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 forced 목록에 포함되어 있으며 **7명 전원 결과 확보 완료** (forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |