# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건은 모두 이 가드 파일 자신이 표방하는 "vacuous test 금지" 원칙과 정확히 같은 사각지대(positive-only 판정)를 스스로 재현한 점, 그리고 코드/포맷 일관성 결함으로, 즉시 차단할 사유는 아니나 기록해 둘 가치가 있다. forced whitelist(7명) 전원 정상 실행·전문 확보 완료 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | frontmatter 인라인 판정 4종(worktree placeholder / started ISO 날짜 / owner / parseable block)이 여전히 positive-only — 이 파일 자신이 status/링크 검사에 대해 "고쳤다"고 서술하는 vacuous-test 결함과 동일한 사각지대가 남아 있음. 저장소 전체 grep 결과 `WORKTREE_PLACEHOLDER`/`ISO_DATE` 위반 분기는 fixture 화되지 않았고, 현재 실 저장소에 위반 사례가 없어 위반 검출 분기가 한 번도 실행되지 않음(179 tests 전부 GREEN 이어도 무결성 보장 안 됨) | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:37-40, 89-95, 97-107, 109-116, 118-123` | `plan-scan.ts` 에 `findFrontmatterViolations(root)` 순수 함수로 추출하고 `plan-scan.test.ts` 에 합성 fixture(`worktree: TBD`, `started: not-a-date`, 빈 `owner`, 깨진 YAML)로 negative-path 양성 단언 추가. 최소한 정규식만이라도 `it.each` 로 참/거짓 표 검증 |
| 2 | maintainability | 구조적으로 동일한 `expect(condition, message).toBe(true)` 단언 4곳이 인접한 동형 단언들과 다르게 한 줄로 압축되어 있음 — `prettier --check` 로 실측 시 정확히 이 4곳이 재포맷 대상으로 flag 됨 | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:99, 115, 137, 156` | `npx prettier --write` 로 파일 전체 재포맷하거나 최소 이 4줄을 인접 단언과 동일한 멀티라인 스타일로 통일 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] SoT 문서(`plan-lifecycle.md §4`)가 `TERMINAL_PLAN_STATUSES` 상수의 실제 위치를 "그 파일"(`plan-frontmatter.test.ts`)로 잘못 지목 — 이 PR 계열 커밋(`ebb6f9598`, `88555a52b`)에서 상수가 이미 `plan-scan.ts` 로 추출·개명(`TERMINAL_STATUSES`→`TERMINAL_PLAN_STATUSES`)됐고, 리뷰 대상 파일 자신의 주석(`:184-185`)은 이미 올바르게 `plan-scan.ts` 를 가리키도록 정정되어 있음. 즉 코드는 맞고 SoT 문서만 낡음 | `.claude/docs/plan-lifecycle.md:83` | 코드 변경 불필요. `plan-lifecycle.md:83` 의 "그 파일의 `TERMINAL_PLAN_STATUSES`" 를 "`plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES`" 로 정정 (project-planner 소관) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `ISO_DATE` 정규식이 자리수 형태만 검사, 달력 유효성(`2026-13-99` 등) 미검사 | `plan-frontmatter.test.ts:37` | 우선순위 낮음 — WARNING#1 리팩터 시 함께 처리 |
| 2 | testing | 결합 단언(`typeof wt === "string" && wt.length > 0`)이 실패 원인을 구분 못 함 | `plan-frontmatter.test.ts:99` | 디버깅 편의 목적, 선택적 |
| 3 | documentation | 헤더 주석·개별 `it` 주석에 "현재 규칙"과 "과거 실수 회고"가 혼재 — 다만 파일 최상단 원칙("주석은 현재 규칙만")과 일부 모순되나 각 회고가 "왜 이 스코프인가"를 설명하는 데 실질 쓰이고 있어 강제 수정 대상 아님 | `plan-frontmatter.test.ts:13-35, 42-45, 128-134, 146-151` | 조치 불필요. 차기 리팩터 시 완전히 해소된 과거형 문장을 `plan-lifecycle.md` Rationale/커밋 메시지로 이관 고려 |
| 4 | maintainability | 하한값 매직 넘버(`5`, `50`)가 이름 없는 리터럴 | `plan-frontmatter.test.ts:63, 156, 171` | 선택적으로 `MIN_LIVE_PLANS`, `MIN_EXTRACTED_LINKS` named constant 추출 |
| 5 | maintainability | 지역 변수명 축약형(`wt`, `s`, `o`) + 세 검사 간 인라인/중간변수 스타일 불일치 | `plan-frontmatter.test.ts:98, 110, 119` | 우선순위 낮음. 리팩터 시 풀네임으로 통일 |
| 6 | maintainability | "발견→렌더링→빈 배열 단언" 패턴이 링크/status 두 검사에서 구조적으로 중복되나 의도된 대칭(주석 명시)이고 메시지 문구가 달라 추출 실익 제한적 | `plan-frontmatter.test.ts:135-144, 174-187` | 세 번째 유사 검사 추가 시 `assertNoViolations()` 헬퍼 추출 고려 |
| 7 | requirement | 선재 3필드 검사(positive-only)와 `ISO_DATE` 형식-only 갭은 이미 `plan/in-progress/docs-guard-legacy-fixture-coverage.md` 에 P3로 등재된 기지 결함 — WARNING#1 과 동일 이슈, 이중 카운트 아님 | `plan-frontmatter.test.ts:97-124, 37` | 재지적 불필요, 참고용 |
| 8 | requirement | 신규 2종 검사(status 종료값, 살아있는 plan 링크 무결성)는 SoT `plan-lifecycle.md §4` 와 line-level 일치 확인(스코프·허용값·예외 규칙) | — | 해당 없음 |
| 9 | scope | 파일 책임이 "frontmatter 3필드" 단일 가드에서 "frontmatter+status+링크" 3종 가드로 확장됐으나, 커밋 이력(`9e880e908` 등)과 worktree 이름(`plan-lifecycle-gates`)이 이것이 원래 작업 목표였음을 확인 — 범위 이탈 아님 | `plan-frontmatter.test.ts:13-35, 117-198, 200-228` | 조치 불필요. 4번째 불변식 추가 시 파일 분리 고려 |
| 10 | scope | `collectTopLevelPlans` 를 손수 `fs.readdirSync` 순회에서 `collectLivePlanMarkdown` 위임으로 교체한 것은 실측된 접두 필터 불일치 버그 수정(범위 내) | `plan-frontmatter.test.ts:42-48` | 조치 불필요 |
| 11 | scope | 헤더 주석 영→한 전면 재작성은 동일 작업 내 이전 ai-review 라운드(`f09b21893`) 피드백 대응으로 자기-문서화됨 | `plan-frontmatter.test.ts:13-35` | 조치 불필요 |
| 12 | side_effect | `describe` 블록 이름 변경이 CI/스크립트의 이름 기반 필터와 충돌하지 않음을 검색으로 확인 | `plan-frontmatter.test.ts:50` | 조치 불필요 |
| 13 | side_effect | 파일시스템 접근 전부 read-only, 전역 상태·환경변수·네트워크·공개 API 부작용 없음 | 파일 전체 | 조치 불필요 |
| 14 | security | 경로는 저장소 내부 스캔 결과로 고정되어 인젝션/경로탐색 표면 없음, 정규식은 선형 패턴이라 ReDoS 위험 없음, 하드코딩 시크릿·신규 의존성 없음 | 파일 전체 | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | frontmatter 4종 검사 positive-only (WARNING) |
| documentation | NONE | 외부 정본 7곳 교차검증 전부 일치, INFO 2건만 |
| maintainability | LOW | 포맷 불일치 4곳 (WARNING), 매직넘버·변수명 INFO |
| requirement | LOW | SoT 문서 상수 위치 SPEC-DRIFT 1건, 나머지 line-level 일치 |
| scope | NONE | 범위 확장 전부 커밋 이력으로 정당화됨 |
| side_effect | NONE | read-only, 부작용 없음 |
| security | NONE | 보안 우려 지점 없음 |

## 발견 없는 에이전트

scope, side_effect, security — CRITICAL/WARNING 없음 (INFO 및 "해당 없음"만).

## 권장 조치사항
1. (선택) `plan-scan.ts` 에 frontmatter 4종 검사를 순수 함수로 추출하고 `plan-scan.test.ts` 에 negative-path fixture(placeholder worktree, 비-ISO started, 빈 owner, 파싱 실패)를 심어 WARNING#1 해소.
2. (선택) `npx prettier --write` 로 파일 재포맷하여 4곳의 줄바꿈 스타일 불일치(WARNING#2) 해소.
3. (project-planner 소관, 코드 변경 아님) `.claude/docs/plan-lifecycle.md:83` 의 "그 파일의 `TERMINAL_PLAN_STATUSES`" 를 "`plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES`" 로 정정하여 SPEC-DRIFT 해소.
4. 나머지 INFO 항목은 우선순위 낮음, 후속 리팩터 시 일괄 고려.

## 라우터 결정

- `routing_status`: `all` (라우터가 전체 7종 reviewer 를 선택 — 개별 skip 없음)
- **실행**: testing, documentation, maintainability, requirement, scope, side_effect, security (7명) — 전원 success, 전문 확보 완료
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — forced whitelist 7명 전원 결과 확보됨 (누락 없음, "forced 인데 결과 없음" 케이스 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |
