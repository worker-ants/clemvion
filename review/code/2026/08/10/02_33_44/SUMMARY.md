# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 다만 `testing` reviewer 가 `worktree`/`started`/`owner` 세 필드 검사의 위반 분기가 CI 에서 한 번도 실행된 적 없는 vacuous-test 상태(이 파일이 과거 두 번 `#1108`/`#1117`에서 겪은 것과 동일한 실패 패턴)라고 지적했고, `maintainability` reviewer 는 describe 스코프-이름 불일치와 헤더 주석 히스토리 누적을 지적했다. 이번 라운드에서 forced 화이트리스트 7명(testing/documentation/requirement/scope/side_effect/maintainability/security) 전원이 정상 실행되어 결과를 확보했으며, 강제 화이트리스트 미이행 항목은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing (vacuous test) | `worktree`/`started`/`owner` 세 검사가 positive-only — 판정 로직(`WORKTREE_PLACEHOLDER`/`WORKTREE_SENTINEL`, ISO 날짜, 빈 owner)이 실저장소 데이터에만 의존해 위반 분기가 CI 에서 한 번도 실행된 적이 없다. 이 파일이 이번 PR 에서 status·링크 검사에 이미 적용한 "판정 로직을 `plan-scan.ts` 순수 함수로 추출 + synthetic fixture 로 negative-path 증명" 처방을 받지 못한 비대칭 상태. | `plan-frontmatter.test.ts:112`~`139` (판정 상수 `:53`~`:55`) | `isWorktreePlaceholder`/`isValidStartedDate` 등을 `plan-scan.ts`(또는 신규 모듈)로 옮겨 순수 함수화하고, `plan-scan.test.ts` 에 TBD/미정/pending/비-ISO/빈 owner 같은 합성 fixture 로 위반이 실제 검출되는지 양성 단언 추가 |
| 2 | Maintainability (naming/scope) | `describe("plan-frontmatter guard", …)` 안에 frontmatter 와 무관한 상대링크 무결성 테스트 2개가 섞여 있어 describe 이름과 실제 스코프가 어긋난다. 코드 내 구분은 `// ── (b) …` 주석뿐이라 테스트 실행 출력이나 `-t` 필터로는 드러나지 않는다. | `plan-frontmatter.test.ts:65`(describe), `:150`, `:161` | 링크 무결성 테스트 2개를 별도 `describe("plan relative link integrity", …)` 로 분리하거나, 최소한 outer describe 이름을 "plan lifecycle guards" 등으로 포괄화 |
| 3 | Maintainability / Documentation / Scope (문서 비대화) | 헤더 주석(약 38줄)에 지속적 규칙 문서와 특정 PR 번호(`#1108`, `#1117`)·리뷰 회차 내러티브("두 번 놓쳤다", "ai-review documentation WARNING" 등)가 섞여 있어, 새 리더가 현재 불변식을 파악하기 전에 과거 리뷰 이력부터 읽어야 한다. (documentation/scope reviewer 는 동일 관찰을 INFO 로 기록했으나 실질은 같은 지적이라 병합) | `plan-frontmatter.test.ts:13`~`50` (특히 `:24`~`26`, `:33`~`50`) | 헤더는 "스코프 + 왜 이 규칙인가" 정도만 남기고, 어떤 PR/라운드에서 무엇이 잡혔는지 같은 회고성 서술은 커밋 메시지나 `plan/complete/` 산출물로 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `ISO_DATE` 정규식(`/^\d{4}-\d{2}-\d{2}$/`)이 형식만 검사, 월 13/일 32 같은 달력상 무효 값도 통과 | `:124`~`131` (`ISO_DATE` 선언 `:52`) | WARNING #1 처리 시 함께 검토 (실질 피해 낮음 — 사람이 직접 쓰는 필드, 오기 사례 없음) |
| 2 | Requirement | 실저장소 하한 임계값(`toBeGreaterThan(5)`/`(50)`)이 실제 규모(in-progress ≈37, complete ≈375) 대비 낮음 — 주석이 "grooming 으로 줄어들 때마다 깨지지 않도록" 의도했다고 명시, 과거 `>20` 임계값 발화 전례 있음 | `:78`, `:171`, `:186` | 현행 유지 타당, 조치 불필요 |
| 3 | Requirement | `spec-links.ts`(`collectCompletePlans`, Gate C 소관)와 `plan-scan.ts`(`collectCompletePlanMarkdown`)가 여전히 두 벌의 독립 구현으로 남아 있음 | `plan-scan.ts:18`~`22` (주석) | 이미 `plan/in-progress/docs-guard-walker-dedup.md` 로 후속 통합 백로그 등재됨 — 추가 조치 불요 |
| 4 | Scope | `collectTopLevelPlans` 를 손수 `readdirSync` 순회에서 `collectLivePlanMarkdown` 위임으로 교체한 것은 이 파일이 스스로 재현하던 "두 곳이 조용히 틀어지는" 버그(0-/_- 접두 필터 불일치)를 고치는 것이라 이번 작업 범위 내 | `:57`~`63` | 조치 불필요 (정당한 범위 내 변경으로 판단) |
| 5 | Maintainability | `collectTopLevelPlans` 가 단일 호출부만 가진 1줄 위임 함수이면서 위임 대상과 다른 어휘("TopLevel" vs "Live") 사용 | `:61`~`63`(정의), `:67`(유일 호출부) | 인라인하거나, 유지한다면 `collectLivePlanAbsPaths` 처럼 어휘 통일 |
| 6 | Maintainability | `repoRoot()` 가 두 top-level `describe` 블록에서 각각 별도 호출됨 (순수 함수라 버그는 아님) | `:66`, `:177` | 파일 최상단에 `const root = repoRoot();` 한 번만 두고 공유 |
| 7 | Maintainability | non-vacuity 캐너리(`:161`~`172`)가 이미 계산된 `plans` 를 재사용하지 않고 `collectLivePlanMarkdown(root)` 를 다시 호출해 디렉터리 재스캔 | `:167`~`170` | `plans.reduce((n, p) => n + extractLinks(p).length, 0)` 로 대체해 재스캔 제거 |
| 8 | Security | `gray-matter`(내부 `js-yaml`) 로 frontmatter 파싱 — 기본 safe schema 사용, 입력은 신뢰된 리포지토리 커밋 콘텐츠라 악용 경로 없음 | `:99` | 향후 미신뢰 입력 처리로 재사용 시에만 재검토 |
| 9 | Security | 경로 조합이 `repoRoot()` + 리터럴 세그먼트(`"plan"`, `"in-progress"`)로 고정 — path traversal 위험 없음 | `:66`, `:112`/`:126` | 없음 |
| 10 | Security | 테스트 실패 메시지에 파일 상대경로·frontmatter 값·링크 대상 경로 노출 — 시크릿 아닌 리포지토리 내부 메타데이터 | `:119`, `:154` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | worktree/started/owner 세 필드 검사가 positive-only vacuous — 위반 분기가 CI 에서 실행된 이력 없음 |
| documentation | NONE | CRITICAL/WARNING 없음. 헤더 주석·정본 참조 전수 교차검증하여 불일치 없음 확인 (INFO 1건: 헤더 분량) |
| requirement | NONE | spec(`plan-lifecycle.md`§3·§4, `spec-impl-evidence.md`§4.2)과 line-level 일치, 엣지케이스 합성 fixture 검증 완료 (INFO 2건: 의도된 설계) |
| scope | NONE | 무관한 파일/임포트/설정/포맷팅 변경 없음, 리팩터도 범위 내 (INFO 2건) |
| side_effect | NONE | 순수 읽기 전용, 전역상태·FS쓰기·네트워크·시그니처 변경 없음 |
| maintainability | LOW | 헤더 히스토리 누적(WARNING) + describe 스코프-이름 불일치(WARNING) + 이름/중복호출 등 INFO 4건 |
| security | NONE | 인젝션/시크릿/인가우회/ReDoS 없음, 신뢰된 입력만 처리 (INFO 3건) |

