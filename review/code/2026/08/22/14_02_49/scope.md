# 변경 범위(Scope) 리뷰 — mirror-guard-single-copy

## 검토 개요

target 은 `plan/in-progress/mirror-guard-single-copy.md` 가 서술하는 단일 작업 — *"masked-marker 미러
가드의 backend/frontend 중복 사본을 없애고, `codebase/**` 전체를 훑는 전용 CI 잡(`repo-guards.yml`)
하나로 대체한다"* — 를 구현한 diff 18개 파일이다. 각 파일을 그 목적에 비추어 대조했다.

## 발견사항

- **[INFO]** 다른 worktree 소속 plan 트래커 항목을 같은 턴에 처분
  - 위치: `plan/in-progress/masked-marker-shared-package.md` (frontmatter `worktree:
    masked-marker-contract-7d2e14`, target 자신의 worktree 는 `repo-guard-utils-extract-9c4b21`)
  - 상세: target 이 자신이 속하지 않은 다른 task 의 plan 문서(`:165` 항목)를 `[x]` 로 바꾸고 대체
    근거를 덧붙였다. 겉보기엔 "무관한 파일 수정"처럼 보일 수 있으나, target 자신의 plan
    (`plan/in-progress/mirror-guard-single-copy.md` §작업 3번째 항목)이 이 처분을 명시적 작업
    항목으로 예고했고, PR #1190 이 이미 머지되어 그 plan 이 `origin/main` 의 `in-progress/`
    에 실존함을 실측한 뒤 진행했다. `review/consistency/.../SUMMARY.md` WARNING #1 이 바로 이
    지점을 지적했고 target 의 작업 항목에 구체 경로가 명시돼 있어 이미 반영된 상태다. 이 저장소가
    반복해 온 "정본 트래커 항목은 처분과 같은 턴에 `[x]` + 대체 근거" 관행과 일치한다.
  - 제안: 조치 불필요 — 계획됐고 근거가 문서화된 변경이다. 기록 목적의 INFO.

- **[INFO]** 미러 가드가 두 워크플로에서 중복 실행되는 상태를 의도적으로 수용
  - 위치: `.github/workflows/repo-guards.yml:21-23` (주석), `.github/workflows/frontend-checks.yml`
    (변경 후 pathspec 에서 `codebase/channel-web-chat/**` 제거)
  - 상세: `repo-guards.yml` 신설 후에도 `masked-marker-mirror.test.ts` 는 `frontend-checks.yml` 의
    일반 vitest 스위트에 그대로 포함돼 있어, frontend 를 건드리는 PR 에서는 같은 가드가 두 워크플로
    에서 두 번 돈다. 새 기능 추가나 로직 변경은 아니고 순수 CI 실행 중복이며, 두 plan 문서
    (`mirror-guard-single-copy.md` §작업, `repo-guards.yml` 헤더 주석)에 "의도적 수용" 으로
    명시돼 있어 범위 이탈이 아니라 알려진 트레이드오프다.
  - 제안: 조치 불필요.

## 파일별 대조 요약

| 파일 | 목적과의 부합 |
| --- | --- |
| `.claude/tests/test_required_check_skip_jobs.py` | `CONVERTED` 목록에 `repo-guards.yml` 1줄 추가. 신규 워크플로 등록에 필요한 하네스 레지스트리 갱신 — 범위 내 |
| `.claude/tests/test_workflow_yaml_structure.py` | `_PULL_REQUEST_KEYS`/`_SKIP_JOB_WORKFLOWS`/`_PERMISSIONS`/cancelled-job 맵 4곳에 `repo-guards.yml` 등재. plan 이 명시한 "하네스 레지스트리 4곳" 과 정확히 일치 — 범위 내 |
| `.github/workflows/frontend-checks.yml` | `codebase/channel-web-chat/**` pathspec + 그 근거 주석 제거. 근거 소멸(미러 가드가 이 잡에서 이관됨)에 따른 필연적 후속 정리이며 plan 작업 항목에 명시 — 범위 내. 다른 부분(vitest/build 스텝 등)은 무변경 |
| `.github/workflows/repo-guards.yml` | 신규 파일, 이 작업의 핵심 산출물 — 범위 내 |
| `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` | 전체 삭제(162줄). "backend 사본 제거" 작업 항목과 일치 — 범위 내 |
| `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` | 전체 삭제. 위와 동일 — 범위 내 |
| `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` | 헤더 주석만 교체(로직 변경 없음) — backend 쌍둥이 협조 규칙을 "유일한 사본" 서술로 대체. plan 작업 항목과 일치 — 범위 내 |
| `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` | 헤더 docblock 서술만 갱신(테스트 바디·단언 무변경) — 범위 내 |
| `plan/in-progress/masked-marker-shared-package.md` | 체크박스 `[x]` + 대체 근거 1개 항목만 변경 — 범위 내 (위 INFO 참고) |
| `plan/in-progress/mirror-guard-single-copy.md` | 신규 plan 문서, 이 작업 자체의 계획서 — 범위 내 |
| `review/consistency/2026/08/22/13_20_18/*` (8개) | `/consistency-check --plan` 산출물 전체 신규 추가. 프로젝트 규약상 `spec/`·`plan/` 쓰기 직전 의무 단계의 증적이며 전부 신규 파일(기존 코드 수정 없음) — 범위 내 |

diff 전체에서 요청 범위를 벗어난 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트
변경, 의도치 않은 설정 변경은 발견되지 않았다. 주석 변경(파일 7·8)은 삭제된 backend 사본을 더 이상
참조하지 않도록 하는 데 **필수적인** 갱신이라 "불필요한 주석 변경"에 해당하지 않는다.

## 요약

18개 변경 파일 모두 "미러 가드 사본을 backend/frontend 둘에서 하나로 줄이고 전용 `repo-guards.yml`
CI 잡으로 경로 게이팅 문제를 해소한다"는 단일 목적에 직접 대응한다. 하네스 레지스트리 갱신, 이제 근거가
사라진 pathspec/주석 정리, plan 트래커 처분, consistency-check 증적까지 모두 이 작업이 명시적으로
예고하거나 프로젝트 규약이 강제하는 후속 조치이며, 범위를 벗어난 추가 수정이나 over-engineering 은
보이지 않는다.

## 위험도

NONE
