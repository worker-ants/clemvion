# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 drift 가드(`internal-package-registration.test.ts`, PR #968 후속) 자체는 정적 리뷰 + 실측(vitest 12/12 통과, mutation 재현 다수)으로 실질 방어력이 검증됐으나, 가드가 사용하는 정규식 휴리스틱(`fnBody`)에 heredoc 발생 시 "조용한 조기 절단"이라는 잠재 사각지대가 있고, 가드 자신의 true-positive 를 고정하는 합성 fixture 테스트가 스위트 안에 없다는 구조적 경고 2건이 있음. 현재 코드(`test-stages.sh` 3개 cmd_* 함수)엔 heredoc 이 없어 즉시 트리거되지 않으며, 나머지 파일 2곳(`test-stages.sh`, `packages-checks.yml`)은 순수 주석 추가만 있어 위험 없음. 8개 reviewer(강제 포함 6 + 라우터 선정 2) 전원 정상 결과 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 견고성 (architecture + testing 통합) | `fnBody` 의 자기방어(self-check)가 "조기 열림"(본문 내 nested `{`)만 감지하고 "조기 닫힘"(heredoc·문자열 리터럴로 라인 시작에 `}` 단독 등장)은 감지하지 못하는 비대칭 구조. testing 리뷰어가 합성 fixture(`cmd_build() { ...; cat <<MARKER\n}\nMARKER\n...; }`)로 직접 재현: 이 경우 throw 없이 본문이 조용히 절단되고, 절단 이후 등록된 패키지는 "실행되지 않는 패키지" 검증에서 에러 없이 누락됨 — 이 가드 자신이 막으려는 결함 클래스(#968, "조용한 무검증")를 파서 내부에서 재현할 수 있는 잠재 경로. 현재 `test-stages.sh` 의 3개 `cmd_*` 함수는 heredoc 을 쓰지 않아 즉시 트리거되지는 않음 | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:423-437` (`fnBody`) | 자기점검 조건을 "라인 시작에 `{` 또는 `}` 가 단독으로 등장하는 모든 줄"로 확장(대칭화)하거나, 최소한 주석에 "heredoc 등으로 인한 line-start `}` 리터럴은 이 self-check 범위 밖"임을 명시해 실제보다 넓은 보장으로 오인되지 않게 할 것 |
| 2 | 테스트 커버리지 | 가드 자신의 "실패해야 할 때 실제로 실패하는가"(true-positive)를 증명하는 합성 fixture 기반 자동 테스트가 스위트 안에 없음. vacuity 방지(빈 파싱 결과 방지) 테스트는 있으나, 저장소 현재(=이미 정렬된) 상태만 읽어 대조하므로 비교 로직 자체(`missing` 계산, `Set` 멤버십, `.toEqual` 방향 등)에 회귀가 생겨도 스위트 내부에서는 잡히지 않음. 리뷰 시점에 수동 mutation 3건(INTERNAL_PACKAGES 누락, matrix.pkg 누락, 미등록 신규 패키지 추가)으로 실제 동작은 확인했으나 이 검증이 코드로 고정돼 있지 않음 | `internal-package-registration.test.ts` 전체 (자매 가드 `eslint-layering-guard.test.ts` 는 이 패턴을 이미 갖춤) | `internalPackages(sh)`, `fnBody(sh, fn)`, `listAtPath(lines, keys)` 등 순수 함수에 합성 fixture 로 "누락 시 반드시 detect" 케이스 2~3개를 추가해 회귀 방지를 스위트 내부에 고정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | GitHub Actions 액션이 커밋 SHA 가 아닌 메이저 버전 태그로 고정(`checkout@v7`, `pnpm/action-setup@v6`, `setup-node@v6`) — 이번 diff 범위 밖(기존 코드)이고 Actions 자체가 repo 레벨에서 비활성화(inert)라 즉각 위험 없음 | `.github/workflows/packages-checks.yml` | 조치 불요(Actions 재활성화 시점에 백로그로 검토) |
| 2 | 성능 | `discoverPackages()` 가 패키지 디렉터리마다 개별 동기 `existsSync`+`readFileSync` 호출(N+1 유사 패턴) — 대상이 로컬 파일 6개뿐이라 무해 | `internal-package-registration.test.ts:695-707` | 조치 불요 |
| 3 | 성능 | `fnBody`/`listAtPath` 가 `it`/`it.each` 케이스마다 동일 입력을 재파싱 — 파일이 100줄대라 실측 영향 없음 | `test.each(STAGES)` 블록(878-897) | 조치 불요 |
| 4 | 유지보수성 | `repoRoot()` 의 상위 디렉터리 탐색 상한 `12` 가 근거 설명 없는 매직 넘버 | `repoRoot()` | 이름 붙이거나 주석으로 근거(현재 실제 깊이 대비 여유) 명시 |
| 5 | 유지보수성 | `explicitFilterCalls` 의 `!c.name.startsWith("$")` 필터 — 캡처 정규식이 이미 `$` 를 배제해 도달 불가능한 중복 방어 코드. 향후 정규식 완화 시 "필터가 있으니 안전"이라는 잘못된 확신을 줄 수 있음 | `explicitFilterCalls()` | 정규식/필터 배제 로직을 한쪽으로 일원화하거나 주석으로 중복임을 명시 |
| 6 | 아키텍처 | bash/YAML 파서 10개 가까운 순수 함수가 `__tests__/` 파일 내부에 비공개로 존재 — 현 스코프(가드 1개)에서는 응집도 높아 문제 없으나, 두 번째 소비처가 생기면 재사용성 저하 우려 | `internal-package-registration.test.ts` 전체 | 두 번째 유사 가드 필요 시 `repo-guards/parsers/{bash,yaml}.ts` 로 승격 검토(현재는 YAGNI) |
| 7 | 아키텍처 | frontend 테스트 스위트가 harness(`.claude/`)·CI(`.github/`) 설정 drift 를 지키는 유일한 실행 게이트가 되는 의도된 경계 넘기 — 배치 근거는 주석에 충분히 설명돼 있음 | 파일 전체 + `.claude/test-stages.sh:35-39`, `packages-checks.yml:3-7` | 조치 불요(이미 양방향 참조 문서화됨) |
| 8 | 아키텍처 | `INTERNAL_PACKAGES`(손 유지 배열) vs `packages-checks.yml` 3개 리스트(파생값 일치 요구) — 서로 다른 모집단 SoT 전략이 병존, 판단 기준이 테스트 파일 주석에만 존재 | 파일 헤더 주석 + `internalPackages()`/`backendWorkflowDeps()` | 유사 가드 반복 시 "손 유지 vs 파생" 판단 기준을 `spec/conventions/` 로 집약 고려 |
| 9 | 테스트 | `explicitFilterCalls` 가 `pnpm --filter <pkg> <script>` 를 한 줄 연속 공백으로만 가정 — 백슬래시 줄바꿈으로 재포맷되면 이름을 오인식(단, fail-loud 라 조용한 실패는 아님) | `internal-package-registration.test.ts:440-444` | 주석에 "한 줄 안에 있어야 한다"는 전제 명시 |
| 10 | 요구사항 | 관련 spec 문서 부재 — `spec/` 전역에 `INTERNAL_PACKAGES`/`packages-checks.yml`/`internal-package-registration` 매치 없음. 순수 리포지토리 tooling 가드로 제품 요구사항 도메인 밖이라 spec fidelity 판정 대상 자체가 없음 | `spec/` 전역 grep | 조치 불요 |
| 11 | 요구사항 | `internalPackages()` 파서가 큰따옴표만 인식 — 홑따옴표로 바뀌면 빈 배열 반환하지만 vacuity 테스트가 즉시 감지(fail-closed) | `internal-package-registration.test.ts:407-411` | 조치 불요(현행 컨벤션과 일치) |
| 12 | 요구사항 | 신규 `repo-guards/` 네임스페이스가 기존 `src/lib/__tests__/` 관례와 다른 디렉터리 컨벤션 사용 | `codebase/frontend/src/lib/repo-guards/__tests__/` | 조치 불요(3번째 유사 가드 발생 시 통일 여부 판단) |
| 13 | 부작용 | 모듈 로드/collection 시점의 eager 동기 fs read + throw — 의도된 fail-closed 설계(파일 헤더에 명시), 다른 테스트에 영향 없이 파일 단위로 격리됨 | `ROOT = repoRoot()`, `discoverPackages`/`backendWorkflowDeps`, describe 콜백 최상단 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿/인젝션/인증/암호화 이슈 없음. Actions SHA 미고정은 기존 코드·inert 상태로 정보성 |
| performance | NONE | 인프라/테스트 코드 성격상 N+1·블로킹 등 실질 성능 이슈 없음 |
| architecture | LOW | `fnBody` 자기방어 비대칭(조기 닫힘 미검출), 파서 재사용성·이질적 SoT 전략 병존은 향후 확장 시 유의할 부채 |
| requirement | NONE | 3파일 전부 실측 검증(Actions off·런 0건, 배선 확인), mutation 2건 재현 성공, spec 불일치 없음 |
| scope | NONE | 정확히 3파일, 신설 가드 목적과 직결, 스코프 밖 변경·무관 리팩터 없음 |
| side_effect | NONE | 전부 읽기 전용, 네트워크/전역상태/환경변수 부작용 없음, fail-closed 는 의도된 설계 |
| maintainability | LOW | 매직넘버, 도달 불가능한 방어 필터, 파서 재사용성 등 경미한 개선 여지 |
| testing | LOW | true-positive fixture 테스트 부재 + `fnBody` heredoc 사각지대를 합성 fixture 로 직접 재현·확인(WARNING 2건의 근거) |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고함(단, CRITICAL 은 전원 0건).

