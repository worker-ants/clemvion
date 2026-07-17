# 변경 범위(Scope) 리뷰 — report-paths-shared

## 컨텍스트

본 변경분은 `plan/in-progress/harness-report-contract-followups.md` → `plan/complete/harness-report-contract-followups.md` 로 이관되는 plan 문서 자체를 diff 에 포함하고 있어, "의도된 범위" 를 외부 추정이 아니라 **diff 안의 SoT 문서로 직접 대조**할 수 있었다. 그 plan 은 5개 항목을 명시하고, 각 항목의 처분(구현/won't-do/이미 충족)을 기록한다. 아래는 12개 변경 파일을 그 5개 항목에 1:1 매핑한 결과다.

| plan 항목 | 처분 | 매핑되는 변경 파일 |
|---|---|---|
| §1 report-path 해석 3곳 공유 | 구현 | `.claude/_shared/__init__.py`, `.claude/_shared/report_paths.py`, `.claude/hooks/_lib/review_guard.py`, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`, `.claude/tests/test_report_paths_shared.py` |
| §2 리포트 내용 검증 | won't-do (근거 기록) | 코드 변경 없음 — plan 문서에만 반영 |
| §3 손복사 설명 → hub | 이미 충족 (실측) | 코드 변경 없음 — plan 문서에만 반영 |
| §4 cross-session 통합 테스트 | 구현 | `.claude/tests/test_forced_coverage_selection.py` |
| §5 sidebar 테스트 mock 공유 헬퍼 | 부분 완료(한계 기록) | `sidebar-test-utils.tsx`(신규), `sidebar-nav-href.test.tsx`, `sidebar.test.tsx` |
| (lifecycle) | plan 이관 | `plan/complete/harness-report-contract-followups.md`(신규), `plan/in-progress/harness-report-contract-followups.md`(삭제) |

12개 변경 파일 전부가 위 표의 어느 한 칸에 정확히 대응하며, 표에 없는 파일·영역을 건드린 diff hunk 는 발견되지 않았다.

## 상세 검토

- **`.claude/_shared/{__init__,report_paths}.py` (신규)**: `report_path`/`report_paths`/`has_report`/`missing_reports` 4개 함수 모두 최소 1곳 이상의 실제 호출자가 있다(review_guard, 두 orchestrator). 미사용 함수·불필요 API 표면 없음 — over-engineering 아님.
- **`review_guard.py` / `code_review_orchestrator.py` / `consistency_orchestrator.py`**: 각자 들고 있던 "세션 디렉토리 기준 경로 재anchor + non-empty 판정" 중복 로직을 shared 모듈 호출로 교체. `_reconcile_state_with_disk`/`_verify_coverage` 의 `os.path.isfile` → `_report_paths_lib.has_report`/`missing_reports`(존재+non-empty) 전환은 동작을 바꾸지만, 이 PR 이 고치려는 바로 그 버그(gate 는 non-empty 요구, CLI 는 존재만 확인 — `touch security.md` 가 CLI 는 통과·gate 는 차단)를 없애는 핵심 수정이라 범위 내. 추가된 `sys`/`_CLAUDE_DIR`/`sys.path.insert` 는 모두 새 import 를 위해 필요하며 미사용 잔여물 없음.
- **`test_report_paths_shared.py` / `test_forced_coverage_selection.py` (신규)**: 각각 plan §1, §4 를 정확히 겨냥. 특히 `AgreementTest` 는 gate(`review_guard._forced_coverage_missing`)와 CLI(`--verify-coverage` 서브프로세스)를 동일 입력으로 나란히 실행해 판정 일치를 검증 — 이 PR 의 주장("두 강제 지점이 이제 같은 답을 낸다")을 직접 뒷받침하는 테스트로, 범위를 벗어난 부가 기능이 아니다.
- **sidebar 테스트 3파일**: `sidebar-nav-href.test.tsx`/`sidebar.test.tsx` diff 를 라인 단위로 대조한 결과 **assertion·mock 응답·테스트 케이스 본문은 전혀 변경되지 않았고**, `matchMedia` stub·`createWrapper`·`renderSidebar` 만 `sidebar-test-utils.tsx` 로 추출됐다. 제거된 import(`QueryClient`, `QueryClientProvider`, 일부 `render`/`act`)는 추출 후 해당 파일에서 더 이상 직접 참조되지 않음을 확인했고, `sidebar.test.tsx` 가 여전히 직접 쓰는 `render`/`act`/`fireEvent`/`waitFor` 는 그대로 남아 있다. `vi.mock` 팩토리를 추출하지 않은 이유(vitest 호이스팅 제약, 실측 에러 메시지 포함)가 새 파일 헤더 주석에 명시돼 있어 "왜 완전 통합하지 않았는지"도 근거가 있다.
- **plan 파일 이관**: frontmatter 의 `worktree: (unstarted)` → `report-paths-shared-0edbf0`(현재 worktree 이름과 일치), `spec_impact: none` 추가는 `.claude/docs/plan-lifecycle.md` §Gate C 가 `complete/` 이관 시 요구하는 필수 필드로, 자유 재량 변경이 아니라 규약 준수다. 체크박스 `[ ]`→`[x]` 전환과 "## 종결" 절 추가도 실제 처분 내용과 일치한다.

## 경미한 관찰 (범위 위반 아님)

- 이 PR 은 두 개의 다른 도메인(Python 하네스 report-path 통합, 프론트엔드 sidebar 테스트 헬퍼 추출)을 한 번에 묶는다. 통상적인 "한 PR = 한 관심사" 기준으로는 분리 여지가 있어 보이지만, 두 항목 모두 diff 에 포함된 동일 followups plan 문서에 명시적으로 함께 추적되어 있고 plan 자체가 "5건 전부 처분 완료" 를 한 세션의 종결로 선언하므로, 의도치 않은 혼입이 아니라 계획된 번들링이다. 정보성 관찰로만 남긴다.

## 발견사항

- **[INFO]** 변경 파일 12개 전부가 diff 에 포함된 plan 문서(`plan/complete/harness-report-contract-followups.md`)의 5개 항목에 1:1 대응됨. 계획 외 파일·영역 수정 없음.
  - 위치: 전체 diff
  - 상세: 위 "plan 항목 매핑" 표 참고. `spec/`, `codebase/backend`, 설정 파일(`package.json`, `tsconfig*`, eslint/prettier config, CI 워크플로) 등은 일절 건드리지 않음.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** `_reconcile_state_with_disk`/`_verify_coverage` 의 판정 기준이 `os.path.isfile`(존재) 에서 `has_report`(존재+non-empty) 로 강화됨 — 동작 변경이지만 plan §1 이 명시한 핵심 버그 수정 그 자체.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`, `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`
  - 상세: 과거엔 `touch security.md` 가 CLI(`--verify-coverage`) 는 통과시키고 gate(`review_guard`)는 차단시켜 두 강제 지점이 어긋났다. 이번 변경으로 두 지점이 동일한 `has_report` 규칙을 공유해 그 발산을 제거한다 — "의도 이상의 변경" 이 아니라 이 PR 의 명시된 목적.
  - 제안: 없음.

- **[INFO]** 두 개의 이질적 도메인(Python 하네스 vs 프론트엔드 sidebar 테스트)이 한 PR 에 번들링되어 있으나, 둘 다 동일 diff 에 포함된 followups plan 문서가 명시적으로 함께 추적·종결한 항목이라 의도된 통합.
  - 위치: `codebase/frontend/src/components/layout/__tests__/{sidebar.test.tsx,sidebar-nav-href.test.tsx,sidebar-test-utils.tsx}` vs `.claude/_shared/**`, `.claude/hooks/_lib/review_guard.py`, 두 orchestrator
  - 상세: 통상 "한 PR = 한 관심사" 기준으로는 분리 후보로 보일 수 있으나, 범위 위반으로 보지 않음 — plan 문서(§5)가 이전 PR(#958 W#4)에서 "범위 오염" 우려로 미뤄졌던 항목을 이번에 의식적으로 함께 처분한다고 명시.
  - 제안: 향후 유사 followups 묶음 작업에서 bisect 편의를 원한다면 도메인별 커밋 분리(같은 PR 내 별도 커밋)를 고려할 수 있으나 필수는 아님.

- **[INFO]** sidebar 테스트 리팩터는 assertion/모의 응답/테스트 케이스 본문 변경 없이 순수 추출(matchMedia stub, createWrapper, renderSidebar)만 수행했음을 라인 단위로 확인.
  - 위치: `codebase/frontend/src/components/layout/__tests__/sidebar-nav-href.test.tsx`, `sidebar.test.tsx`, `sidebar-test-utils.tsx`(신규)
  - 상세: 제거된 import(`QueryClient`, `QueryClientProvider`, 일부 `render`/`act`)는 추출 후 해당 파일에서 미사용 확인. `vi.mock` 팩토리를 공유 헬퍼로 옮기지 못한 이유(vitest 호이스팅)는 새 파일 헤더에 실측 근거와 함께 명시.
  - 제안: 없음.

- **[INFO]** plan frontmatter 변경(`worktree: (unstarted)` → 실제 worktree 이름, `spec_impact: none` 추가)은 `.claude/docs/plan-lifecycle.md` §Gate C 가 `complete/` 이관 시 강제하는 필수 필드이며 임의 설정 변경이 아님.
  - 위치: `plan/complete/harness-report-contract-followups.md`
  - 제안: 없음.

## 요약

12개 변경 파일 전부가 diff 에 함께 포함된 `plan/complete/harness-report-contract-followups.md` 의 5개 항목(§1 report-path 공유, §2 won't-do, §3 이미 충족, §4 cross-session 테스트, §5 sidebar 테스트 헬퍼)에 정확히 대응하며, 계획에 없는 파일·기능·설정·포맷팅·주석 변경은 발견되지 않았다. `os.path.isfile` → `has_report` 전환처럼 동작을 바꾸는 지점도 이 PR 이 명시적으로 고치려는 gate/CLI 판정 불일치 버그 그 자체여서 범위 내로 판단한다. 유일한 경미 관찰은 Python 하네스 리팩터와 프론트엔드 sidebar 테스트 리팩터라는 서로 다른 도메인이 한 PR 에 번들링됐다는 점인데, 이는 동일 plan 문서가 의식적으로 함께 추적·종결한 항목이라 범위 위반이 아니라 계획된 통합으로 판단한다.

## 위험도

NONE