## 발견 없는 에이전트

- side_effect — "No Critical/Warning/Info findings" (순수 읽기 전용 변경, 전역 상태·FS 쓰기·네트워크·공개 인터페이스 영향 없음)

## 권장 조치사항

1. (최우선) `worktree`/`started`/`owner` 판정 로직을 `plan-scan.ts` 순수 함수로 추출하고 `plan-scan.test.ts` 에 합성 fixture 로 negative-path(위반 실제 검출) 양성 단언 추가 — 이 파일이 이번 PR 에서 status/링크 검사에 이미 적용한 처방과 동일 패턴, 구조적 비용 낮음.
2. 상대링크 무결성 테스트 2개를 별도 `describe` 로 분리하거나 outer describe 이름을 "plan lifecycle guards" 등으로 포괄화하여 스코프-이름 불일치 해소.
3. 헤더 주석에서 PR 번호·리뷰 회차 내러티브를 커밋 메시지/plan 문서로 옮기고, 코드에는 "현재 규칙이 무엇인가"만 남긴다.
4. (선택, 낮은 우선순위) `collectTopLevelPlans` 어휘를 위임 대상(`collectLivePlanMarkdown`)과 통일하거나 인라인, `repoRoot()` 파일 최상단 1회 계산 공유, non-vacuity 캐너리에서 이미 수집한 `plans` 재사용해 중복 스캔 제거.

## 라우터 결정

- `routing=all` (router 미선별, 전체 실행 경로):
  - **실행**: testing, documentation, requirement, scope, side_effect, maintainability, security (7명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (forced 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |