# Code Review 통합 보고서

## 전체 위험도
**LOW** — `gh pr view` N+1 → `gh pr list` 배치 + 폴백 전환은 기능적 결함·보안 위험이 없는 성능 개선이나, plan 체크리스트·정책 문서(`worktree-policy.md`) 갱신 누락과 신규 `REAP_GH_PR_LIMIT` 관련 테스트 커버리지 갭이 WARNING 으로 남아 있다. (forced reviewer 7명 전원 결과 확보 — 화이트리스트 미이행 없음.)

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation/Requirement | plan 최상위 `## 체크리스트`의 B 항목이 `[ ]`(미체크)로 남아, 같은 파일 §B 본문 세부 항목은 `[x]` 완료 표기와 자기모순. A/F 항목은 섹션·체크리스트 양쪽이 동기화되어 있어 이 diff 만 관례를 벗어남 | `plan/in-progress/harness-guard-followups.md:282` | 최상위 체크리스트의 `- [ ] B — reaper gh N+1 배치화`를 `- [x]`로 갱신 (F 항목 표기 패턴과 통일) |
| 2 | Documentation/Requirement | `worktree-policy.md`가 reap 의 gh 조회 메커니즘을 여전히 "`gh pr view <branch>` 단건이 MERGED 판정"으로만 서술 — 이번 diff 로 배치(`gh pr list --state all --limit`)가 기본 경로, `gh pr view`는 배치 미스/실패 시 폴백으로 강등된 사실이 반영 안 됨. 신규 `REAP_GH_PR_LIMIT` 언급도 없음 | `.claude/docs/worktree-policy.md` "정리 대상·조건" 절 | 해당 bullet 을 "배치(`gh pr list`) 우선 조회 + `--limit` 밖/실패 시에만 `gh pr view` 폴백"으로 갱신, throttle 서술 근처에 `REAP_GH_PR_LIMIT` 추가 |
| 3 | Testing | `_GH_STUB`의 `GH_CALL_LOG`가 `gh` 호출의 첫 3개 위치 인자만 기록(`pr list --state`)해, 4~6번째 토큰인 `--limit "$GH_PR_LIMIT"`이 로그에 전혀 남지 않음 — `REAP_GH_PR_LIMIT` 값이 실제로 `gh pr list --limit`에 올바르게 전달되는지 어떤 테스트도 구조적으로 검증 불가 | `.claude/tests/test_reap_merged_worktrees.py` `_GH_STUB`(`echo "${1:-} ${2:-} ${3:-}"`) | 스텁 로그를 `"$@"` 전체로 확장하고, `REAP_GH_PR_LIMIT=7` 등으로 로그에 `--limit 7`이 나타남을 단언하는 테스트 추가 |
| 4 | Testing | 이번 diff 로 신규 도입된 `GH_PR_LIMIT` bad-value 가드(빈 값/비정수/`0` → 기본값 200)에 대한 실행 기반 테스트가 전무(`grep` 0건) — #3 의 로그 한계와 결합하면 이 가드가 깨지는 리그레션(예: `case`에서 `0` 분기 누락)을 스위트가 잡지 못함 | `.claude/tools/reap-merged-worktrees.sh` `GH_PR_LIMIT="${REAP_GH_PR_LIMIT:-200}"` / `case ... ''|*[!0-9]*|0) GH_PR_LIMIT=200 ;; esac` | `REAP_GH_PR_LIMIT=abc`/`0` 케이스에서 exit 0 로 정상 동작(가능하면 `--limit 200` 폴백까지) 확인하는 회귀 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture/SideEffect/Requirement | `awk` "첫 매치" 룩업이 `gh pr list`의 기본 정렬(생성일 내림차순 추정)에 암묵적으로 의존 — 동일 브랜치명 재사용 시 대표 PR 선택이 `gh pr view`와 달라질 이론적 가능성(단, 최악 결과는 fail-safe 방향인 "reap 미실행") | `reap-merged-worktrees.sh` `gh_state()` `awk -F'\t' -v b="$branch" '$1==b{print $2; exit}'` | 가정을 주석으로 명시하거나 `updatedAt`/`createdAt` 기반 명시적 최신값 선택 고려 (저빈도, 시급성 낮음) |
| 2 | Performance | `--limit`(기본 200) 윈도우 밖 오래된 PR 은 여전히 기존 N+1 `gh pr view` 폴백 경로로 재발 가능 — 의도된 정확성 우선 트레이드오프이며 코드 주석·plan §B 에 명시됨 | `reap-merged-worktrees.sh` `gh_state()`, `REAP_GH_PR_LIMIT` | 현재 저장소 규모(수십 개 이내 stale worktree)에서는 조치 불필요 |
| 3 | Documentation | `GH_PR_LIMIT`의 `case` 가드가 리터럴 `0`도 명시적으로 배제하는데(같은 파일의 `MIN_INTERVAL`은 `0`을 "throttle off"로 허용), 왜 `--limit 0`을 무효로 보는지 주석에 설명 없음 | `reap-merged-worktrees.sh` `GH_PR_LIMIT` 가드 주변 주석 | "0 은 배치를 무의미하게(항상 폴백) 만들어 기본값으로 되돌린다" 한 구절 추가 |
| 4 | Testing | `_GH_STUB`의 `pr list` 배치 응답이 `MERGED_BRANCHES`만 방출 — 실제 `--state all` 응답처럼 배치가 OPEN/CLOSED 를 직접 반환하고 `gh_state`가 `pr view` 없이 그 값을 그대로 반환하는 경로가 어떤 테스트로도 실행되지 않음(로직상 상태값 무관 동작이라 위험은 낮음) | `.claude/tests/test_reap_merged_worktrees.py` `_GH_STUB` `pr list` 분기 | `BATCH_STATES` 류 env 로 비-MERGED 상태를 배치가 직접 반환하는 케이스 + 그 때 `pr view` 미호출을 단언하는 테스트 추가 |
| 5 | Testing | 배치 hit 과 배치 miss 가 한 실행에 혼재하는 케이스(브랜치 2개 이상, 일부만 폴백) 미검증 | `.claude/tests/test_reap_merged_worktrees.py::test_falls_back_to_pr_view_when_branch_missing_from_batch` | 후보 2개(hit 1 + `BATCH_OMIT` 1) 조합에서 `pr view`가 정확히 miss 브랜치에만 1회 호출됨을 단언하는 테스트 추가 |
| 6 | Documentation | 신규 5개 gh 배치/폴백 테스트가 추가됐으나 파일 상단 모듈 docstring 의 "보장하는 동작" 목록과 `.claude/tests/README.md` 의 해당 파일 한 줄 요약이 갱신되지 않음 | `.claude/tests/test_reap_merged_worktrees.py` 모듈 docstring, `.claude/tests/README.md:33` | 두 곳에 "PR 상태는 `gh pr list` 배치로 조회, 미스/실패 시 `gh pr view` 폴백" 한 줄씩 추가 |
| 7 | Maintainability | 정수-검증 `case` 가드(`MIN_INTERVAL`, `GH_PR_LIMIT`)와 `command -v "$GH"` 존재확인이 `_load_pr_states`/`gh_state` 두 곳에 소규모 중복 | `reap-merged-worktrees.sh:64,70,76,87` | 지금은 추출 임계값 미만(2회). 3번째 정수 옵션 추가 시 공유 헬퍼로 승격 고려 |
| 8 | Performance | 브랜치 후보 매칭이 bash 3.2(연관 배열 부재) 하 `printf | awk` 선형 스캔(O(n·m)) — 현재 규모(후보 수십·PR 최대 200)에서는 fork 비용이 제거된 네트워크 왕복 대비 무시 가능 | `reap-merged-worktrees.sh` `gh_state()` | 조치 불필요. 후보가 수백 단위로 커지면 재검토 |
| 9 | Requirement | `spec/` 에 이 변경 관련 서술 없음 — `.claude/tools/`, `.claude/tests/`, `plan/` 범위의 내부 하네스 도구라 원래 `spec/` 대상 아님 | `spec/` 전역 검색 0건 | 해당 없음(정상) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿 노출·인증 우회 등 해당 없음. 브랜치 비교는 리터럴 매칭이라 정규식 인젝션 여지 없음 |
| performance | NONE | N+1(순차 `gh pr view`) → 배치 1회 + 로컬 폴백으로 정확히 전환. 서브셸 메모이제이션 함정 회피·lazy load·두 pass 간 캐시 공유 모두 적용 |
| architecture | LOW | `gh_state()` 인터페이스 유지한 채 내부 전략만 교체(캡슐화 양호). `awk` 첫-매치가 `gh pr list` 정렬에 암묵 의존(INFO) |
| requirement | LOW | 테스트 23건 전량 PASS + 비-vacuity(뮤턴트) 검증 완료. plan 체크리스트 불일치·`worktree-policy.md` stale 서술 WARNING |
| scope | NONE | 변경 파일 3개가 §B 목적에 정확히 수렴, 무관 리팩터·기능 확장 없음 |
| side_effect | LOW | 전역 상태(`_pr_states`)는 프로세스 로컬, 하위 호환 유지. tie-break 순서 의존(INFO)만 잔존 |
| maintainability | LOW | 기존 스타일·네이밍 준수, 서브셸 함정을 주석으로 명확히 설명. 소규모 중복 2건(INFO) |
| testing | LOW | 신규 5건이 핵심 회귀(배치 1회/공유/폴백/실패폴백/무호출) 커버, 실측 뮤턴트 검증 완료. `REAP_GH_PR_LIMIT` 관련 관측성·커버리지 갭 WARNING 2건 |
| documentation | LOW | 스크립트 인라인 주석·Env 문서·테스트 docstring 품질 높음. `worktree-policy.md`·plan 체크리스트 동기화 누락 WARNING |

