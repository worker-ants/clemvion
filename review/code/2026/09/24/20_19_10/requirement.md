# 요구사항(Requirement) 리뷰 — `pending-plan-is-plan` (2라운드, `20_19_10`)

## 검증 방법

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`(+`.test.ts`)·
  `spec-pending-plan-existence.test.ts` 를 Read 로 전문 재확인 (전체 파일 컨텍스트가 프롬프트에
  실리지 않아 직접 열었다).
- `node -e` 로 `path.posix.normalize` 의 트래버설·트레일링 슬래시 케이스를 독립 재현
  (`plan/in-progress/../../codebase/x.md` → `codebase/x.md`, `plan/in-progress/` 트레일링 슬래시
  유지, `plan/in-progress-archive/foo.md` 무변화) — 테스트 주장과 전부 일치.
- `npx vitest run` 으로 두 가드 파일을 직접 실행 — **70 tests passed (2 files)**. `15(spec-frontmatter-parse) + 55(spec-pending-plan-existence, = 1 + 27×2)` 로 plan/CHANGELOG 이 주장하는 개수와 합이 정확히 일치.
- `spec/conventions/spec-impl-evidence.md` §2.1/§4 원문을 grep+Read 로 대조.
- 이전 라운드(`19_57_00`)의 WARNING 2건(§3→§2.1 인용 오류, CHANGELOG 누락)이 실제로 고쳐졌는지
  `grep -rn "§3.*pending_plans"` 로 잔존 여부 확인(0건) + `CHANGELOG.md` 신규 절 직접 Read.
- `git diff --stat origin/main...HEAD -- spec/` 로 `spec_impact: none` 주장 검증(0건, 일치).
- 뮤테이션: 코드를 고쳐 보지는 않았음(저장소 트리 변경 없음, `git status --short` 로 확인 — 세션
  출력 디렉터리 외 diff 없음). 대신 `npx vitest run` 반복 실행으로 결과를 재현했다(§관찰 사항 참고).

## 발견사항

- **[INFO]** 검증 중 단일 파일(`spec-frontmatter-parse.test.ts`)만 독립 실행했을 때 `isPendingPlanPath` 의 `isPendingPlanPath` describe 블록 7개 단언이 한 차례 전부 `true` 를 반환해 FAIL 한 것을 관측했다(첫 `accepts...` 케이스만 우연히 통과). 그러나 캐시 삭제(`node_modules/.vite`) 후 재실행 5회, `--environment=node` 강제 1회, 원래 두 파일을 함께 실행 1회 등 총 8회 이상 재현을 시도했으나 이후 전부 15/15·70/70 GREEN 이었고 실패가 다시 나타나지 않았다.
  - 위치: 관측 당시 명령 `npx vitest run codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts --reporter=verbose` (파일 자체는 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` 및 `spec-frontmatter-parse.ts:97-105`)
  - 상세: 이 리뷰는 병렬 fan-out 의 하나이고, 프롬프트가 명시하듯 다른 reviewer 들이 같은 워킹트리를 동시에 읽고 있다. `node_modules/.vite` 는 vitest/vite 의 공유 transform 캐시 디렉터리라 여러 프로세스가 동시에 같은 디렉터리를 대상으로 최초 캐시 생성 경쟁(race)을 벌이면 일시적으로 손상된/불완전한 변환 결과를 읽을 수 있다. 소스 코드(`isPendingPlanPath`) 자체의 결함이라면 재현이 결정적이어야 하는데, 캐시를 지우고 단독 실행해도 재현되지 않았고 `git status --short` 도 이 관측 전후로 깨끗했다(추적 파일 변경 없음) — 즉 소스 결함이 아니라 **동시 실행 중이던 다른 프로세스와의 캐시 경합으로 추정**된다. 조용히 넘어가면 다음 사람이 이 잔여물을 진짜 결함으로 오인할 수 있어 명시적으로 남긴다.
  - 제안: 조치 불요(재현 불가, 소스 결함으로 확정할 근거 없음). 다음에 이 클래스의 flake 가 반복 관측되면 `--pool=forks --poolOptions.forks.singleFork` 또는 전용 캐시 디렉터리(`--cacheDir`)로 병렬 리뷰 세션 간 격리를 검토할 가치가 있다(harness 개선, developer 소관).

## 핵심 로직 검증 결과 (문제 없음, 기록용)

- `isPendingPlanPath(relPath: unknown): boolean` — 모든 분기에서 boolean 반환, 예외를 던지지 않음.
  `typeof relPath !== "string"` 가드가 YAML 이 숫자/불리언으로 파싱한 항목(`- 42`)을 크래시 대신
  `false` 로 안전하게 보고 — INFO 3(이전 라운드) 조치가 실제로 존재함을 코드에서 직접 확인.