## 권장 조치사항

1. **(WARNING 대응, 우선)** `fnBody` 의 자기점검 조건을 "라인 시작 `{` 또는 `}` 단독 등장"까지 대칭적으로 확장하거나, 최소한 주석에 heredoc/문자열 리터럴로 인한 조기 절단은 이 self-check 범위 밖임을 명시할 것 — 현재 즉시 트리거되지는 않으나 이 가드 자신이 막으려는 실패 클래스(#968)를 재현할 수 있는 잠재 경로이므로 문서화만이라도 선행.
2. **(WARNING 대응)** `internalPackages`/`fnBody`/`listAtPath` 등 순수 함수에 합성 fixture 기반 true-positive/negative 유닛 테스트를 추가해, 비교 로직 자체의 향후 회귀를 스위트 내부에서 잡을 수 있게 할 것(자매 가드 `eslint-layering-guard.test.ts` 패턴 참고).
3. (낮은 우선순위, INFO) `repoRoot()` 매직넘버 `12` 에 이름/주석 부여, `explicitFilterCalls` 의 도달 불가능한 `$` 방어 필터 정리.
4. (낮은 우선순위, INFO) 향후 세 번째 유사 drift 가드가 필요해지면 bash/YAML 파서 유틸리티를 sibling 모듈로 승격하고, "손 유지 vs 파생" SoT 판단 기준을 `spec/conventions/` 에 집약하는 것을 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing` (8명 = 라우터 선정 2명[performance, architecture] + 강제 포함[router_safety] 6명)
  - **제외**: 아래 표 (6명, 세부 사유는 라우팅 산출물에 미제공 — 변경 파일이 해당 영역과 무관하다는 판단으로 추정)
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | documentation | 사용자 대상 문서 변경 없음(코드 주석·테스트 인프라만 변경) |
  | dependency | 신규 외부 의존성 추가 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/레이스 조건 관련 코드 변경 없음 |
  | api_contract | API 계약(엔드포인트/DTO) 변경 없음 |
  | user_guide_sync | 사용자 가이드 대상 기능 변경 없음(내부 tooling 가드) |