## 발견 없는 에이전트

security, performance, scope (Critical/Warning 없음 — INFO 또는 없음)

## 권장 조치사항
1. `plan/in-progress/harness-guard-followups.md` 최상위 체크리스트의 `- [ ] B` 를 `- [x]` 로 갱신 (§B 본문 완료 표기와 정합).
2. `.claude/docs/worktree-policy.md` "정리 대상·조건" 절을 배치(`gh pr list`) 우선 + 폴백 구조로 갱신하고 `REAP_GH_PR_LIMIT` 언급 추가.
3. `_GH_STUB` 의 `GH_CALL_LOG` 를 `"$@"` 전체로 확장해 `--limit` 값 전달 여부를 테스트로 검증 가능하게 하고, `REAP_GH_PR_LIMIT` bad-value(빈 값/비정수/`0`) 가드에 대한 회귀 테스트를 추가.
4. (선택, 저비용) 모듈 docstring·`.claude/tests/README.md` 한 줄 요약에 신규 배치/폴백 커버리지 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | diff 가 셸 스크립트/테스트/plan 문서에 한정 — 패키지 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 프로세스 내 순차 로직만 변경, 신규 동시성 구조 없음(서브셸 메모이제이션은 side_effect/architecture 가 커버) |
  | api_contract | 외부/내부 API 계약 변경 없음(로컬 CLI 도구) |
  | user_guide_sync | 사용자 대상 제품 문서 변경 대상 아님(내부 하네스 도구) |