- 정규화(`path.posix.normalize`)가 **접두 검사 이전**에 적용돼 `plan/in-progress/../../codebase/x.md`
  같은 트래버설을 차단함을 `node -e` 로 독립 재현(결과: `codebase/x.md`, 어느 `PENDING_PLAN_DIRS`
  접두사도 만족 못 해 `false`).
- `PENDING_PLAN_DIRS = ["plan/in-progress/", "plan/complete/"]` 의 트레일링 슬래시가
  `plan/in-progress-archive/`·`plan/complete-old/` 같은 look-alike 디렉터리를 정확히 배제함을
  `node -e` 로 재현 — 캐너리 테스트(`spec-frontmatter-parse.test.ts:124-129`)와 일치.
- `plan/research/**` 배제, `plan/complete/archive/from-x/**` 포함이 CLAUDE.md 정보 저장 위치 규약과
  `spec-impl-evidence.md §2.1` `pending_plans` 행("`plan/in-progress/` 또는 `plan/complete/` 에
  실존하는 plan 경로")과 line-level 로 일치.
- spec fidelity: 이전 라운드 WARNING 1(§3→§2.1 오인용)이 5곳(코드 3·plan 2) 모두 실제로 정정됐음을
  `grep -rn "§3.*pending_plans"` 로 확인(0건). 현재 `spec-frontmatter-parse.ts:86`,
  `spec-frontmatter-parse.test.ts:79`, `spec-pending-plan-existence.test.ts:15`,
  `pending-plan-is-plan.md` 전부 `§2.1` 로 일치.
- CHANGELOG(`CHANGELOG.md` Unreleased 첫 절)의 사고 서술(`.sql` 세 경로가 몇 주간 통과)·처방
  요약(정규화 순서·research 배제·look-alike 배제·non-string 방어)·"조이기 전 0건/27개" 실측치가
  `plan/in-progress/pending-plan-is-plan.md` §C·D 및 실제 `vitest run` 결과(가드 55 = 1+27×2)와
  모순 없이 정확히 재현된다. "단위 테스트 15개" 표현은 `isApplicable`(7) + `isPendingPlanPath`(8)
  = 15 (파일 전체 `it()` 개수, `grep -c '  it('` 로 확인)로, 새 describe 블록 단독 개수(8)가 아니라
  파일 전체를 가리키는 것으로 읽히며 과장이 아니다.
- 이전 라운드 WARNING 2(CHANGELOG 누락)에 대한 조치로 이번 PR 항목뿐 아니라 `#1387` 백필 항목까지
  추가됐고, 트래커(`spec-draft-nullable-notation-followups.md`)의 관련 항목도 거짓 전제를 인용문으로
  남기고 정정한 형태로 갱신됐음을 diff 로 확인 — RESOLUTION.md 의 서술과 실제 파일 상태가 일치한다.
- `spec_impact: none`(plan frontmatter) — `git diff --stat origin/main...HEAD -- spec/` 결과 0건으로
  실측 일치.
- 반환값·에러 시나리오: `isPendingPlanPath` 가 어떤 입력(빈 문자열, 숫자, undefined, null, 트래버설,
  트레일링 슬래시만 있는 디렉터리)에도 예외 없이 boolean 을 반환함을 15개 단위 테스트 + 직접 재현으로
  확인. 가드(`spec-pending-plan-existence.test.ts`)의 두 단언("is a work plan" / "path resolves")도
  독립 `it()` 블록이라 순서 무관하게 항상 둘 다 실행되고, 실패 메시지(한국어)가 어느 spec 의 어느
  entry 가 위반인지 명시해 디버깅 정보 손실이 없다.

## 요약

핵심 변경(`isPendingPlanPath` 신설 + `spec-pending-plan-existence.test.ts` 가드 강화)은 `#1386`
사고의 근본 원인("존재하면 통과"가 "plan 이어야 통과"보다 넓었던 계약)을 정확히 겨냥하며,
spec(`spec-impl-evidence.md` §2.1/§4) 문면과 line-level 로 정확히 일치한다. 이전 라운드
(`19_57_00`)가 지적한 WARNING 2건(SoT §3 오인용, CHANGELOG 누락)은 이번 라운드에서 실제로
고쳐졌음을 코드·문서 직접 대조로 확인했다. 독립 재실행(`vitest run`, 70/70 PASS)과
`path.posix.normalize` 수동 재현으로 모든 엣지 케이스(트래버설, look-alike 디렉터리, 비-string
YAML 값, 확장자 누락, bare 디렉터리)가 주장대로 동작함을 직접 검증했다. CRITICAL/WARNING 급
기능 결함은 발견되지 않았다. 유일한 관찰 사항은 검증 과정에서 단 한 번 관측된 재현 불가능한 테스트
flake(§발견사항 INFO)로, 소스 결함이 아니라 병렬 fan-out 리뷰 세션 간 vite 캐시 경합으로 추정되며
이번 PR 코드 자체의 문제로 보지 않는다.

## 위험도

NONE
